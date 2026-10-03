-- set_record_color da aynı eski sürümlü istek akışının hedefi oldu. Eski adı
-- kaldırmak bu istekleri veritabanına ulaşmadan 404 ile sonlandırır.

create or replace function public.set_record_row_color(
  p_id uuid,
  p_expected_version integer,
  p_row_color text
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

  if p_row_color is not null
    and p_row_color not in ('yellow', 'green', 'red', 'blue') then
    raise exception 'INVALID_ROW_COLOR' using errcode = '22023';
  end if;

  update public.records
  set
    row_color = p_row_color,
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

revoke all on function public.set_record_row_color(uuid, integer, text) from public, anon;
grant execute on function public.set_record_row_color(uuid, integer, text) to authenticated;

drop function if exists public.set_record_color(uuid, integer, text);

notify pgrst, 'reload schema';
