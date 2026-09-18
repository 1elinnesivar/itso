-- Boş ana tabloyu, seçilen Eski Tablo kopyasındaki zengin alanlarla ve
-- güncel liste dosyasındaki resmi alanlarla atomik olarak yeniden oluşturur.
create or replace function public.apply_current_roster_from_legacy(
  p_snapshot_id uuid,
  p_source_file_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  roster_count integer;
  missing_count integer;
begin
  perform public.require_role(array['admin']::public.app_role[]);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'INVALID_ROSTER' using errcode = '22023';
  end if;

  lock table public.records in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtext('public.records.current_roster'));
  if exists (select 1 from public.records) then
    raise exception 'CURRENT_TABLE_NOT_EMPTY' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.legacy_table_snapshots where id = p_snapshot_id
  ) then raise exception 'SNAPSHOT_NOT_FOUND' using errcode = 'P0002'; end if;

  create temporary table current_roster_stage (
    source_order integer,
    member_registry_no text,
    trade_registry_no text,
    title text,
    registration_date text,
    tax_office_account text,
    authority_signature text
  ) on commit drop;

  insert into pg_temp.current_roster_stage
  select
    ordinality::integer,
    public.clean_text(item ->> 'member_registry_no'),
    public.clean_text(item ->> 'trade_registry_no'),
    public.clean_text(item ->> 'title'),
    public.clean_text(item ->> 'registration_date'),
    public.clean_text(item ->> 'tax_office_account'),
    public.clean_text(item ->> 'authority_signature')
  from jsonb_array_elements(p_rows) with ordinality source(item, ordinality);

  select count(*) into roster_count from pg_temp.current_roster_stage;
  if roster_count > 10000
    or exists (select 1 from pg_temp.current_roster_stage where member_registry_no is null or title is null)
    or exists (select 1 from pg_temp.current_roster_stage group by member_registry_no having count(*) > 1)
    or exists (
      select 1 from pg_temp.current_roster_stage where trade_registry_no is not null
      group by trade_registry_no having count(*) > 1
    ) then raise exception 'INVALID_ROSTER' using errcode = '22023'; end if;

  select count(*) into missing_count
  from pg_temp.current_roster_stage stage
  left join public.legacy_table_records legacy
    on legacy.snapshot_id = p_snapshot_id
    and legacy.deleted_at is null
    and legacy.record_data ->> 'member_registry_no' = stage.member_registry_no
  where legacy.original_record_id is null;
  if missing_count > 0 then
    raise exception 'LEGACY_MEMBERS_NOT_FOUND: %', missing_count using errcode = 'P0001';
  end if;

  -- Eski Tablo'da adı değiştirilmiş temasları da ana listeye taşır.
  -- Aynı normalize ada sahip mevcut kişi yeniden kullanılır.
  insert into public.contact_people (display_name, normalized_name)
  select distinct on (normalized_name) display_name, normalized_name
  from (
    select
      public.clean_text(contact ->> 'display_name') as display_name,
      lower(regexp_replace(public.clean_text(contact ->> 'display_name'), '\s+', ' ', 'g')) as normalized_name
    from public.legacy_table_records legacy
    join pg_temp.current_roster_stage stage
      on legacy.record_data ->> 'member_registry_no' = stage.member_registry_no,
      jsonb_array_elements(legacy.contacts) contact
    where legacy.snapshot_id = p_snapshot_id and legacy.deleted_at is null
  ) source
  where display_name is not null
  order by normalized_name, display_name
  on conflict (normalized_name) do nothing;

  insert into public.records (
    id, display_order, member_registry_no, trade_registry_no,
    registration_date, tax_office_account, authority_signature,
    profession_group, status, title, officials, origin, vote_status,
    notes, district, street, registered_address, phone_numbers,
    gift, itso_status, row_color, version,
    created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
  )
  select
    legacy.original_record_id,
    stage.source_order,
    stage.member_registry_no,
    stage.trade_registry_no,
    stage.registration_date,
    stage.tax_office_account,
    stage.authority_signature,
    coalesce(nullif(legacy.record_data ->> 'profession_group', ''), 'MOBİLYA TOP. VE PERAKENDE'),
    coalesce(nullif(legacy.record_data ->> 'status', ''), 'Faal'),
    stage.title,
    nullif(legacy.record_data ->> 'officials', ''),
    nullif(legacy.record_data ->> 'origin', ''),
    nullif(legacy.record_data ->> 'vote_status', ''),
    nullif(legacy.record_data ->> 'notes', ''),
    nullif(legacy.record_data ->> 'district', ''),
    nullif(legacy.record_data ->> 'street', ''),
    coalesce(legacy.record_data ->> 'registered_address', ''),
    coalesce(legacy.record_data ->> 'phone_numbers', ''),
    coalesce((legacy.record_data ->> 'gift')::boolean, false),
    nullif(legacy.record_data ->> 'itso_status', ''),
    nullif(legacy.record_data ->> 'row_color', ''),
    1,
    coalesce((legacy.record_data ->> 'created_at')::timestamptz, now()),
    auth.uid(), now(), auth.uid(), null, null
  from pg_temp.current_roster_stage stage
  join public.legacy_table_records legacy
    on legacy.snapshot_id = p_snapshot_id
    and legacy.deleted_at is null
    and legacy.record_data ->> 'member_registry_no' = stage.member_registry_no
  order by stage.source_order;

  insert into public.record_contacts (record_id, contact_person_id, position)
  select
    legacy.original_record_id,
    person.id,
    (contact ->> 'position')::smallint
  from public.legacy_table_records legacy
  join pg_temp.current_roster_stage stage
    on legacy.record_data ->> 'member_registry_no' = stage.member_registry_no,
    jsonb_array_elements(legacy.contacts) contact
  join public.contact_people person
    on person.normalized_name = lower(regexp_replace(
      public.clean_text(contact ->> 'display_name'), '\s+', ' ', 'g'
    ))
  where legacy.snapshot_id = p_snapshot_id and legacy.deleted_at is null;

  return jsonb_build_object(
    'current_count', roster_count,
    'matched_count', roster_count,
    'source_file_name', public.clean_text(p_source_file_name),
    'snapshot_id', p_snapshot_id
  );
end;
$$;

revoke all on function public.apply_current_roster_from_legacy(uuid, text, jsonb) from public;
grant execute on function public.apply_current_roster_from_legacy(uuid, text, jsonb) to authenticated;
