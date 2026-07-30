-- Bir kayıtta dört adetten fazla temas sorumlusu tutulabilmesini sağlar.
alter table public.record_contacts
  drop constraint if exists record_contacts_position_check;

alter table public.record_contacts
  drop constraint if exists record_contacts_position_positive;

alter table public.record_contacts
  add constraint record_contacts_position_positive
  check (position > 0);

create or replace function public.create_record(
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
)
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.records;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cardinality(p_contact_ids) <>
    (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.records.display_order'));
  insert into public.records (
    display_order, member_registry_no, trade_registry_no, profession_group,
    status, title, officials, origin, vote_status, notes, district, street,
    registered_address, phone_numbers, created_by, updated_by
  )
  values (
    coalesce((select max(display_order) + 1 from public.records), 1),
    public.clean_text(p_payload ->> 'member_registry_no'),
    public.clean_text(p_payload ->> 'trade_registry_no'),
    public.clean_text(p_payload ->> 'profession_group'),
    public.clean_text(p_payload ->> 'status'),
    public.clean_text(p_payload ->> 'title'),
    public.clean_text(p_payload ->> 'officials'),
    public.clean_text(p_payload ->> 'origin'),
    public.clean_text(p_payload ->> 'vote_status'),
    public.clean_text(p_payload ->> 'notes'),
    public.clean_text(p_payload ->> 'district'),
    public.clean_text(p_payload ->> 'street'),
    coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    auth.uid(),
    auth.uid()
  )
  returning * into created;

  insert into public.record_contacts (record_id, contact_person_id, position)
  select created.id, contact_id, ordinality::smallint
  from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);

  return created;
end;
$$;

create or replace function public.update_record(
  p_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_contact_ids uuid[] default '{}'
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
  if cardinality(p_contact_ids) <>
    (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  update public.records
  set
    member_registry_no = public.clean_text(p_payload ->> 'member_registry_no'),
    trade_registry_no = public.clean_text(p_payload ->> 'trade_registry_no'),
    profession_group = public.clean_text(p_payload ->> 'profession_group'),
    status = public.clean_text(p_payload ->> 'status'),
    title = public.clean_text(p_payload ->> 'title'),
    officials = public.clean_text(p_payload ->> 'officials'),
    origin = public.clean_text(p_payload ->> 'origin'),
    vote_status = public.clean_text(p_payload ->> 'vote_status'),
    notes = public.clean_text(p_payload ->> 'notes'),
    district = public.clean_text(p_payload ->> 'district'),
    street = public.clean_text(p_payload ->> 'street'),
    registered_address =
      coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    phone_numbers =
      coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
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

  delete from public.record_contacts where record_id = p_id;
  insert into public.record_contacts (record_id, contact_person_id, position)
  select p_id, contact_id, ordinality::smallint
  from unnest(p_contact_ids) with ordinality as c(contact_id, ordinality);

  return updated;
end;
$$;

create or replace function public.apply_import(p_batch_id uuid)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.import_batches;
  staged public.import_rows;
  payload jsonb;
  target public.records;
  target_id uuid;
  contact_name text;
  contact_id uuid;
  contact_position smallint;
begin
  perform public.require_role(array['admin']::public.app_role[]);

  select *
  into batch
  from public.import_batches
  where id = p_batch_id
    and created_by = auth.uid()
    and status = 'staged'
  for update;

  if batch.id is null then
    raise exception 'IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.import_batches set status = 'applying' where id = batch.id;
  perform set_config('app.import_batch_id', batch.id::text, true);
  perform pg_advisory_xact_lock(hashtext('public.records.display_order'));
  set constraints all deferred;

  for staged in
    select *
    from public.import_rows
    where batch_id = batch.id
      and category in ('new', 'changed')
    order by row_number
  loop
    payload := staged.data;

    if public.clean_text(payload ->> 'member_registry_no') is null
      or public.clean_text(payload ->> 'title') is null
      or public.clean_text(payload ->> 'status') is null
      or public.clean_text(payload ->> 'profession_group') is null then
      raise exception 'INVALID_IMPORT_ROW:%', staged.row_number
        using errcode = '22023';
    end if;

    select *
    into target
    from public.records
    where member_registry_no =
      public.clean_text(payload ->> 'member_registry_no');

    if staged.category = 'new' then
      if target.id is not null then
        raise exception 'IMPORT_CONFLICT:%', staged.row_number
          using errcode = '40001';
      end if;

      insert into public.records (
        display_order, member_registry_no, trade_registry_no, profession_group,
        status, title, officials, origin, vote_status, notes, district, street,
        registered_address, phone_numbers, created_by, updated_by
      )
      values (
        (payload ->> 'display_order')::integer,
        public.clean_text(payload ->> 'member_registry_no'),
        public.clean_text(payload ->> 'trade_registry_no'),
        public.clean_text(payload ->> 'profession_group'),
        public.clean_text(payload ->> 'status'),
        public.clean_text(payload ->> 'title'),
        public.clean_text(payload ->> 'officials'),
        public.clean_text(payload ->> 'origin'),
        public.clean_text(payload ->> 'vote_status'),
        public.clean_text(payload ->> 'notes'),
        public.clean_text(payload ->> 'district'),
        public.clean_text(payload ->> 'street'),
        coalesce(public.clean_text(payload ->> 'registered_address'), ''),
        coalesce(public.clean_text(payload ->> 'phone_numbers'), ''),
        auth.uid(),
        auth.uid()
      )
      returning id into target_id;
    else
      if target.id is null
        or target.deleted_at is not null
        or target.version <> staged.staged_version then
        raise exception 'IMPORT_CONFLICT:%', staged.row_number
          using errcode = '40001';
      end if;

      update public.records
      set
        display_order = (payload ->> 'display_order')::integer,
        trade_registry_no =
          public.clean_text(payload ->> 'trade_registry_no'),
        profession_group =
          public.clean_text(payload ->> 'profession_group'),
        status = public.clean_text(payload ->> 'status'),
        title = public.clean_text(payload ->> 'title'),
        officials = public.clean_text(payload ->> 'officials'),
        origin = public.clean_text(payload ->> 'origin'),
        vote_status = public.clean_text(payload ->> 'vote_status'),
        notes = public.clean_text(payload ->> 'notes'),
        district = public.clean_text(payload ->> 'district'),
        street = public.clean_text(payload ->> 'street'),
        registered_address =
          coalesce(public.clean_text(payload ->> 'registered_address'), ''),
        phone_numbers =
          coalesce(public.clean_text(payload ->> 'phone_numbers'), ''),
        version = version + 1,
        updated_at = now(),
        updated_by = auth.uid()
      where id = target.id
        and version = staged.staged_version
      returning id into target_id;

      delete from public.record_contacts where record_id = target_id;
    end if;

    contact_position := 0;
    for contact_name in
      select value
      from jsonb_array_elements_text(
        coalesce(payload -> 'contact_names', '[]'::jsonb)
      )
    loop
      contact_position := contact_position + 1;

      insert into public.contact_people (display_name, normalized_name)
      values (
        public.clean_text(contact_name),
        lower(
          regexp_replace(public.clean_text(contact_name), '\s+', ' ', 'g')
        )
      )
      on conflict (normalized_name) do update
        set updated_at = public.contact_people.updated_at
      returning id into contact_id;

      insert into public.record_contacts (
        record_id,
        contact_person_id,
        position
      )
      values (target_id, contact_id, contact_position);
    end loop;
  end loop;

  update public.import_batches
  set status = 'applied', applied_at = now()
  where id = batch.id
  returning * into batch;

  return batch;
end;
$$;

revoke all on function public.create_record(jsonb, uuid[]) from public;
revoke all on function public.update_record(uuid, integer, jsonb, uuid[])
  from public;
revoke all on function public.apply_import(uuid) from public;

grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[])
  to authenticated;
grant execute on function public.apply_import(uuid) to authenticated;
