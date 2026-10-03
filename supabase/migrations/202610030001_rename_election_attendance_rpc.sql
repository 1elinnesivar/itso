-- set_record_attended_election çağrıları saniyede binlerce eski sürümlü istekle
-- PostgREST bağlantı havuzunu doldurdu. Eski adı kaldırmak bu istekleri
-- veritabanına ulaşmadan 404 ile sonlandırır; uygulama yeni adı kullanır.

create or replace function public.set_record_election_attendance(
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

revoke all on function public.set_record_election_attendance(uuid, integer, boolean)
  from public, anon;
grant execute on function public.set_record_election_attendance(uuid, integer, boolean)
  to authenticated;

drop function if exists public.set_record_attended_election(uuid, integer, boolean);

notify pgrst, 'reload schema';
