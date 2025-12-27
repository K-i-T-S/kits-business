-- Base Application Schema
-- Create the core application tables before adding multi-tenant support

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    sku TEXT UNIQUE,
    barcode TEXT,
    category TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table (moved before sales to fix circular reference)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'cashier',
    commission DECIMAL(5,2) NOT NULL DEFAULT 0,
    total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
    shifts JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    hire_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0,
    visit_count INTEGER NOT NULL DEFAULT 0,
    last_visit TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales table (now can reference employees and customers)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sale items table (for line items in a sale)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- 'sale', 'purchase', 'adjustment', 'return'
    quantity INTEGER NOT NULL,
    reference_id UUID, -- Can reference sale_id, purchase_id, etc.
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_movements(created_at);

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be updated by multi-tenant migration)
CREATE POLICY "Users can view products" ON products
    FOR SELECT USING (true);

CREATE POLICY "Users can manage products" ON products
    FOR ALL USING (true);

CREATE POLICY "Users can view customers" ON customers
    FOR SELECT USING (true);

CREATE POLICY "Users can manage customers" ON customers
    FOR ALL USING (true);

CREATE POLICY "Users can view sales" ON sales
    FOR SELECT USING (true);

CREATE POLICY "Users can manage sales" ON sales
    FOR ALL USING (true);

CREATE POLICY "Users can view sale_items" ON sale_items
    FOR SELECT USING (true);

CREATE POLICY "Users can manage sale_items" ON sale_items
    FOR ALL USING (true);

CREATE POLICY "Users can view employees" ON employees
    FOR SELECT USING (true);

CREATE POLICY "Users can manage employees" ON employees
    FOR ALL USING (true);

CREATE POLICY "Users can view inventory_movements" ON inventory_movements
    FOR SELECT USING (true);

CREATE POLICY "Users can manage inventory_movements" ON inventory_movements
    FOR ALL USING (true);

-- Insert sample data (optional)
INSERT INTO products (name, description, price, cost, sku, category, stock_quantity) VALUES
('Laptop Computer', 'High-performance laptop for business use', 999.99, 750.00, 'LAPTOP-001', 'Electronics', 10),
('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 15.00, 'MOUSE-001', 'Electronics', 50),
('Office Chair', 'Comfortable office chair with lumbar support', 199.99, 120.00, 'CHAIR-001', 'Furniture', 15),
('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 25.00, 'LAMP-001', 'Furniture', 30)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO customers (name, email, phone) VALUES
('John Doe', 'john@example.com', '555-0101'),
('Jane Smith', 'jane@example.com', '555-0102'),
('Bob Johnson', 'bob@example.com', '555-0103')
ON CONFLICT (email) DO NOTHING;

INSERT INTO employees (name, email, role, commission) VALUES
('Admin User', 'admin@example.com', 'admin', 5.0),
('Sales Rep', 'sales@example.com', 'cashier', 3.0)
ON CONFLICT (email) DO NOTHING;
