-- Mevcut aktif tabloyu değiştirilemez bir anlık görüntüye kopyalar ve
-- fiziksel veri silmeden ana tabloyu boş hale getirir.
create or replace function public.archive_current_table()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_snapshot_id uuid;
  active_count integer;
  order_base integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));

  select count(*)
  into active_count
  from public.records
  where deleted_at is null;

  select coalesce(max(display_order), 0)
  into order_base
  from public.records;

  if active_count = 0 then
    raise exception 'CURRENT_TABLE_ALREADY_EMPTY' using errcode = 'P0001';
  end if;

  insert into public.legacy_table_snapshots (
    label, source_file_name, record_count, created_by
  ) values (
    'Eski Tablo', 'Ana tablo aktarım öncesi', active_count, auth.uid()
  ) returning id into new_snapshot_id;

  insert into public.legacy_table_records (
    snapshot_id, original_record_id, record_data, contacts
  )
  select
    new_snapshot_id,
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

  -- Eski kayıtların sıra numaralarını aktif listenin kullanacağı
  -- 1..N aralığından taşır. Snapshot'ta özgün sıra korunur.
  with moving as (
    select
      id,
      row_number() over (order by display_order, id)::integer as offset_no
    from public.records
    where deleted_at is null
  )
  update public.records record set
    display_order = order_base + moving.offset_no,
    deleted_at = now(),
    deleted_by = auth.uid(),
    version = record.version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  from moving
  where record.id = moving.id;

  return jsonb_build_object(
    'snapshot_id', new_snapshot_id,
    'snapshot_count', active_count,
    'current_count', 0
  );
end;
$$;

revoke all on function public.archive_current_table() from public;
grant execute on function public.archive_current_table() to authenticated;
