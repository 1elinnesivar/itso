-- Ortak temas sorumlusu adlarını yetki ve eşzamanlılık kontrolüyle günceller.
create or replace function public.rename_contact_person(
  p_id uuid,
  p_expected_name text,
  p_display_name text
)
returns public.contact_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := public.clean_text(p_display_name);
  normalized text;
  old_person public.contact_people;
  updated_person public.contact_people;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);

  if cleaned is null then
    raise exception 'CONTACT_NAME_REQUIRED' using errcode = '22023';
  end if;

  select *
  into old_person
  from public.contact_people
  where id = p_id
  for update;

  if old_person.id is null then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if old_person.display_name is distinct from p_expected_name then
    raise exception 'CONTACT_CHANGED' using errcode = '40001';
  end if;

  normalized := lower(regexp_replace(cleaned, '\s+', ' ', 'g'));

  update public.contact_people
  set
    display_name = cleaned,
    normalized_name = normalized,
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

revoke all on function public.rename_contact_person(uuid, text, text)
  from public;
grant execute on function public.rename_contact_person(uuid, text, text)
  to authenticated;
