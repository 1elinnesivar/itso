-- Güncel oda listesini veri kaybetmeden uygulamak için eski tablo anlık
-- görüntülerini ve PDF kaynaklı firma alanlarını ekler.
alter table public.records
  add column if not exists registration_date text,
  add column if not exists tax_office_account text,
  add column if not exists authority_signature text;

create table if not exists public.legacy_table_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  source_file_name text not null,
  record_count integer not null check (record_count >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.legacy_table_records (
  snapshot_id uuid not null references public.legacy_table_snapshots(id) on delete cascade,
  original_record_id uuid not null,
  record_data jsonb not null,
  contacts jsonb not null default '[]'::jsonb,
  primary key (snapshot_id, original_record_id)
);

create index if not exists legacy_table_records_snapshot_order_idx
  on public.legacy_table_records (
    snapshot_id,
    ((record_data ->> 'display_order')::integer)
  );

alter table public.legacy_table_snapshots enable row level security;
alter table public.legacy_table_records enable row level security;

drop policy if exists legacy_snapshots_admin_read on public.legacy_table_snapshots;
create policy legacy_snapshots_admin_read
on public.legacy_table_snapshots for select to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists legacy_records_admin_read on public.legacy_table_records;
create policy legacy_records_admin_read
on public.legacy_table_records for select to authenticated
using (public.current_user_role() = 'admin');

revoke all on public.legacy_table_snapshots, public.legacy_table_records
  from anon, authenticated;
grant select on public.legacy_table_snapshots, public.legacy_table_records
  to authenticated;

create or replace function public.create_record(
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
)
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.records;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cardinality(p_contact_ids) <>
    (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.records.display_order'));
  insert into public.records (
    display_order, member_registry_no, trade_registry_no, registration_date,
    tax_office_account, authority_signature, profession_group, status, title,
    officials, origin, vote_status, notes, district, street,
    registered_address, phone_numbers, gift, itso_status,
    created_by, updated_by
  )
  values (
    coalesce((select max(display_order) + 1 from public.records), 1),
    public.clean_text(p_payload ->> 'member_registry_no'),
    public.clean_text(p_payload ->> 'trade_registry_no'),
    public.clean_text(p_payload ->> 'registration_date'),
    public.clean_text(p_payload ->> 'tax_office_account'),
    public.clean_text(p_payload ->> 'authority_signature'),
    public.clean_text(p_payload ->> 'profession_group'),
    public.clean_text(p_payload ->> 'status'),
    public.clean_text(p_payload ->> 'title'),
    public.clean_text(p_payload ->> 'officials'),
    public.clean_text(p_payload ->> 'origin'),
    public.clean_text(p_payload ->> 'vote_status'),
    public.clean_text(p_payload ->> 'notes'),
    public.clean_text(p_payload ->> 'district'),
    public.clean_text(p_payload ->> 'street'),
    coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    coalesce((p_payload ->> 'gift')::boolean, false),
    public.clean_text(p_payload ->> 'itso_status'),
    auth.uid(), auth.uid()
  )
  returning * into created;

  insert into public.record_contacts (record_id, contact_person_id, position)
  select created.id, contact_id, ordinality::smallint
  from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);
  return created;
end;
$$;

create or replace function public.update_record(
  p_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
)
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.records;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cardinality(p_contact_ids) <>
    (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  update public.records set
    member_registry_no = public.clean_text(p_payload ->> 'member_registry_no'),
    trade_registry_no = public.clean_text(p_payload ->> 'trade_registry_no'),
    registration_date = public.clean_text(p_payload ->> 'registration_date'),
    tax_office_account = public.clean_text(p_payload ->> 'tax_office_account'),
    authority_signature = public.clean_text(p_payload ->> 'authority_signature'),
    profession_group = public.clean_text(p_payload ->> 'profession_group'),
    status = public.clean_text(p_payload ->> 'status'),
    title = public.clean_text(p_payload ->> 'title'),
    officials = public.clean_text(p_payload ->> 'officials'),
    origin = public.clean_text(p_payload ->> 'origin'),
    vote_status = public.clean_text(p_payload ->> 'vote_status'),
    notes = public.clean_text(p_payload ->> 'notes'),
    district = public.clean_text(p_payload ->> 'district'),
    street = public.clean_text(p_payload ->> 'street'),
    registered_address = coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    phone_numbers = coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    gift = coalesce((p_payload ->> 'gift')::boolean, false),
    itso_status = public.clean_text(p_payload ->> 'itso_status'),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id and version = p_expected_version and deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  delete from public.record_contacts where record_id = p_id;
  insert into public.record_contacts (record_id, contact_person_id, position)
  select p_id, contact_id, ordinality::smallint
  from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);
  return updated;
end;
$$;

create or replace function public.apply_current_roster(
  p_source_file_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_id uuid;
  roster_count integer;
  active_count integer;
  removed_count integer;
  restored_count integer;
  missing_count integer;
  archive_order_base integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'INVALID_ROSTER' using errcode = '22023';
  end if;

  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));

  create temporary table current_roster_stage (
    source_order integer,
    member_registry_no text,
    trade_registry_no text,
    title text,
    registration_date text,
    tax_office_account text,
    authority_signature text
  ) on commit drop;

  insert into pg_temp.current_roster_stage
  select
    ordinality::integer,
    public.clean_text(item ->> 'member_registry_no'),
    public.clean_text(item ->> 'trade_registry_no'),
    public.clean_text(item ->> 'title'),
    public.clean_text(item ->> 'registration_date'),
    public.clean_text(item ->> 'tax_office_account'),
    public.clean_text(item ->> 'authority_signature')
  from jsonb_array_elements(p_rows) with ordinality as source(item, ordinality);

  select count(*) into roster_count from pg_temp.current_roster_stage;
  if roster_count > 10000
    or exists (
      select 1 from pg_temp.current_roster_stage
      where member_registry_no is null or title is null
    )
    or exists (
      select 1 from pg_temp.current_roster_stage
      group by member_registry_no having count(*) > 1
    )
    or exists (
      select 1 from pg_temp.current_roster_stage
      where trade_registry_no is not null
      group by trade_registry_no having count(*) > 1
    ) then
    raise exception 'INVALID_ROSTER' using errcode = '22023';
  end if;

  select count(*) into missing_count
  from pg_temp.current_roster_stage stage
  left join public.records record
    on record.member_registry_no = stage.member_registry_no
  where record.id is null;
  if missing_count > 0 then
    raise exception 'ROSTER_MEMBERS_NOT_FOUND: %', missing_count
      using errcode = 'P0001';
  end if;

  select count(*) into active_count
  from public.records where deleted_at is null;
  select coalesce(max(display_order), 0) into archive_order_base
  from public.records;
  select count(*) into removed_count
  from public.records record
  where record.deleted_at is null
    and not exists (
      select 1 from pg_temp.current_roster_stage stage
      where stage.member_registry_no = record.member_registry_no
    );
  select count(*) into restored_count
  from public.records record
  where record.deleted_at is not null
    and exists (
      select 1 from pg_temp.current_roster_stage stage
      where stage.member_registry_no = record.member_registry_no
    );

  insert into public.legacy_table_snapshots (
    label, source_file_name, record_count, created_by
  ) values (
    'Eski Tablo', coalesce(public.clean_text(p_source_file_name), 'guncel-liste.xlsx'),
    active_count, auth.uid()
  ) returning id into snapshot_id;

  insert into public.legacy_table_records (
    snapshot_id, original_record_id, record_data, contacts
  )
  select
    snapshot_id,
    record.id,
    to_jsonb(record),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', link.position,
          'contact_person_id', person.id,
          'display_name', person.display_name,
          'normalized_name', person.normalized_name
        ) order by link.position
      )
      from public.record_contacts link
      join public.contact_people person on person.id = link.contact_person_id
      where link.record_id = record.id
    ), '[]'::jsonb)
  from public.records record
  where record.deleted_at is null;

  -- Kurulumlar arasında constraint adları değişebilir. ALL yalnızca
  -- deferrable constraint'leri erteler ve belirli bir ada bağımlı değildir.
  set constraints all deferred;

  with absent as (
    select
      record.id,
      row_number() over (order by record.display_order, record.id)::integer as offset_no
    from public.records record
    where record.deleted_at is null
      and not exists (
        select 1 from pg_temp.current_roster_stage stage
        where stage.member_registry_no = record.member_registry_no
      )
  )
  update public.records record set
    display_order = archive_order_base + absent.offset_no,
    deleted_at = now(),
    deleted_by = auth.uid(),
    version = record.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  from absent where record.id = absent.id;

  update public.records record set
    display_order = stage.source_order,
    trade_registry_no = stage.trade_registry_no,
    title = stage.title,
    registration_date = stage.registration_date,
    tax_office_account = stage.tax_office_account,
    authority_signature = stage.authority_signature,
    deleted_at = null,
    deleted_by = null,
    version = record.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  from pg_temp.current_roster_stage stage
  where record.member_registry_no = stage.member_registry_no;

  return jsonb_build_object(
    'snapshot_id', snapshot_id,
    'snapshot_count', active_count,
    'current_count', roster_count,
    'removed_count', removed_count,
    'restored_count', restored_count
  );
end;
$$;

revoke all on function public.create_record(jsonb, uuid[]) from public;
revoke all on function public.update_record(uuid, integer, jsonb, uuid[]) from public;
revoke all on function public.apply_current_roster(text, jsonb) from public;
grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[]) to authenticated;
grant execute on function public.apply_current_roster(text, jsonb) to authenticated;
