create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.audit_action as enum ('insert', 'update', 'delete', 'restore', 'import');
create type public.import_status as enum ('staged', 'applying', 'applied', 'failed');
create type public.import_category as enum ('new', 'changed', 'same', 'invalid', 'deleted_conflict');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.records (
  id uuid primary key default gen_random_uuid(),
  display_order integer not null check (display_order > 0),
  member_registry_no text not null unique check (btrim(member_registry_no) <> ''),
  trade_registry_no text,
  profession_group text not null check (btrim(profession_group) <> ''),
  status text not null check (btrim(status) <> ''),
  title text not null check (btrim(title) <> ''),
  officials text,
  origin text,
  vote_status text,
  notes text,
  district text,
  street text,
  registered_address text not null,
  phone_numbers text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint records_display_order_unique unique (display_order) deferrable initially immediate,
  constraint records_trade_registry_unique unique (trade_registry_no) deferrable initially immediate,
  constraint records_trade_registry_not_blank
    check (trade_registry_no is null or btrim(trade_registry_no) <> '')
);

create table public.contact_people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.record_contacts (
  record_id uuid not null references public.records(id) on delete cascade,
  contact_person_id uuid not null references public.contact_people(id) on delete restrict,
  position smallint not null check (position between 1 and 4),
  primary key (record_id, position),
  unique (record_id, contact_person_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status public.import_status not null default 'staged',
  counts jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table public.import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  data jsonb not null,
  category public.import_category not null,
  validation_errors text[] not null default '{}',
  record_id uuid references public.records(id) on delete set null,
  staged_version integer,
  unique (batch_id, row_number)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  record_id uuid not null,
  action public.audit_action not null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] not null default '{}',
  actor_id uuid references auth.users(id) on delete set null,
  version_from integer,
  version_to integer,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index records_active_order_idx on public.records (display_order) where deleted_at is null;
create index records_status_idx on public.records (status);
create index records_district_idx on public.records (district);
create index records_vote_status_idx on public.records (vote_status);
create index records_origin_idx on public.records (origin);
create index record_contacts_person_idx on public.record_contacts (contact_person_id);
create index audit_logs_record_created_idx on public.audit_logs (record_id, created_at desc);
create index import_rows_batch_category_idx on public.import_rows (batch_id, category);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin', 'editor'), false)
$$;

create or replace function public.require_role(allowed public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (public.current_user_role() = any(allowed)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.changed_json_fields(old_value jsonb, new_value jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(key order by key), '{}')
  from (
    select key from jsonb_each(coalesce(old_value, '{}'::jsonb))
    union
    select key from jsonb_each(coalesce(new_value, '{}'::jsonb))
  ) keys
  where old_value -> key is distinct from new_value -> key
$$;

create or replace function public.audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb;
  new_json jsonb;
  event_action public.audit_action;
begin
  old_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  if nullif(current_setting('app.import_batch_id', true), '') is not null then
    event_action := 'import';
  elsif tg_op = 'INSERT' then
    event_action := 'insert';
  elsif new.deleted_at is not null and old.deleted_at is null then
    event_action := 'delete';
  elsif new.deleted_at is null and old.deleted_at is not null then
    event_action := 'restore';
  else
    event_action := 'update';
  end if;

  insert into public.audit_logs (
    record_id, action, old_data, new_data, changed_fields, actor_id,
    version_from, version_to, import_batch_id
  )
  values (
    coalesce(new.id, old.id),
    event_action,
    old_json,
    new_json,
    public.changed_json_fields(old_json, new_json),
    auth.uid(),
    case when old_json is null then null else old.version end,
    case when new_json is null then null else new.version end,
    nullif(current_setting('app.import_batch_id', true), '')::uuid
  );
  return coalesce(new, old);
end;
$$;

create trigger records_audit_trigger
after insert or update on public.records
for each row execute function public.audit_record_change();

create or replace function public.audit_contact_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record_id uuid := coalesce(new.record_id, old.record_id);
  target_version integer;
begin
  select version into target_version from public.records where id = target_record_id;
  insert into public.audit_logs (
    record_id, action, old_data, new_data, changed_fields, actor_id,
    version_from, version_to, import_batch_id
  )
  values (
    target_record_id,
    'update',
    case when tg_op = 'INSERT' then null else jsonb_build_object('contact', to_jsonb(old)) end,
    case when tg_op = 'DELETE' then null else jsonb_build_object('contact', to_jsonb(new)) end,
    array['contacts'],
    auth.uid(),
    target_version,
    target_version,
    nullif(current_setting('app.import_batch_id', true), '')::uuid
  );
  return coalesce(new, old);
end;
$$;

create trigger record_contacts_audit_trigger
after insert or update or delete on public.record_contacts
for each row execute function public.audit_contact_change();

create or replace function public.clean_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(replace(replace(coalesce(value, ''), E'\r\n', E'\n'), E'\r', E'\n')), '')
$$;

create or replace function public.create_record(p_payload jsonb, p_contact_ids uuid[] default '{}')
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.records;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cardinality(p_contact_ids) > 4
    or cardinality(p_contact_ids) <> (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.records.display_order'));
  insert into public.records (
    display_order, member_registry_no, trade_registry_no, profession_group, status,
    title, officials, origin, vote_status, notes, district, street,
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
    auth.uid(), auth.uid()
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
  if cardinality(p_contact_ids) > 4
    or cardinality(p_contact_ids) <> (select count(distinct x) from unnest(p_contact_ids) x) then
    raise exception 'INVALID_CONTACTS' using errcode = '22023';
  end if;

  update public.records set
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
    registered_address = coalesce(public.clean_text(p_payload ->> 'registered_address'), ''),
    phone_numbers = coalesce(public.clean_text(p_payload ->> 'phone_numbers'), ''),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id and version = p_expected_version and deleted_at is null
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

create or replace function public.soft_delete_record(p_id uuid, p_expected_version integer)
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.records;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  update public.records set
    deleted_at = now(), deleted_by = auth.uid(), version = version + 1,
    updated_at = now(), updated_by = auth.uid()
  where id = p_id and version = p_expected_version and deleted_at is null
  returning * into updated;
  if updated.id is null then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return updated;
end;
$$;

create or replace function public.restore_record(p_id uuid)
returns public.records
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.records;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  update public.records set
    deleted_at = null, deleted_by = null, version = version + 1,
    updated_at = now(), updated_by = auth.uid()
  where id = p_id and deleted_at is not null
  returning * into updated;
  if updated.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return updated;
end;
$$;

create or replace function public.upsert_contact_person(p_display_name text)
returns public.contact_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := public.clean_text(p_display_name);
  normalized text;
  person public.contact_people;
begin
  perform public.require_role(array['admin', 'editor']::public.app_role[]);
  if cleaned is null then
    raise exception 'CONTACT_NAME_REQUIRED' using errcode = '22023';
  end if;
  normalized := lower(regexp_replace(cleaned, '\s+', ' ', 'g'));
  insert into public.contact_people (display_name, normalized_name)
  values (cleaned, normalized)
  on conflict (normalized_name) do update
    set updated_at = public.contact_people.updated_at
  returning * into person;
  return person;
end;
$$;

create or replace function public.stage_import(p_file_name text, p_rows jsonb)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.import_batches;
  item jsonb;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'IMPORT_ROWS_REQUIRED' using errcode = '22023';
  end if;

  insert into public.import_batches (file_name, created_by)
  values (coalesce(nullif(btrim(p_file_name), ''), 'import.xlsx'), auth.uid())
  returning * into batch;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    insert into public.import_rows (
      batch_id, row_number, data, category, validation_errors, record_id, staged_version
    )
    values (
      batch.id,
      (item ->> 'row_number')::integer,
      item -> 'data',
      (item ->> 'category')::public.import_category,
      coalesce(array(select jsonb_array_elements_text(item -> 'validation_errors')), '{}'),
      nullif(item ->> 'record_id', '')::uuid,
      nullif(item ->> 'staged_version', '')::integer
    );
  end loop;

  update public.import_batches set counts = (
    select jsonb_object_agg(category, row_count)
    from (
      select category::text category, count(*) row_count
      from public.import_rows where batch_id = batch.id group by category
    ) grouped
  ) where id = batch.id returning * into batch;
  return batch;
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
  select * into batch from public.import_batches
  where id = p_batch_id and created_by = auth.uid() and status = 'staged'
  for update;
  if batch.id is null then
    raise exception 'IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.import_batches set status = 'applying' where id = batch.id;
  perform set_config('app.import_batch_id', batch.id::text, true);
  perform pg_advisory_xact_lock(hashtext('public.records.display_order'));
  set constraints all deferred;

  for staged in
    select * from public.import_rows
    where batch_id = batch.id and category in ('new', 'changed')
    order by row_number
  loop
    payload := staged.data;
    if public.clean_text(payload ->> 'member_registry_no') is null
      or public.clean_text(payload ->> 'title') is null
      or public.clean_text(payload ->> 'status') is null
      or public.clean_text(payload ->> 'profession_group') is null then
      raise exception 'INVALID_IMPORT_ROW:%', staged.row_number using errcode = '22023';
    end if;

    select * into target from public.records
    where member_registry_no = public.clean_text(payload ->> 'member_registry_no');

    if staged.category = 'new' then
      if target.id is not null then
        raise exception 'IMPORT_CONFLICT:%', staged.row_number using errcode = '40001';
      end if;
      insert into public.records (
        display_order, member_registry_no, trade_registry_no, profession_group, status,
        title, officials, origin, vote_status, notes, district, street,
        registered_address, phone_numbers, created_by, updated_by
      ) values (
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
        auth.uid(), auth.uid()
      ) returning id into target_id;
    else
      if target.id is null or target.deleted_at is not null or target.version <> staged.staged_version then
        raise exception 'IMPORT_CONFLICT:%', staged.row_number using errcode = '40001';
      end if;
      update public.records set
        display_order = (payload ->> 'display_order')::integer,
        trade_registry_no = public.clean_text(payload ->> 'trade_registry_no'),
        profession_group = public.clean_text(payload ->> 'profession_group'),
        status = public.clean_text(payload ->> 'status'),
        title = public.clean_text(payload ->> 'title'),
        officials = public.clean_text(payload ->> 'officials'),
        origin = public.clean_text(payload ->> 'origin'),
        vote_status = public.clean_text(payload ->> 'vote_status'),
        notes = public.clean_text(payload ->> 'notes'),
        district = public.clean_text(payload ->> 'district'),
        street = public.clean_text(payload ->> 'street'),
        registered_address = coalesce(public.clean_text(payload ->> 'registered_address'), ''),
        phone_numbers = coalesce(public.clean_text(payload ->> 'phone_numbers'), ''),
        version = version + 1, updated_at = now(), updated_by = auth.uid()
      where id = target.id and version = staged.staged_version
      returning id into target_id;
      delete from public.record_contacts where record_id = target_id;
    end if;

    contact_position := 0;
    for contact_name in
      select value from jsonb_array_elements_text(coalesce(payload -> 'contact_names', '[]'::jsonb))
    loop
      contact_position := contact_position + 1;
      if contact_position > 4 then
        raise exception 'TOO_MANY_CONTACTS:%', staged.row_number using errcode = '22023';
      end if;
      insert into public.contact_people (display_name, normalized_name)
      values (
        public.clean_text(contact_name),
        lower(regexp_replace(public.clean_text(contact_name), '\s+', ' ', 'g'))
      )
      on conflict (normalized_name) do update
        set updated_at = public.contact_people.updated_at
      returning id into contact_id;
      insert into public.record_contacts (record_id, contact_person_id, position)
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

alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.contact_people enable row level security;
alter table public.record_contacts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

create policy "profiles_read_own" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "records_read" on public.records
for select to authenticated
using (deleted_at is null or public.current_user_role() = 'admin');

create policy "contacts_read" on public.contact_people
for select to authenticated using (true);

create policy "record_contacts_read" on public.record_contacts
for select to authenticated
using (exists (
  select 1 from public.records r
  where r.id = record_id and (r.deleted_at is null or public.current_user_role() = 'admin')
));

create policy "audit_admin_read" on public.audit_logs
for select to authenticated using (public.current_user_role() = 'admin');

create policy "import_batches_admin_read" on public.import_batches
for select to authenticated using (public.current_user_role() = 'admin');

create policy "import_rows_admin_read" on public.import_rows
for select to authenticated using (public.current_user_role() = 'admin');

revoke all on public.profiles, public.records, public.contact_people, public.record_contacts,
  public.audit_logs, public.import_batches, public.import_rows from anon, authenticated;
grant select on public.profiles, public.records, public.contact_people, public.record_contacts to authenticated;
grant select on public.audit_logs, public.import_batches, public.import_rows to authenticated;

revoke all on function public.create_record(jsonb, uuid[]) from public;
revoke all on function public.update_record(uuid, integer, jsonb, uuid[]) from public;
revoke all on function public.soft_delete_record(uuid, integer) from public;
revoke all on function public.restore_record(uuid) from public;
revoke all on function public.upsert_contact_person(text) from public;
revoke all on function public.stage_import(text, jsonb) from public;
revoke all on function public.apply_import(uuid) from public;
grant execute on function public.create_record(jsonb, uuid[]) to authenticated;
grant execute on function public.update_record(uuid, integer, jsonb, uuid[]) to authenticated;
grant execute on function public.soft_delete_record(uuid, integer) to authenticated;
grant execute on function public.restore_record(uuid) to authenticated;
grant execute on function public.upsert_contact_person(text) to authenticated;
grant execute on function public.stage_import(text, jsonb) to authenticated;
grant execute on function public.apply_import(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'record_contacts'
  ) then
    alter publication supabase_realtime add table public.record_contacts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_people'
  ) then
    alter publication supabase_realtime add table public.contact_people;
  end if;
end
$$;

-- Dashboard üzerinden ilk admin rolü:
-- update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
