-- Trigger kayıtlarını INSERT/UPDATE/DELETE için açıkça ele alır.
-- AFTER trigger dönüşleri PostgreSQL tarafından kullanılmasa da geçerli satır döndürülür.
create or replace function public.audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb;
  new_json jsonb;
  target_record_id uuid;
  old_version integer;
  new_version integer;
  event_action public.audit_action;
  current_batch_id uuid :=
    nullif(current_setting('app.import_batch_id', true), '')::uuid;
begin
  if tg_op = 'INSERT' then
    old_json := null;
    new_json := to_jsonb(new);
    target_record_id := new.id;
    old_version := null;
    new_version := new.version;
    event_action := case when current_batch_id is null then 'insert' else 'import' end;
  elsif tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);
    target_record_id := new.id;
    old_version := old.version;
    new_version := new.version;
    if current_batch_id is not null then
      event_action := 'import';
    elsif new.deleted_at is not null and old.deleted_at is null then
      event_action := 'delete';
    elsif new.deleted_at is null and old.deleted_at is not null then
      event_action := 'restore';
    else
      event_action := 'update';
    end if;
  else
    old_json := to_jsonb(old);
    new_json := null;
    target_record_id := old.id;
    old_version := old.version;
    new_version := null;
    event_action := 'delete';
  end if;

  insert into public.audit_logs (
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    actor_id,
    version_from,
    version_to,
    import_batch_id
  )
  values (
    target_record_id,
    event_action,
    old_json,
    new_json,
    public.changed_json_fields(old_json, new_json),
    auth.uid(),
    old_version,
    new_version,
    current_batch_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.audit_contact_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record_id uuid;
  target_version integer;
  old_json jsonb;
  new_json jsonb;
begin
  if tg_op = 'INSERT' then
    target_record_id := new.record_id;
    old_json := null;
    new_json := jsonb_build_object('contact', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    target_record_id := new.record_id;
    old_json := jsonb_build_object('contact', to_jsonb(old));
    new_json := jsonb_build_object('contact', to_jsonb(new));
  else
    target_record_id := old.record_id;
    old_json := jsonb_build_object('contact', to_jsonb(old));
    new_json := null;
  end if;

  select version
  into target_version
  from public.records
  where id = target_record_id;

  insert into public.audit_logs (
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    actor_id,
    version_from,
    version_to,
    import_batch_id
  )
  values (
    target_record_id,
    case
      when nullif(current_setting('app.import_batch_id', true), '') is null
        then 'update'::public.audit_action
      else 'import'::public.audit_action
    end,
    old_json,
    new_json,
    array['contacts'],
    auth.uid(),
    target_version,
    target_version,
    nullif(current_setting('app.import_batch_id', true), '')::uuid
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

