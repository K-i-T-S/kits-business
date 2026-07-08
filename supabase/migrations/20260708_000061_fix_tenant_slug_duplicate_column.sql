-- Migration: Fix tenant_slug duplicate-column bug (QR menu broken platform-wide)
-- Applied directly to the live kits-dev project on 2026-07-08 with explicit
-- owner authorization, then backfilled here for the repo's record and for
-- reproducibility on any fresh Supabase project created from these
-- migration files.
--
-- Root cause: migration 20260621_000034_restaurant_menu_system.sql added a
-- SECOND, separate `tenant_slug` column to `tenants` (`ALTER TABLE tenants
-- ADD COLUMN IF NOT EXISTS tenant_slug TEXT UNIQUE;`), duplicating the
-- original, actively-used `slug` column from the very first migration
-- (20250617_000000_initial_schema.sql). get_public_menu() was written to
-- filter on the new, wrong column (`WHERE tenant_slug = p_tenant_slug`),
-- while every other part of the app (tenant creation, TenantSwitcher,
-- AdminPanel, QR/feedback link generation in MenuManagement.tsx /
-- TableManagement.tsx) correctly reads/writes only `.slug`.
-- get_current_user_tenant() already correctly selects `t.slug AS
-- tenant_slug` (an output alias, not the duplicate column) — confirming
-- `tenant_slug` the COLUMN was always dead weight except for this one bug.
--
-- Impact discovered live: every tenant on kits-dev had `tenant_slug = NULL`
-- except one (manually patched at some point, presumably while
-- troubleshooting this exact symptom), meaning get_public_menu() returned
-- {"error":"not_found"} for every QR menu link on the platform except that
-- one manually-patched tenant — and even that one tenant's actual QR link
-- (built from `.slug`, which had itself been separately mistyped as a full
-- domain, "kitshub.vercel.app") was still broken, since the two columns had
-- drifted to hold different values.
-- ============================================================

-- Free the "kits" slug from a pre-existing test tenant so the real
-- business tenant can take it (project-specific data fix; harmless no-op
-- on a fresh client project where this row doesn't exist).
UPDATE tenants SET slug = 'kits-test' WHERE slug = 'kits' AND name = 'kits';

-- Give the real "KiTS" tenant (name spelled with capital S, matching the
-- actual brand) a clean, correct slug, replacing the mistyped domain value.
UPDATE tenants SET slug = 'kits' WHERE name = 'KiTS' AND slug = 'kitshub.vercel.app';

-- Fix get_public_menu to read the real, canonical slug column.
CREATE OR REPLACE FUNCTION public.get_public_menu(p_tenant_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN RETURN '{"error":"not_found"}'::JSONB; END IF;
  SELECT jsonb_build_object(
    'tenant', (SELECT jsonb_build_object('id', id, 'name', name, 'brand_logo_url', brand_logo_url, 'brand_primary', brand_primary, 'qr_menu_palette', COALESCE(qr_menu_palette,'dark-luxury'), 'qr_menu_promotional_banner', qr_menu_promotional_banner) FROM tenants WHERE id = v_tenant_id),
    'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'name_ar', c.name_ar, 'icon', c.icon, 'sort_order', c.sort_order, 'active_allday', c.active_allday) ORDER BY c.sort_order) FROM restaurant_menu_categories c WHERE c.tenant_id = v_tenant_id), '[]'::jsonb),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'category_id', i.category_id, 'name', i.name, 'name_ar', i.name_ar, 'description', i.description, 'description_ar', i.description_ar, 'photo_url', i.photo_url, 'base_price_usd', i.base_price_usd, 'base_price_lbp', i.base_price_lbp, 'calories', i.calories, 'allergens', i.allergens, 'is_featured', i.is_featured, 'is_chef_pick', i.is_chef_pick, 'is_eighty_sixd', i.is_eighty_sixd, 'sort_order', i.sort_order) ORDER BY i.sort_order) FROM restaurant_menu_items i WHERE i.tenant_id = v_tenant_id AND i.is_active = true), '[]'::jsonb),
    'modifier_groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', mg.id, 'name', mg.name, 'name_ar', mg.name_ar, 'min_selections', mg.min_selections, 'max_selections', mg.max_selections, 'is_required', mg.is_required)) FROM restaurant_modifier_groups mg WHERE mg.tenant_id = v_tenant_id), '[]'::jsonb),
    'modifiers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'group_id', m.group_id, 'name', m.name, 'name_ar', m.name_ar, 'price_delta', m.price_delta, 'sort_order', m.sort_order) ORDER BY m.sort_order) FROM restaurant_modifiers m WHERE m.tenant_id = v_tenant_id), '[]'::jsonb),
    'item_modifier_links', COALESCE((SELECT jsonb_agg(jsonb_build_object('menu_item_id', mim.menu_item_id, 'modifier_group_id', mim.modifier_group_id)) FROM restaurant_menu_item_modifiers mim JOIN restaurant_menu_items i ON i.id = mim.menu_item_id WHERE i.tenant_id = v_tenant_id), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Drop the confirmed-dead duplicate column — nothing else in the schema or
-- app code reads or writes it, so nothing can accidentally target the
-- wrong column again in the future.
ALTER TABLE tenants DROP COLUMN IF EXISTS tenant_slug;
