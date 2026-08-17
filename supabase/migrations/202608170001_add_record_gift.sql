-- Kayıtlarda hediye durumunu tik alanı olarak saklar.
alter table public.records
  add column if not exists gift boolean not null default false;

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
    registered_address, phone_numbers, gift, created_by, updated_by
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

create or replace function public.set_record_gift(
  p_id uuid,
  p_expected_version integer,
  p_gift boolean
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

  update public.records
  set
    gift = p_gift,
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

-- İçe aktarma sırasında staged JSON içindeki hediye değerini mevcut import
-- fonksiyonunu değiştirmeden yeni/güncellenen kayda uygular.
create or replace function public.apply_import_gift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_batch_id uuid :=
    nullif(current_setting('app.import_batch_id', true), '')::uuid;
  imported_gift boolean;
begin
  if current_batch_id is null then
    return new;
  end if;

  select coalesce((import_row.data ->> 'gift')::boolean, false)
  into imported_gift
  from public.import_rows as import_row
  where import_row.batch_id = current_batch_id
    and public.clean_text(import_row.data ->> 'member_registry_no') =
      new.member_registry_no
  limit 1;

  new.gift := coalesce(imported_gift, false);
  return new;
end;
$$;

drop trigger if exists records_import_gift_trigger on public.records;
create trigger records_import_gift_trigger
before insert or update on public.records
for each row execute function public.apply_import_gift();

-- Giriş yapmadan görüntülenen güvenli özet kayıtlara hediye bilgisini ekler.
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
revoke all on function public.set_record_gift(uuid, integer, boolean)
  from public;
revoke all on function public.apply_import_gift() from public;
revoke all on function public.get_public_records() from public, authenticated;

grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[])
  to authenticated;
grant execute on function public.set_record_gift(uuid, integer, boolean)
  to authenticated;
grant execute on function public.get_public_records() to anon;
