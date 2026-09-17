-- Bazı eski kurulumlarda unique constraint adları farklıdır. Daha önce
-- kurulmuş apply_current_roster fonksiyonunu constraint adından bağımsız hale getirir.
do $$
declare
  old_definition text;
  new_definition text;
begin
  select pg_get_functiondef(
    'public.apply_current_roster(text, jsonb)'::regprocedure
  ) into old_definition;

  new_definition := regexp_replace(
    old_definition,
    'set\s+constraints\s+records_display_order_unique\s*,\s*records_trade_registry_unique\s+deferred\s*;',
    'set constraints all deferred;',
    'i'
  );

  if new_definition = old_definition then
    raise notice 'apply_current_roster already uses portable constraint resolution';
  else
    execute new_definition;
  end if;
end;
$$;
