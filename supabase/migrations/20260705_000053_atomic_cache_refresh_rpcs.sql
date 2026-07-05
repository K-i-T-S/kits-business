-- Fixes non-atomic delete-then-insert cache refresh in restaurant-upsell-compute and
-- restaurant-menu-engineering, found during final whole-branch review of the Tier 0
-- F&B restore. Previously: edge functions did a raw delete then insert as two separate
-- supabase-js calls, with an early return BEFORE the delete whenever the new result set
-- was empty (leaving stale rows forever) — and no transaction wrapping the two calls, so
-- a failure after delete but before/during insert lost rows until the next nightly run.
-- These RPCs make each tenant's refresh a single atomic transaction: delete always runs
-- (clearing stale rows even on a legitimately-empty result), and insert only runs if there
-- are rows, all inside one function call so a mid-insert error rolls back the delete too.

create or replace function refresh_upsell_rules(p_tenant_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from restaurant_upsell_rules where tenant_id = p_tenant_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into restaurant_upsell_rules (tenant_id, trigger_item_id, suggested_item_id, confidence, support_count)
    select
      p_tenant_id,
      (r->>'trigger_item_id')::uuid,
      (r->>'suggested_item_id')::uuid,
      (r->>'confidence')::numeric,
      (r->>'support_count')::integer
    from jsonb_array_elements(p_rows) as r;
  end if;
end;
$$;

create or replace function refresh_menu_engineering_cache(p_tenant_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from restaurant_menu_engineering_cache where tenant_id = p_tenant_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into restaurant_menu_engineering_cache (tenant_id, menu_item_id, popularity_score, margin_score, category, recommended_action, potential_revenue_impact)
    select
      p_tenant_id,
      (r->>'menu_item_id')::uuid,
      (r->>'popularity_score')::numeric,
      (r->>'margin_score')::numeric,
      r->>'category',
      r->>'recommended_action',
      (r->>'potential_revenue_impact')::numeric
    from jsonb_array_elements(p_rows) as r;
  end if;
end;
$$;
