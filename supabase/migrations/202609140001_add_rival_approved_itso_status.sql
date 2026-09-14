-- İTSO durumuna "RAKİP ONAYLATTI" seçeneğini ekler.
alter table public.records
  drop constraint if exists records_itso_status_check;

alter table public.records
  add constraint records_itso_status_check
  check (
    itso_status is null
    or itso_status in ('İTSO''DA', 'ONAYLANDI', 'RAKİP ONAYLATTI')
  );

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
    and p_itso_status not in ('İTSO''DA', 'ONAYLANDI', 'RAKİP ONAYLATTI') then
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

revoke all on function public.set_record_itso_status(uuid, integer, text)
  from public;
grant execute on function public.set_record_itso_status(uuid, integer, text)
  to authenticated;
