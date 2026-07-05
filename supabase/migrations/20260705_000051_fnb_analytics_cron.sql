-- 20260705_000051_fnb_analytics_cron.sql
-- Nightly automation for the three restored F&B analytics edge functions:
-- restaurant-demand-forecast, restaurant-menu-engineering, restaurant-upsell-compute.
--
-- IMPORTANT — manual step required after running this migration:
-- Set the service-role secret directly in the SQL Editor (never commit the real value):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
-- Get the key from Supabase Dashboard -> Project Settings -> API -> service_role.
-- This follows the same pattern already used for the admin PIN in
-- 20260619_000023_admin_pin_config_table.sql, because ALTER DATABASE (the
-- more common tutorial approach for storing secrets as GUCs) is not
-- available in Supabase's hosted SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function invoke_edge_function(function_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  -- Hardcodes the production project URL. If this migration is ever replayed
  -- against a different Supabase project (e.g. a staging environment), this
  -- value must be updated first, or the cron jobs will call the wrong project's functions.
  v_project_url text := 'https://pytndxjeznhhyycjasep.supabase.co';
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if v_key is null then
    raise exception 'service_role_key not set in vault — run: select vault.create_secret(''<key>'', ''service_role_key'');';
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule(
  'nightly-demand-forecast',
  '0 23 * * *',
  $$select invoke_edge_function('restaurant-demand-forecast')$$
);

select cron.schedule(
  'nightly-menu-engineering',
  '15 23 * * *',
  $$select invoke_edge_function('restaurant-menu-engineering')$$
);

select cron.schedule(
  'nightly-upsell-compute',
  '30 23 * * *',
  $$select invoke_edge_function('restaurant-upsell-compute')$$
);
