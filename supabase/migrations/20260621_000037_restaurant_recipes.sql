-- ============================================================
-- Migration: 20260621_000037_restaurant_recipes
-- Recipe & Ingredient System for Restaurant vertical
-- Adds: ingredient suppliers, ingredient inventory, stock movements,
--       recipes, recipe ingredients, menu-item recipe links, waste log,
--       auto-deduction function, food cost calculation function
-- ============================================================

-- Ingredient suppliers
CREATE TABLE IF NOT EXISTS restaurant_ingredient_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredient inventory (raw materials — NOT the menu items sold to customers)
CREATE TABLE IF NOT EXISTS restaurant_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES restaurant_ingredient_suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  category TEXT DEFAULT 'general',
  unit TEXT NOT NULL DEFAULT 'g',
  unit_options TEXT[] DEFAULT ARRAY['g', 'kg', 'ml', 'L', 'unit', 'oz', 'lb'],
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  current_stock NUMERIC(12,3) DEFAULT 0,
  reorder_level NUMERIC(12,3) DEFAULT 0,
  par_level NUMERIC(12,3) DEFAULT 0,
  shelf_life_days INTEGER,
  storage_location TEXT,
  is_active BOOLEAN DEFAULT true,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredient stock movements (receiving, deductions, waste, adjustments)
CREATE TABLE IF NOT EXISTS restaurant_ingredient_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('receive', 'deduct', 'waste', 'adjustment', 'transfer')),
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(10,4),
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  performed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipes (one per menu item, or null if no recipe defined)
CREATE TABLE IF NOT EXISTS restaurant_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  yield_quantity NUMERIC(10,3) DEFAULT 1,
  yield_unit TEXT DEFAULT 'portion',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe ingredients (what goes into each recipe)
CREATE TABLE IF NOT EXISTS restaurant_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES restaurant_recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12,4) NOT NULL,
  unit TEXT NOT NULL,
  waste_factor NUMERIC(5,3) DEFAULT 1.0,
  UNIQUE(recipe_id, ingredient_id)
);

-- Link recipes to menu items (one recipe per menu item, optional)
CREATE TABLE IF NOT EXISTS restaurant_menu_item_recipes (
  menu_item_id UUID PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES restaurant_recipes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

-- Waste log
CREATE TABLE IF NOT EXISTS restaurant_waste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES restaurant_ingredients(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT,
  cost_value NUMERIC(10,2),
  logged_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE restaurant_ingredient_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ingredient_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_item_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_waste_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_ingredient_suppliers" ON restaurant_ingredient_suppliers FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_ingredients" ON restaurant_ingredients FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_ingredient_movements" ON restaurant_ingredient_movements FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_recipes" ON restaurant_recipes FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_recipe_ingredients" ON restaurant_recipe_ingredients FOR ALL USING (recipe_id IN (SELECT id FROM restaurant_recipes WHERE tenant_id = current_tenant_id()));
CREATE POLICY "tenant_menu_item_recipes" ON restaurant_menu_item_recipes FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_waste_log" ON restaurant_waste_log FOR ALL USING (tenant_id = current_tenant_id());

-- ── Functions ─────────────────────────────────────────────────

-- Auto-deduct ingredients when order item is served
-- Called from KDS bump action: supabase.rpc('deduct_recipe_ingredients', { p_tenant_id, p_menu_item_id, p_quantity })
CREATE OR REPLACE FUNCTION deduct_recipe_ingredients(
  p_tenant_id UUID,
  p_menu_item_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipe_id UUID;
  v_ri RECORD;
BEGIN
  SELECT recipe_id INTO v_recipe_id
  FROM restaurant_menu_item_recipes
  WHERE menu_item_id = p_menu_item_id AND tenant_id = p_tenant_id;

  IF v_recipe_id IS NULL THEN
    RETURN; -- No recipe mapped — nothing to deduct
  END IF;

  FOR v_ri IN
    SELECT * FROM restaurant_recipe_ingredients WHERE recipe_id = v_recipe_id
  LOOP
    UPDATE restaurant_ingredients
    SET current_stock = current_stock - (v_ri.quantity * v_ri.waste_factor * p_quantity)
    WHERE id = v_ri.ingredient_id AND tenant_id = p_tenant_id;

    INSERT INTO restaurant_ingredient_movements
      (tenant_id, ingredient_id, movement_type, quantity, reference_type)
    VALUES
      (p_tenant_id, v_ri.ingredient_id, 'deduct', v_ri.quantity * v_ri.waste_factor * p_quantity, 'order_item');
  END LOOP;
END;
$$;

-- Calculate theoretical food cost for a recipe
CREATE OR REPLACE FUNCTION get_recipe_cost(p_recipe_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cost NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(ri.quantity * ri.waste_factor * i.cost_per_unit), 0)
  INTO v_cost
  FROM restaurant_recipe_ingredients ri
  JOIN restaurant_ingredients i ON i.id = ri.ingredient_id
  WHERE ri.recipe_id = p_recipe_id;

  RETURN v_cost;
END;
$$;
