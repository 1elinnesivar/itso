-- Daha önce kurulmuş temizleme fonksiyonunu Supabase safe-update
-- denetimiyle uyumlu hale getirir.
create or replace function public.clear_current_table_without_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_count integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));

  select count(*) into record_count from public.records;
  if record_count = 0 then
    raise exception 'CURRENT_TABLE_ALREADY_EMPTY' using errcode = 'P0001';
  end if;

  -- id bir primary key olduğu için bu koşul bütün kayıtları kapsar.
  delete from public.records where id is not null;

  return jsonb_build_object(
    'deleted_count', record_count,
    'current_count', 0
  );
end;
$$;

revoke all on function public.clear_current_table_without_snapshot() from public;
grant execute on function public.clear_current_table_without_snapshot() to authenticated;
