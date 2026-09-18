-- Ana kayıt ve arşiv tablosunu yeni bir Eski Tablo snapshot'i oluşturmadan
-- fiziksel olarak temizler. Bağımsız legacy_table_* kopyalarına dokunmaz.
create or replace function public.clear_current_table_without_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));

  select count(*) into active_count from public.records;
  if active_count = 0 then
    raise exception 'CURRENT_TABLE_ALREADY_EMPTY' using errcode = 'P0001';
  end if;

  delete from public.records;

  return jsonb_build_object(
    'deleted_count', active_count,
    'current_count', 0
  );
end;
$$;

revoke all on function public.clear_current_table_without_snapshot() from public;
grant execute on function public.clear_current_table_without_snapshot() to authenticated;
