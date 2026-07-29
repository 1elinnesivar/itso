-- Paylaşılan bağlantı üzerinden güvenli, girişsiz özet erişimi sağlar.
-- Telefon, açık adres, yetkili/temas isimleri ve notlar view'a dahil edilmez.
revoke all on public.records, public.contact_people, public.record_contacts from anon;

drop policy if exists "records_public_read" on public.records;
drop policy if exists "contacts_public_read" on public.contact_people;
drop policy if exists "record_contacts_public_read" on public.record_contacts;

drop view if exists public.public_records;

create or replace function public.get_public_records()
returns table (
  id uuid,
  display_order integer,
  profession_group text,
  status text,
  title text,
  district text,
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
    record.row_color,
    record.version,
    record.updated_at
  from public.records as record
  where record.deleted_at is null
  order by record.display_order
$$;

revoke all on function public.get_public_records() from public, authenticated;
grant execute on function public.get_public_records() to anon;
