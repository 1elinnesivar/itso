-- Ana tabloyu yeni bir Eski Tablo snapshot'i oluşturmadan boşaltır.
-- Kayıtlar fiziksel olarak yok edilmez; sonraki sicil eşleştirmesinde veri
-- kaybı olmadan yeniden etkinleştirilebilmeleri için dahili arşivde tutulur.
create or replace function public.clear_current_table_without_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
  order_base integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));

  select count(*) into active_count
  from public.records where deleted_at is null;
  if active_count = 0 then
    raise exception 'CURRENT_TABLE_ALREADY_EMPTY' using errcode = 'P0001';
  end if;

  select coalesce(max(display_order), 0) into order_base
  from public.records;

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
    'cleared_count', active_count,
    'current_count', 0
  );
end;
$$;

revoke all on function public.clear_current_table_without_snapshot() from public;
grant execute on function public.clear_current_table_without_snapshot() to authenticated;
