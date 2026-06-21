-- Restaurant menu categories
CREATE TABLE IF NOT EXISTS restaurant_menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  icon TEXT DEFAULT 'utensils',
  sort_order INTEGER DEFAULT 0,
  active_breakfast BOOLEAN DEFAULT true,
  active_lunch BOOLEAN DEFAULT true,
  active_dinner BOOLEAN DEFAULT true,
  active_allday BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Restaurant menu items (separate from generic products table)
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES restaurant_menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  photo_url TEXT,
  base_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  base_price_lbp NUMERIC(15,0),
  cost_price_usd NUMERIC(10,2),
  calories INTEGER,
  allergens TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_chef_pick BOOLEAN DEFAULT false,
  is_eighty_sixd BOOLEAN DEFAULT false,
  active_breakfast BOOLEAN DEFAULT true,
  active_lunch BOOLEAN DEFAULT true,
  active_dinner BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modifier groups (e.g. "Choose your size", "Add extras")
CREATE TABLE IF NOT EXISTS restaurant_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false
);

-- Individual modifier options
CREATE TABLE IF NOT EXISTS restaurant_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES restaurant_modifier_groups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  price_delta NUMERIC(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- Link menu items to modifier groups
CREATE TABLE IF NOT EXISTS restaurant_menu_item_modifiers (
  menu_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES restaurant_modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- Branch-level price and availability overrides
CREATE TABLE IF NOT EXISTS restaurant_branch_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  menu_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  price_override_usd NUMERIC(10,2),
  price_override_lbp NUMERIC(15,0),
  is_available BOOLEAN DEFAULT true,
  is_eighty_sixd BOOLEAN DEFAULT false,
  UNIQUE(branch_id, menu_item_id)
);

-- Add QR menu configuration to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_slug TEXT UNIQUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qr_menu_palette TEXT DEFAULT 'dark-luxury';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qr_menu_promotional_banner TEXT;

-- RLS
ALTER TABLE restaurant_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_branch_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_menu_categories" ON restaurant_menu_categories FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_menu_items" ON restaurant_menu_items FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_modifier_groups" ON restaurant_modifier_groups FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_modifiers" ON restaurant_modifiers FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_item_modifiers" ON restaurant_menu_item_modifiers FOR ALL USING (menu_item_id IN (SELECT id FROM restaurant_menu_items WHERE tenant_id = current_tenant_id()));
CREATE POLICY "tenant_branch_overrides" ON restaurant_branch_overrides FOR ALL USING (tenant_id = current_tenant_id());

-- Public read for QR menu (unauthenticated customers)
CREATE POLICY "public_read_menu_categories" ON restaurant_menu_categories FOR SELECT USING (true);
CREATE POLICY "public_read_menu_items" ON restaurant_menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_modifier_groups" ON restaurant_modifier_groups FOR SELECT USING (true);
CREATE POLICY "public_read_modifiers" ON restaurant_modifiers FOR SELECT USING (true);
CREATE POLICY "public_read_item_modifiers" ON restaurant_menu_item_modifiers FOR SELECT USING (true);

-- RPC for unauthenticated menu access (QR menu page)
CREATE OR REPLACE FUNCTION get_public_menu(p_tenant_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE tenant_slug = p_tenant_slug;
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
$$;
