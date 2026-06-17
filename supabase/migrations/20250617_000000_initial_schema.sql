-- ============================================================
-- KiTS Business Terminal — Initial Schema
-- Clean consolidated migration for Supabase (per-client DB)
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ───────────────────────────────────────────────────
-- One client owns one Supabase project.
-- "Tenants" here are stores/branches within that client's account.

CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    settings    JSONB NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'cashier'
                    CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

-- ── Domain tables ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    cost            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    sku             TEXT,
    barcode         TEXT,
    category        TEXT,
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    city            TEXT,
    country         TEXT DEFAULT 'Lebanon',
    total_purchases NUMERIC(12,2) NOT NULL DEFAULT 0,
    visit_count     INTEGER NOT NULL DEFAULT 0,
    last_visit      TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS employees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    role        TEXT NOT NULL DEFAULT 'cashier'
                    CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
    commission  NUMERIC(5,2) NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    hire_date   DATE DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
    subtotal        NUMERIC(12,2) NOT NULL,
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL,
    payment_method  TEXT,
    payment_status  TEXT NOT NULL DEFAULT 'completed'
                        CHECK (payment_status IN ('completed', 'pending', 'refunded', 'void')),
    notes           TEXT,
    sale_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type   TEXT NOT NULL
                        CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return', 'transfer')),
    quantity        INTEGER NOT NULL,
    reference_id    UUID,
    notes           TEXT,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_tenant        ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku           ON products(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_active        ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_tenant       ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email        ON customers(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_tenant       ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant           ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_date             ON sales(tenant_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale        ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product     ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant       ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product      ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user      ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant    ON tenant_users(tenant_id);

-- ── RLS helpers ───────────────────────────────────────────────
-- These use auth.uid() — correct Supabase pattern.
-- Session variables (current_setting) are NOT used — they require
-- explicit calls before every query and break with PostgREST.

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT tenant_id
    FROM tenant_users
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT role
    FROM tenant_users
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;
$$;

-- ── Enable RLS ────────────────────────────────────────────────

ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──────────────────────────────────────────────

-- tenants: users see only their own tenant
CREATE POLICY "view own tenant" ON tenants
    FOR SELECT USING (id = current_tenant_id());

CREATE POLICY "owner can update tenant" ON tenants
    FOR UPDATE USING (id = current_tenant_id() AND current_user_role() = 'owner');

-- tenant_users: members see their tenant's roster
CREATE POLICY "view tenant members" ON tenant_users
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "owner manages members" ON tenant_users
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
    );

-- products
CREATE POLICY "view tenant products" ON products
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage products" ON products
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- customers
CREATE POLICY "view tenant customers" ON customers
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage customers" ON customers
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

-- employees
CREATE POLICY "view tenant employees" ON employees
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "owner manages employees" ON employees
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- sales
CREATE POLICY "view tenant sales" ON sales
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "cashier creates sale" ON sales
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

CREATE POLICY "manager updates sale" ON sales
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "owner deletes sale" ON sales
    FOR DELETE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
    );

-- sale_items (scoped through sale's tenant_id)
CREATE POLICY "view sale items" ON sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales s
            WHERE s.id = sale_id
              AND s.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY "cashier manages sale items" ON sale_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sales s
            WHERE s.id = sale_id
              AND s.tenant_id = current_tenant_id()
        )
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

-- inventory_movements
CREATE POLICY "view inventory movements" ON inventory_movements
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "manager manages inventory" ON inventory_movements
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- ── Tenant management functions ───────────────────────────────

CREATE OR REPLACE FUNCTION create_tenant(
    tenant_name TEXT,
    tenant_slug TEXT,
    owner_user_id UUID,
    settings JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    INSERT INTO tenants (name, slug, settings)
    VALUES (tenant_name, tenant_slug, settings)
    RETURNING id INTO new_tenant_id;

    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (new_tenant_id, owner_user_id, 'owner');

    RETURN new_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_current_user_tenant()
RETURNS TABLE (
    tenant_id   UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    user_role   TEXT,
    settings    JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT t.id, t.name, t.slug, tu.role, t.settings
    FROM tenants t
    JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND t.is_active = true;
$$;

CREATE OR REPLACE FUNCTION get_tenants_by_user(user_id_param UUID)
RETURNS TABLE (
    id          UUID,
    name        TEXT,
    slug        TEXT,
    settings    JSONB,
    is_active   BOOLEAN,
    user_role   TEXT,
    user_active BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT t.id, t.name, t.slug, t.settings, t.is_active,
           tu.role, tu.is_active
    FROM tenants t
    JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = user_id_param
    ORDER BY t.created_at;
$$;

CREATE OR REPLACE FUNCTION user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT CASE required_role
        WHEN 'viewer'  THEN current_user_role() IN ('viewer','cashier','manager','owner')
        WHEN 'cashier' THEN current_user_role() IN ('cashier','manager','owner')
        WHEN 'manager' THEN current_user_role() IN ('manager','owner')
        WHEN 'owner'   THEN current_user_role() = 'owner'
        ELSE false
    END;
$$;

-- ── Triggers: updated_at ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenant_users_updated_at
    BEFORE UPDATE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Grants ────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON tenants, tenant_users, products, customers, employees,
       sales, sale_items, inventory_movements
    TO authenticated;
GRANT EXECUTE ON FUNCTION create_tenant              TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_tenant    TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenants_by_user        TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role              TO authenticated;
GRANT EXECUTE ON FUNCTION current_tenant_id          TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role          TO authenticated;
