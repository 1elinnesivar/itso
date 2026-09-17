-- Eski tablo kopyalarını ana tablodan bağımsız olarak düzenlenebilir yapar.
alter table public.legacy_table_records
  add column if not exists version integer not null default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists legacy_table_records_active_idx
  on public.legacy_table_records (snapshot_id, deleted_at);

create or replace function public.create_legacy_record(
  p_snapshot_id uuid,
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  next_order integer;
  new_data jsonb;
  new_contacts jsonb;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  perform 1 from public.legacy_table_snapshots where id = p_snapshot_id;
  if not found then raise exception 'SNAPSHOT_NOT_FOUND' using errcode = 'P0002'; end if;
  if cardinality(p_contact_ids) <> (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;
  if public.clean_text(p_payload ->> 'member_registry_no') is null
    or public.clean_text(p_payload ->> 'title') is null then
    raise exception 'INVALID_RECORD' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.legacy_table_records
    where snapshot_id = p_snapshot_id and deleted_at is null
      and record_data ->> 'member_registry_no' = public.clean_text(p_payload ->> 'member_registry_no')
  ) then raise exception 'DUPLICATE_MEMBER_REGISTRY' using errcode = '23505'; end if;

  select coalesce(max((record_data ->> 'display_order')::integer), 0) + 1
  into next_order
  from public.legacy_table_records
  where snapshot_id = p_snapshot_id and deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', source.ordinality,
    'contact_person_id', person.id,
    'display_name', person.display_name,
    'normalized_name', person.normalized_name
  ) order by source.ordinality), '[]'::jsonb)
  into new_contacts
  from unnest(p_contact_ids) with ordinality source(contact_id, ordinality)
  join public.contact_people person on person.id = source.contact_id;

  new_data := jsonb_build_object(
    'id', new_id, 'display_order', next_order,
    'member_registry_no', public.clean_text(p_payload ->> 'member_registry_no'),
    'trade_registry_no', public.clean_text(p_payload ->> 'trade_registry_no'),
    'registration_date', public.clean_text(p_payload ->> 'registration_date'),
    'tax_office_account', public.clean_text(p_payload ->> 'tax_office_account'),
    'authority_signature', public.clean_text(p_payload ->> 'authority_signature'),
    'profession_group', coalesce(public.clean_text(p_payload ->> 'profession_group'), ''),
    'status', coalesce(public.clean_text(p_payload ->> 'status'), ''),
    'title', public.clean_text(p_payload ->> 'title'),
    'officials', public.clean_text(p_payload ->> 'officials'),
    'origin', public.clean_text(p_payload ->> 'origin'),
    'vote_status', public.clean_text(p_payload ->> 'vote_status'),
    'notes', public.clean_text(p_payload ->> 'notes'),
    'district', public.clean_text(p_payload ->> 'district'),
    'street', public.clean_text(p_payload ->> 'street'),
    'registered_address', coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    'phone_numbers', coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    'gift', coalesce((p_payload ->> 'gift')::boolean, false),
    'itso_status', public.clean_text(p_payload ->> 'itso_status'),
    'row_color', null,
    'version', 1, 'created_at', now(), 'created_by', auth.uid(),
    'updated_at', now(), 'updated_by', auth.uid(),
    'deleted_at', null, 'deleted_by', null
  );

  insert into public.legacy_table_records (
    snapshot_id, original_record_id, record_data, contacts, version
  ) values (p_snapshot_id, new_id, new_data, new_contacts, 1);
  return new_data;
end;
$$;

create or replace function public.update_legacy_record(
  p_snapshot_id uuid,
  p_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_data jsonb;
  new_contacts jsonb;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if cardinality(p_contact_ids) <> (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.legacy_table_records
    where snapshot_id = p_snapshot_id and original_record_id <> p_id and deleted_at is null
      and record_data ->> 'member_registry_no' = public.clean_text(p_payload ->> 'member_registry_no')
  ) then raise exception 'DUPLICATE_MEMBER_REGISTRY' using errcode = '23505'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', source.ordinality,
    'contact_person_id', person.id,
    'display_name', person.display_name,
    'normalized_name', person.normalized_name
  ) order by source.ordinality), '[]'::jsonb)
  into new_contacts
  from unnest(p_contact_ids) with ordinality source(contact_id, ordinality)
  join public.contact_people person on person.id = source.contact_id;

  update public.legacy_table_records legacy set
    record_data = legacy.record_data || jsonb_build_object(
      'member_registry_no', public.clean_text(p_payload ->> 'member_registry_no'),
      'trade_registry_no', public.clean_text(p_payload ->> 'trade_registry_no'),
      'registration_date', public.clean_text(p_payload ->> 'registration_date'),
      'tax_office_account', public.clean_text(p_payload ->> 'tax_office_account'),
      'authority_signature', public.clean_text(p_payload ->> 'authority_signature'),
      'profession_group', coalesce(public.clean_text(p_payload ->> 'profession_group'), ''),
      'status', coalesce(public.clean_text(p_payload ->> 'status'), ''),
      'title', public.clean_text(p_payload ->> 'title'),
      'officials', public.clean_text(p_payload ->> 'officials'),
      'origin', public.clean_text(p_payload ->> 'origin'),
      'vote_status', public.clean_text(p_payload ->> 'vote_status'),
      'notes', public.clean_text(p_payload ->> 'notes'),
      'district', public.clean_text(p_payload ->> 'district'),
      'street', public.clean_text(p_payload ->> 'street'),
      'registered_address', coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
      'phone_numbers', coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
      'gift', coalesce((p_payload ->> 'gift')::boolean, false),
      'itso_status', public.clean_text(p_payload ->> 'itso_status'),
      'version', legacy.version + 1, 'updated_at', now(), 'updated_by', auth.uid()
    ),
    contacts = new_contacts,
    version = legacy.version + 1
  where snapshot_id = p_snapshot_id and original_record_id = p_id
    and version = p_expected_version and deleted_at is null
  returning record_data into updated_data;
  if updated_data is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return updated_data;
end;
$$;

create or replace function public.patch_legacy_record(
  p_snapshot_id uuid,
  p_id uuid,
  p_expected_version integer,
  p_field text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare updated_data jsonb;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if p_field not in ('row_color', 'gift', 'itso_status') then
    raise exception 'INVALID_FIELD' using errcode = '22023';
  end if;
  if p_field = 'row_color' and p_value <> 'null'::jsonb
    and p_value #>> '{}' not in ('red', 'yellow', 'green', 'blue') then
    raise exception 'INVALID_COLOR' using errcode = '22023';
  end if;

  update public.legacy_table_records legacy set
    record_data = jsonb_set(legacy.record_data, array[p_field], coalesce(p_value, 'null'::jsonb), true)
      || jsonb_build_object('version', legacy.version + 1, 'updated_at', now(), 'updated_by', auth.uid()),
    version = legacy.version + 1
  where snapshot_id = p_snapshot_id and original_record_id = p_id
    and version = p_expected_version and deleted_at is null
  returning record_data into updated_data;
  if updated_data is null then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
  return updated_data;
end;
$$;

create or replace function public.soft_delete_legacy_record(
  p_snapshot_id uuid,
  p_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_role(array['admin']::public.app_role[]);
  update public.legacy_table_records legacy set
    deleted_at = now(), deleted_by = auth.uid(), version = legacy.version + 1,
    record_data = legacy.record_data || jsonb_build_object(
      'version', legacy.version + 1, 'deleted_at', now(),
      'deleted_by', auth.uid(), 'updated_at', now(), 'updated_by', auth.uid()
    )
  where snapshot_id = p_snapshot_id and original_record_id = p_id
    and version = p_expected_version and deleted_at is null;
  if not found then raise exception 'VERSION_CONFLICT' using errcode = '40001'; end if;
end;
$$;

create or replace function public.rename_legacy_contact(
  p_snapshot_id uuid,
  p_id uuid,
  p_expected_name text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := public.clean_text(p_display_name);
  normalized text;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if cleaned is null then raise exception 'CONTACT_NAME_REQUIRED' using errcode = '22023'; end if;
  if not exists (
    select 1
    from public.legacy_table_records legacy,
      jsonb_array_elements(legacy.contacts) contact
    where legacy.snapshot_id = p_snapshot_id and legacy.deleted_at is null
      and contact ->> 'contact_person_id' = p_id::text
      and contact ->> 'display_name' = p_expected_name
  ) then raise exception 'CONTACT_CHANGED' using errcode = '40001'; end if;

  normalized := lower(regexp_replace(cleaned, '\s+', ' ', 'g'));
  with changed as (
    select
      legacy.original_record_id,
      jsonb_agg(
        case when contact ->> 'contact_person_id' = p_id::text
          then contact || jsonb_build_object(
            'display_name', cleaned, 'normalized_name', normalized
          )
          else contact
        end
        order by (contact ->> 'position')::integer
      ) as contacts
    from public.legacy_table_records legacy,
      jsonb_array_elements(legacy.contacts) contact
    where legacy.snapshot_id = p_snapshot_id and legacy.deleted_at is null
    group by legacy.original_record_id
  )
  update public.legacy_table_records legacy set
    contacts = changed.contacts
  from changed
  where legacy.snapshot_id = p_snapshot_id
    and legacy.original_record_id = changed.original_record_id
    and legacy.contacts is distinct from changed.contacts;
end;
$$;

revoke all on function public.create_legacy_record(uuid, jsonb, uuid[]) from public;
revoke all on function public.update_legacy_record(uuid, uuid, integer, jsonb, uuid[]) from public;
revoke all on function public.patch_legacy_record(uuid, uuid, integer, text, jsonb) from public;
revoke all on function public.soft_delete_legacy_record(uuid, uuid, integer) from public;
revoke all on function public.rename_legacy_contact(uuid, uuid, text, text) from public;
grant execute on function public.create_legacy_record(uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.update_legacy_record(uuid, uuid, integer, jsonb, uuid[]) to authenticated;
grant execute on function public.patch_legacy_record(uuid, uuid, integer, text, jsonb) to authenticated;
grant execute on function public.soft_delete_legacy_record(uuid, uuid, integer) to authenticated;
grant execute on function public.rename_legacy_contact(uuid, uuid, text, text) to authenticated;
