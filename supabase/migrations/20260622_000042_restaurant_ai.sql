-- Restaurant AI queries (chat history)
CREATE TABLE IF NOT EXISTS restaurant_ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  question TEXT NOT NULL,
  language TEXT CHECK (language IN ('en', 'ar')) DEFAULT 'en',
  response TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_ai_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_queries_tenant_isolation" ON restaurant_ai_queries
  FOR ALL USING (tenant_id = current_tenant_id());

-- Demand forecasts (nightly cron output)
CREATE TABLE IF NOT EXISTS restaurant_demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  date DATE NOT NULL,
  day_of_week TEXT,
  predicted_covers INTEGER,
  predicted_revenue NUMERIC(12, 2),
  confidence NUMERIC(3, 2),
  factors JSONB,
  prep_recommendations JSONB,
  staff_recommendation JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecasts_tenant_isolation" ON restaurant_demand_forecasts
  FOR ALL USING (tenant_id = current_tenant_id());
CREATE INDEX idx_forecasts_tenant_date ON restaurant_demand_forecasts(tenant_id, date);

-- Upsell rules (association rules from transaction history)
CREATE TABLE IF NOT EXISTS restaurant_upsell_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  trigger_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id),
  suggested_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id),
  confidence NUMERIC(3, 2),
  support_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_upsell_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upsell_rules_tenant_isolation" ON restaurant_upsell_rules
  FOR ALL USING (tenant_id = current_tenant_id());
CREATE INDEX idx_upsell_rules_trigger ON restaurant_upsell_rules(tenant_id, trigger_item_id);

-- Menu engineering cache (BCG matrix classifications)
CREATE TABLE IF NOT EXISTS restaurant_menu_engineering_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  menu_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id),
  popularity_score NUMERIC(4, 3),
  margin_score NUMERIC(4, 3),
  category TEXT CHECK (category IN ('star', 'plowhorse', 'puzzle', 'dog')),
  recommended_action TEXT,
  potential_revenue_impact NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_menu_engineering_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_eng_tenant_isolation" ON restaurant_menu_engineering_cache
  FOR ALL USING (tenant_id = current_tenant_id());
CREATE INDEX idx_menu_eng_tenant ON restaurant_menu_engineering_cache(tenant_id, category);
