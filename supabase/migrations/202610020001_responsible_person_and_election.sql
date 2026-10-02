-- Güncel tabloya SORUMLU KİŞİ ve SEÇİME GELDİ alanlarını ekler.
-- Kayıt Tarihi, Vergi Dairesi, Yetki / İmza, TEMAS, MAHALLE ve CADDE
-- verileri silinmez; yalnız güncel tablo arayüzünden kaldırılır.
-- update_record artık payload'da bulunmayan bu alanları ve temasları korur.

create table if not exists public.responsible_people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.responsible_people enable row level security;

drop policy if exists "responsible_people_read" on public.responsible_people;
create policy "responsible_people_read" on public.responsible_people
for select to authenticated using (true);

revoke all on public.responsible_people from anon, authenticated;
grant select on public.responsible_people to authenticated;

-- Türkçe İ/I harflerini doğru küçültür ve fazla boşlukları birleştirir.
create or replace function public.normalize_responsible_name(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(replace(replace(
    regexp_replace(btrim(value), '\s+', ' ', 'g'), 'İ', 'i'), 'I', 'ı'))
$$;

insert into public.responsible_people (display_name, normalized_name, sort_order)
select name, public.normalize_responsible_name(name), ordinality::integer
from unnest(array[
  'Alican YAVAŞ',
  'Ahmet ÖZBEK',
  'Sevda ÖZCAN',
  'Nurettin İNCİ',
  'Berat TÜRKOĞLU',
  'Osman BALAÇİÇEK',
  'Barış SERBEST',
  'Amine Merve ÖZÜPEK',
  'Burhan ERGÜN',
  'Muhammed GAZİ',
  'LEVENT ÇALIŞKAN',
  'Yakup Mete DEMİR',
  'Gökhan KAYA'
]) with ordinality as source(name, ordinality)
on conflict (normalized_name) do nothing;

alter table public.records
  add column if not exists responsible_person_id uuid
    references public.responsible_people(id) on delete restrict;
alter table public.records
  add column if not exists attended_election boolean not null default false;

create index if not exists records_responsible_person_id_idx
  on public.records (responsible_person_id);

create or replace function public.add_responsible_person(p_display_name text)
returns public.responsible_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := regexp_replace(public.clean_text(p_display_name), '\s+', ' ', 'g');
  normalized text;
  person public.responsible_people;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cleaned is null then
    raise exception 'RESPONSIBLE_NAME_REQUIRED' using errcode = '22023';
  end if;
  normalized := public.normalize_responsible_name(cleaned);
  perform pg_advisory_xact_lock(hashtext('public.responsible_people.sort_order'));
  insert into public.responsible_people (display_name, normalized_name, sort_order)
  values (
    cleaned,
    normalized,
    coalesce((select max(sort_order) + 1 from public.responsible_people), 1)
  )
  on conflict (normalized_name) do update
    set display_name = public.responsible_people.display_name
  returning * into person;
  return person;
end;
$$;

create or replace function public.set_record_responsible_person(
  p_id uuid,
  p_expected_version integer,
  p_responsible_person_id uuid
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
    responsible_person_id = p_responsible_person_id,
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

create or replace function public.set_record_attended_election(
  p_id uuid,
  p_expected_version integer,
  p_attended boolean
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
    attended_election = p_attended,
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
    responsible_person_id, attended_election,
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
    public.clean_text(p_payload ->> 'responsible_person_id')::uuid,
    coalesce((p_payload ->> 'attended_election')::boolean, false),
    auth.uid(), auth.uid()
  )
  returning * into created;

  insert into public.record_contacts (record_id, contact_person_id, position)
  select created.id, contact_id, ordinality::smallint
  from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);
  return created;
end;
$$;

-- Güncel tablo formu gizlenen alanları ve temasları göndermez. Payload'da
-- bulunmayan alanlar ve null p_contact_ids mevcut veriyi değiştirmez.
create or replace function public.update_record(
  p_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_contact_ids uuid[] default null
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
  if p_contact_ids is not null and cardinality(p_contact_ids) <>
    (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  update public.records record set
    member_registry_no = public.clean_text(p_payload ->> 'member_registry_no'),
    trade_registry_no = public.clean_text(p_payload ->> 'trade_registry_no'),
    registration_date = case when p_payload ? 'registration_date'
      then public.clean_text(p_payload ->> 'registration_date')
      else record.registration_date end,
    tax_office_account = case when p_payload ? 'tax_office_account'
      then public.clean_text(p_payload ->> 'tax_office_account')
      else record.tax_office_account end,
    authority_signature = case when p_payload ? 'authority_signature'
      then public.clean_text(p_payload ->> 'authority_signature')
      else record.authority_signature end,
    profession_group = public.clean_text(p_payload ->> 'profession_group'),
    status = public.clean_text(p_payload ->> 'status'),
    title = public.clean_text(p_payload ->> 'title'),
    officials = public.clean_text(p_payload ->> 'officials'),
    origin = public.clean_text(p_payload ->> 'origin'),
    vote_status = public.clean_text(p_payload ->> 'vote_status'),
    notes = public.clean_text(p_payload ->> 'notes'),
    district = case when p_payload ? 'district'
      then public.clean_text(p_payload ->> 'district')
      else record.district end,
    street = case when p_payload ? 'street'
      then public.clean_text(p_payload ->> 'street')
      else record.street end,
    registered_address = coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    phone_numbers = coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    gift = coalesce((p_payload ->> 'gift')::boolean, false),
    itso_status = public.clean_text(p_payload ->> 'itso_status'),
    responsible_person_id = case when p_payload ? 'responsible_person_id'
      then public.clean_text(p_payload ->> 'responsible_person_id')::uuid
      else record.responsible_person_id end,
    attended_election = case when p_payload ? 'attended_election'
      then coalesce((p_payload ->> 'attended_election')::boolean, false)
      else record.attended_election end,
    version = record.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where record.id = p_id
    and record.version = p_expected_version
    and record.deleted_at is null
  returning record.* into updated;

  if updated.id is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_contact_ids is not null then
    delete from public.record_contacts where record_id = p_id;
    insert into public.record_contacts (record_id, contact_person_id, position)
    select p_id, contact_id, ordinality::smallint
    from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);
  end if;
  return updated;
end;
$$;

revoke all on function public.add_responsible_person(text) from public, anon;
revoke all on function public.set_record_responsible_person(uuid, integer, uuid) from public, anon;
revoke all on function public.set_record_attended_election(uuid, integer, boolean) from public, anon;
revoke all on function public.create_record(jsonb, uuid[]) from public;
revoke all on function public.update_record(uuid, integer, jsonb, uuid[]) from public;
grant execute on function public.add_responsible_person(text) to authenticated;
grant execute on function public.set_record_responsible_person(uuid, integer, uuid) to authenticated;
grant execute on function public.set_record_attended_election(uuid, integer, boolean) to authenticated;
grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[]) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'responsible_people'
  ) then
    alter publication supabase_realtime add table public.responsible_people;
  end if;
end
$$;
