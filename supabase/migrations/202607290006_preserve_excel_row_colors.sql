-- Excel satır sınıflandırma renklerini kayıtlarda saklar.
alter table public.records
  add column if not exists row_color text;

alter table public.records
  drop constraint if exists records_row_color_valid;

alter table public.records
  add constraint records_row_color_valid
  check (row_color is null or row_color in ('yellow', 'green', 'red'));

create or replace function public.apply_import_row_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_batch_id uuid :=
    nullif(current_setting('app.import_batch_id', true), '')::uuid;
  imported_color text;
begin
  if current_batch_id is null then
    return new;
  end if;

  select nullif(import_row.data ->> 'row_color', '')
  into imported_color
  from public.import_rows as import_row
  where import_row.batch_id = current_batch_id
    and public.clean_text(import_row.data ->> 'member_registry_no') =
      new.member_registry_no
  limit 1;

  new.row_color := imported_color;
  return new;
end;
$$;

drop trigger if exists records_import_row_color_trigger on public.records;

create trigger records_import_row_color_trigger
before insert or update on public.records
for each row execute function public.apply_import_row_color();

