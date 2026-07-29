-- İlk şemanın farklı sürümlerinde PostgreSQL tarafından otomatik adlandırılmış
-- unique constraint'leri standart adlarla yeniden oluşturur.
-- Bu sayede apply_import içindeki SET CONSTRAINTS ifadesi her kurulumda çalışır.
do $$
declare
  constraint_name text;
  display_order_attnum smallint;
  trade_registry_attnum smallint;
begin
  select attnum::smallint
  into display_order_attnum
  from pg_attribute
  where attrelid = 'public.records'::regclass
    and attname = 'display_order'
    and not attisdropped;

  select attnum::smallint
  into trade_registry_attnum
  from pg_attribute
  where attrelid = 'public.records'::regclass
    and attname = 'trade_registry_no'
    and not attisdropped;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.records'::regclass
      and contype = 'u'
      and conkey = array[display_order_attnum]::smallint[]
  loop
    execute format(
      'alter table public.records drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.records'::regclass
      and contype = 'u'
      and conkey = array[trade_registry_attnum]::smallint[]
  loop
    execute format(
      'alter table public.records drop constraint %I',
      constraint_name
    );
  end loop;

  alter table public.records
    add constraint records_display_order_unique
    unique (display_order)
    deferrable initially immediate;

  alter table public.records
    add constraint records_trade_registry_unique
    unique (trade_registry_no)
    deferrable initially immediate;
end;
$$;

