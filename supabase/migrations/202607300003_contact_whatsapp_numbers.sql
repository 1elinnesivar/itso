-- Temas sorumlularının WhatsApp numaralarını admin kontrollü olarak saklar.
alter table public.contact_people
  add column if not exists whatsapp_number text;

create or replace function public.normalize_whatsapp_number(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
  mobile_match text;
begin
  mobile_match := substring(digits from '((90|0)?5[0-9]{9})');
  if mobile_match is not null then
    digits := mobile_match;
  end if;
  if digits like '0090%' then
    digits := substring(digits from 3);
  end if;
  if length(digits) = 11 and digits like '0%' then
    digits := '90' || substring(digits from 2);
  elsif length(digits) = 10 and digits like '5%' then
    digits := '90' || digits;
  end if;
  if length(digits) < 10 or length(digits) > 15 then
    return null;
  end if;
  return digits;
end;
$$;

update public.contact_people
set whatsapp_number = public.normalize_whatsapp_number(
  substring(display_name from '\(([^)]*[0-9][^)]*)\)')
)
where whatsapp_number is null
  and display_name ~ '\([^)]*[0-9][^)]*\)';

create or replace function public.get_contact_whatsapp_number(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result text;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  select whatsapp_number
  into result
  from public.contact_people
  where id = p_id;
  return result;
end;
$$;

create or replace function public.set_contact_whatsapp_number(
  p_id uuid,
  p_phone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_whatsapp_number(p_phone);
  old_person public.contact_people;
  updated_person public.contact_people;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if normalized is null then
    raise exception 'INVALID_WHATSAPP_NUMBER' using errcode = '22023';
  end if;

  select *
  into old_person
  from public.contact_people
  where id = p_id
  for update;

  if old_person.id is null then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.contact_people
  set whatsapp_number = normalized, updated_at = now()
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
  where link.contact_person_id = p_id
    and old_person.whatsapp_number is distinct from normalized;

  return normalized;
end;
$$;

revoke all on function public.normalize_whatsapp_number(text) from public;
revoke all on function public.get_contact_whatsapp_number(uuid) from public;
revoke all on function public.set_contact_whatsapp_number(uuid, text) from public;

grant execute on function public.get_contact_whatsapp_number(uuid)
  to authenticated;
grant execute on function public.set_contact_whatsapp_number(uuid, text)
  to authenticated;
