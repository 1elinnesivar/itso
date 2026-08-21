-- İTSO durumunu oy durumundan bağımsız bir seçim alanı olarak saklar.
alter table public.records
  add column if not exists itso_status text;

alter table public.records
  drop constraint if exists records_itso_status_check;
alter table public.records
  add constraint records_itso_status_check
  check (itso_status is null or itso_status in ('İTSO''DA', 'ONAYLANDI'));

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
    display_order, member_registry_no, trade_registry_no, profession_group,
    status, title, officials, origin, vote_status, notes, district, street,
    registered_address, phone_numbers, gift, itso_status,
    created_by, updated_by
  )
  values (
    coalesce((select max(display_order) + 1 from public.records), 1),
    public.clean_text(p_payload ->> 'member_registry_no'),
    public.clean_text(p_payload ->> 'trade_registry_no'),
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
    auth.uid(),
    auth.uid()
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

  update public.records
  set
    member_registry_no = public.clean_text(p_payload ->> 'member_registry_no'),
    trade_registry_no = public.clean_text(p_payload ->> 'trade_registry_no'),
    profession_group = public.clean_text(p_payload ->> 'profession_group'),
    status = public.clean_text(p_payload ->> 'status'),
    title = public.clean_text(p_payload ->> 'title'),
    officials = public.clean_text(p_payload ->> 'officials'),
    origin = public.clean_text(p_payload ->> 'origin'),
    vote_status = public.clean_text(p_payload ->> 'vote_status'),
    notes = public.clean_text(p_payload ->> 'notes'),
    district = public.clean_text(p_payload ->> 'district'),
    street = public.clean_text(p_payload ->> 'street'),
    registered_address =
      coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    phone_numbers =
      coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    gift = coalesce((p_payload ->> 'gift')::boolean, false),
    itso_status = public.clean_text(p_payload ->> 'itso_status'),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id
    and version = p_expected_version
    and deleted_at is null
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

create or replace function public.set_record_itso_status(
  p_id uuid,
  p_expected_version integer,
  p_itso_status text
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
  if p_itso_status is not null
    and p_itso_status not in ('İTSO''DA', 'ONAYLANDI') then
    raise exception 'INVALID_ITSO_STATUS' using errcode = '22023';
  end if;

  update public.records
  set
    itso_status = p_itso_status,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  return updated;
end;
$$;

-- Giriş yapmadan görüntülenen güvenli özet kayıtlara onay bilgisini ekler.
drop function if exists public.get_public_records();
create function public.get_public_records()
returns table (
  id uuid,
  display_order integer,
  profession_group text,
  status text,
  title text,
  district text,
  gift boolean,
  itso_status text,
  row_color text,
  version integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    record.id,
    record.display_order,
    record.profession_group,
    record.status,
    record.title,
    record.district,
    record.gift,
    record.itso_status,
    record.row_color,
    record.version,
    record.updated_at
  from public.records as record
  where record.deleted_at is null
  order by record.display_order
$$;

revoke all on function public.create_record(jsonb, uuid[]) from public;
revoke all on function public.update_record(uuid, integer, jsonb, uuid[])
  from public;
revoke all on function public.set_record_itso_status(uuid, integer, text)
  from public;
revoke all on function public.get_public_records() from public, authenticated;

grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[])
  to authenticated;
grant execute on function public.set_record_itso_status(uuid, integer, text)
  to authenticated;
grant execute on function public.get_public_records() to anon;
