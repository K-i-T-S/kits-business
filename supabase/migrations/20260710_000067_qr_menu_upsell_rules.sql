-- Migration: 20260710_000067_qr_menu_upsell_rules.sql
-- QR Menu Upsell Rules
--
-- Extends get_public_menu() with the tenant's upsell association rules,
-- so the QR customer cart can show the same "frequently ordered together"
-- suggestions the (now-fixed) staff-side banner shows, without needing a
-- separate RPC round-trip per cart change. Required because
-- restaurant_upsell_rules has RLS scoped to current_tenant_id(), which an
-- anonymous QR customer never has — a direct client query would silently
-- return zero rows.
--
-- Full design: docs/superpowers/specs/2026-07-10-qr-menu-upsell-and-feedback-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_menu(p_tenant_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    'item_modifier_links', COALESCE((SELECT jsonb_agg(jsonb_build_object('menu_item_id', mim.menu_item_id, 'modifier_group_id', mim.modifier_group_id)) FROM restaurant_menu_item_modifiers mim JOIN restaurant_menu_items i ON i.id = mim.menu_item_id WHERE i.tenant_id = v_tenant_id), '[]'::jsonb),
    'bundles', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'name_ar', b.name_ar, 'description', b.description,
        'price_per_guest_usd', b.price_per_guest_usd, 'sort_order', b.sort_order
      ) ORDER BY b.sort_order) FROM restaurant_bundles b WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'bundle_courses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', bc.id, 'bundle_id', bc.bundle_id, 'course', bc.course, 'label', bc.label, 'sort_order', bc.sort_order
      ) ORDER BY bc.sort_order) FROM restaurant_bundle_courses bc
      JOIN restaurant_bundles b ON b.id = bc.bundle_id
      WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'bundle_course_items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'bundle_course_id', bci.bundle_course_id, 'menu_item_id', bci.menu_item_id
      )) FROM restaurant_bundle_course_items bci
      JOIN restaurant_bundle_courses bc ON bc.id = bci.bundle_course_id
      JOIN restaurant_bundles b ON b.id = bc.bundle_id
      WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'upsell_rules', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'trigger_item_id', r.trigger_item_id,
        'suggested_item_id', r.suggested_item_id, 'confidence', r.confidence
      )) FROM restaurant_upsell_rules r
      WHERE r.tenant_id = v_tenant_id AND r.confidence > 0.3), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
