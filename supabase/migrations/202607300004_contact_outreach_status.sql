-- Temas sorumlularına iletişim paketinin gönderilip gönderilmediğini takip eder.
alter table public.contact_people
  add column if not exists outreach_sent_at timestamptz,
  add column if not exists outreach_sent_by uuid
    references auth.users(id) on delete set null;

create or replace function public.set_contact_outreach_status(
  p_id uuid,
  p_sent boolean
)
returns public.contact_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_person public.contact_people;
  updated_person public.contact_people;
begin
  perform public.require_role(array['admin']::public.app_role[]);

  select *
  into old_person
  from public.contact_people
  where id = p_id
  for update;

  if old_person.id is null then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if (old_person.outreach_sent_at is not null) = p_sent then
    return old_person;
  end if;

  update public.contact_people
  set
    outreach_sent_at = case when p_sent then now() else null end,
    outreach_sent_by = case when p_sent then auth.uid() else null end,
    updated_at = now()
  where id = p_id
  returning * into updated_person;

  insert into public.audit_logs (
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    actor_id,
    version_from,
    version_to
  )
  select
    link.record_id,
    'update'::public.audit_action,
    jsonb_build_object('contact_person', to_jsonb(old_person)),
    jsonb_build_object('contact_person', to_jsonb(updated_person)),
    array['contacts'],
    auth.uid(),
    record.version,
    record.version
  from public.record_contacts as link
  join public.records as record on record.id = link.record_id
  where link.contact_person_id = p_id;

  return updated_person;
end;
$$;

revoke all on function public.set_contact_outreach_status(uuid, boolean)
  from public;
grant execute on function public.set_contact_outreach_status(uuid, boolean)
  to authenticated;
