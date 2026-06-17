-- ============================================================
-- Safe domain table setup — run this on any state of the DB.
-- Creates tables and columns if missing; skips if they exist.
-- Drops and recreates all RLS policies for domain tables.
-- Run after 000002_auth_triggers.sql
-- ============================================================

-- ── Domain Tables ─────────────────────────────────────────────
-- These use CREATE TABLE IF NOT EXISTS so they're safe to re-run.
-- tenants + tenant_users are handled by migration 000000.

CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    sku             TEXT,
    barcode         TEXT,
    category        TEXT,
    unit            TEXT,
    supplier        TEXT,
    validity_date   DATE,
    price           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    cost            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    email               TEXT,
    phone               TEXT,
    address             TEXT,
    city                TEXT,
    country             TEXT DEFAULT 'Lebanon',
    debt_balance        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_purchases     NUMERIC(12,2) NOT NULL DEFAULT 0,
    visit_count         INTEGER NOT NULL DEFAULT 0,
    last_purchase_date  TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    role            TEXT NOT NULL DEFAULT 'cashier'
                        CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    hire_date       DATE DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL,
    payment_method  TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
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
    unit_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
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

-- ── Patch columns that may be missing from older schema versions ──
-- Safe to run even if columns already exist.

ALTER TABLE products   ADD COLUMN IF NOT EXISTS supplier       TEXT;
ALTER TABLE products   ADD COLUMN IF NOT EXISTS validity_date  DATE;
ALTER TABLE products   ADD COLUMN IF NOT EXISTS unit           TEXT;

ALTER TABLE customers  ADD COLUMN IF NOT EXISTS debt_balance       NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ;

-- employees: some older versions used 'commission' instead of 'commission_rate'
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- sale_items: add unit_cost if missing
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- sales: add subtotal if missing
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_tenant        ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_active        ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_tenant       ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant       ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant           ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_date             ON sales(tenant_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale        ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product     ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant       ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product      ON inventory_movements(product_id);

-- ── Enable RLS ────────────────────────────────────────────────

ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies (drop-then-create so safe to re-run) ─────────

-- products
DROP POLICY IF EXISTS "view tenant products"    ON products;
DROP POLICY IF EXISTS "staff manage products"   ON products;
DROP POLICY IF EXISTS "cashier inserts product" ON products;

CREATE POLICY "view tenant products" ON products
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage products" ON products
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- customers
DROP POLICY IF EXISTS "view tenant customers"  ON customers;
DROP POLICY IF EXISTS "staff manage customers" ON customers;

CREATE POLICY "view tenant customers" ON customers
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage customers" ON customers
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

-- employees
DROP POLICY IF EXISTS "view tenant employees"    ON employees;
DROP POLICY IF EXISTS "owner manages employees"  ON employees;

CREATE POLICY "view tenant employees" ON employees
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "owner manages employees" ON employees
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- sales
DROP POLICY IF EXISTS "view tenant sales"   ON sales;
DROP POLICY IF EXISTS "cashier creates sale" ON sales;
DROP POLICY IF EXISTS "manager updates sale" ON sales;
DROP POLICY IF EXISTS "owner deletes sale"   ON sales;

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

-- sale_items
DROP POLICY IF EXISTS "view sale items"           ON sale_items;
DROP POLICY IF EXISTS "cashier manages sale items" ON sale_items;

CREATE POLICY "view sale items" ON sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales s
            WHERE s.id = sale_id AND s.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY "cashier manages sale items" ON sale_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sales s
            WHERE s.id = sale_id AND s.tenant_id = current_tenant_id()
        )
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

-- inventory_movements
DROP POLICY IF EXISTS "view inventory movements"   ON inventory_movements;
DROP POLICY IF EXISTS "manager manages inventory"  ON inventory_movements;

CREATE POLICY "view inventory movements" ON inventory_movements
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "manager manages inventory" ON inventory_movements
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- ── updated_at triggers ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at  ON products;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;

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

GRANT SELECT, INSERT, UPDATE, DELETE
    ON products, customers, employees,
       sales, sale_items, inventory_movements
    TO authenticated;
