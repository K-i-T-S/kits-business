-- Advanced Inventory Management Schema
-- Adds batch tracking, expiration dates, supplier management, purchase orders, stock transfers, and automated reorder points

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    tax_id TEXT,
    payment_terms TEXT DEFAULT 'NET30',
    lead_time_days INTEGER DEFAULT 7,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Locations table for multi-location inventory
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    location_type TEXT DEFAULT 'warehouse', -- 'warehouse', 'store', 'storage'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Product batches table
CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity - quantity_reserved) STORED,
    unit_cost DECIMAL(10,2) NOT NULL,
    manufacture_date DATE,
    expiration_date DATE,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, batch_number)
);

-- Purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_date DATE,
    received_date TIMESTAMP WITH TIME ZONE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_terms TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase order items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    batch_number TEXT,
    manufacture_date DATE,
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    transfer_number TEXT UNIQUE NOT NULL,
    from_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    to_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'pending', -- 'pending', 'in_transit', 'completed', 'cancelled'
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock transfer items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES product_batches(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reorder points table
CREATE TABLE IF NOT EXISTS reorder_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    min_stock_level INTEGER NOT NULL DEFAULT 0,
    max_stock_level INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0,
    reorder_quantity INTEGER NOT NULL DEFAULT 0,
    lead_time_days INTEGER NOT NULL DEFAULT 7,
    safety_stock INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, product_id, location_id)
);

-- Update products table to support batch tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_batches BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_expiration BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Update inventory_movements to support batch and location tracking
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES stock_transfers(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS idx_product_batches_tenant_id ON product_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_location_id ON product_batches(location_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_supplier_id ON product_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiration ON product_batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_active ON product_batches(is_active);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_id ON stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_location ON stock_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_location ON stock_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON stock_transfer_items(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product_id ON stock_transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_points_tenant_id ON reorder_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reorder_points_product_id ON reorder_points(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_points_location_id ON reorder_points(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch_id ON inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_location_id ON inventory_movements(location_id);

-- Enable RLS on new tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view their tenant suppliers" ON suppliers
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage suppliers" ON suppliers
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for locations
CREATE POLICY "Users can view their tenant locations" ON locations
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage locations" ON locations
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for product_batches
CREATE POLICY "Users can view their tenant product batches" ON product_batches
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage product batches" ON product_batches
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view their tenant purchase orders" ON purchase_orders
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage purchase orders" ON purchase_orders
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view their tenant purchase order items" ON purchase_order_items
FOR SELECT USING (
    purchase_order_id IN (
        SELECT id FROM purchase_orders WHERE tenant_id = current_tenant_id()
    )
);

CREATE POLICY "Owners and managers can manage purchase order items" ON purchase_order_items
FOR ALL USING (
    purchase_order_id IN (
        SELECT id FROM purchase_orders WHERE tenant_id = current_tenant_id()
    )
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for stock_transfers
CREATE POLICY "Users can view their tenant stock transfers" ON stock_transfers
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage stock transfers" ON stock_transfers
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for stock_transfer_items
CREATE POLICY "Users can view their tenant stock transfer items" ON stock_transfer_items
FOR SELECT USING (
    stock_transfer_id IN (
        SELECT id FROM stock_transfers WHERE tenant_id = current_tenant_id()
    )
);

CREATE POLICY "Owners and managers can manage stock transfer items" ON stock_transfer_items
FOR ALL USING (
    stock_transfer_id IN (
        SELECT id FROM stock_transfers WHERE tenant_id = current_tenant_id()
    )
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for reorder_points
CREATE POLICY "Users can view their tenant reorder points" ON reorder_points
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage reorder points" ON reorder_points
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- Create default location for existing tenant
INSERT INTO locations (tenant_id, name, code, location_type)
SELECT id, 'Main Store', 'MAIN', 'store'
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM locations WHERE tenant_id = tenants.id
)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Function to generate purchase order numbers
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_id UUID;
    order_count INTEGER;
    order_number TEXT;
BEGIN
    tenant_id := current_tenant_id();
    
    SELECT COUNT(*) + 1 INTO order_count
    FROM purchase_orders
    WHERE tenant_id = tenant_id;
    
    order_number := 'PO-' || to_char(NOW(), 'YYYY') || '-' || LPAD(order_count::TEXT, 5, '0');
    
    RETURN order_number;
END;
$$;

-- Function to generate stock transfer numbers
CREATE OR REPLACE FUNCTION generate_stock_transfer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_id UUID;
    transfer_count INTEGER;
    transfer_number TEXT;
BEGIN
    tenant_id := current_tenant_id();
    
    SELECT COUNT(*) + 1 INTO transfer_count
    FROM stock_transfers
    WHERE tenant_id = tenant_id;
    
    transfer_number := 'ST-' || to_char(NOW(), 'YYYY') || '-' || LPAD(transfer_count::TEXT, 5, '0');
    
    RETURN transfer_number;
END;
$$;

-- Function to check and create reorder alerts
CREATE OR REPLACE FUNCTION check_reorder_points()
RETURNS TABLE(
    product_id UUID,
    location_id UUID,
    current_stock INTEGER,
    reorder_point INTEGER,
    suggested_order_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.product_id,
        rp.location_id,
        COALESCE(SUM(pb.quantity_available), 0) as current_stock,
        rp.reorder_point,
        rp.reorder_quantity
    FROM reorder_points rp
    LEFT JOIN product_batches pb ON rp.product_id = pb.product_id 
        AND rp.location_id = pb.location_id 
        AND pb.is_active = true
        AND (pb.expiration_date IS NULL OR pb.expiration_date > CURRENT_DATE)
    WHERE rp.tenant_id = current_tenant_id()
        AND rp.is_active = true
    GROUP BY rp.product_id, rp.location_id, rp.reorder_point, rp.reorder_quantity
    HAVING COALESCE(SUM(pb.quantity_available), 0) <= rp.reorder_point;
END;
$$;

-- Function to get expiring products alert
CREATE OR REPLACE FUNCTION get_expiring_products(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    batch_number TEXT,
    location_name TEXT,
    expiration_date DATE,
    days_until_expiration INTEGER,
    quantity_available INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        pb.batch_number,
        l.name,
        pb.expiration_date,
        pb.expiration_date - CURRENT_DATE,
        pb.quantity_available
    FROM product_batches pb
    JOIN products p ON pb.product_id = p.id
    JOIN locations l ON pb.location_id = l.id
    WHERE pb.tenant_id = current_tenant_id()
        AND pb.is_active = true
        AND pb.expiration_date IS NOT NULL
        AND pb.expiration_date <= CURRENT_DATE + days_ahead
        AND pb.expiration_date > CURRENT_DATE
        AND pb.quantity_available > 0
    ORDER BY pb.expiration_date ASC;
END;
$$;
