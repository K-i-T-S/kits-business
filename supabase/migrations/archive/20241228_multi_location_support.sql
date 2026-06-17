-- Multi-Location Support System
-- This migration adds comprehensive multi-location support

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- Location code for easy reference
    type TEXT NOT NULL CHECK (type IN ('store', 'warehouse', 'office', 'pop-up', 'online')),
    address JSONB NOT NULL DEFAULT '{}', -- Full address as JSON
    contact_info JSONB DEFAULT '{}', -- Phone, email, etc.
    operating_hours JSONB DEFAULT '{}', -- Opening hours by day
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- Primary location for reporting
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tenant_primary_unique UNIQUE(tenant_id, is_primary) DEFERRABLE INITIALLY DEFERRED
);

-- Add location_id to existing tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Create inventory_by_location table for tracking inventory across locations
CREATE TABLE IF NOT EXISTS inventory_by_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES products(id) ON DELETE CASCADE, -- Will reference variants table
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0, -- Reserved for orders
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_level INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT NULL, -- Maximum stock level
    cost_per_unit NUMERIC(10,2) DEFAULT 0,
    last_counted_at TIMESTAMP WITH TIME ZONE,
    counted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, product_variant_id, location_id)
);

-- Create inventory_transfers table for tracking stock movements between locations
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    to_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    initiated_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    tracking_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_locations CHECK (from_location_id != to_location_id)
);

-- Create location_settings table for location-specific configurations
CREATE TABLE IF NOT EXISTS location_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location_id, setting_key)
);

-- Create location_users table for user-location assignments
CREATE TABLE IF NOT EXISTS location_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('manager', 'supervisor', 'staff', 'viewer')),
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, location_id)
);

-- Create location_reports table for location-specific reporting
CREATE TABLE IF NOT EXISTS location_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    report_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    report_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    report_data JSONB NOT NULL,
    generated_by UUID NOT NULL REFERENCES auth.users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location_id, report_type, report_period_start, report_period_end)
);

-- Insert default location settings
INSERT INTO location_settings (location_id, setting_key, setting_value) VALUES
-- These will be inserted when locations are created
ON CONFLICT (location_id, setting_key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_by_location_product_id ON inventory_by_location(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_by_location_location_id ON inventory_by_location(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_by_location_variant_id ON inventory_by_location(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_tenant_id ON inventory_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_location ON inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_location ON inventory_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_location_users_user_id ON location_users(user_id);
CREATE INDEX IF NOT EXISTS idx_location_users_location_id ON location_users(location_id);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_by_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Locations: Users with locations permissions can manage locations in their tenant
CREATE POLICY "Locations manage policy" ON locations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = locations.tenant_id
            AND p.name IN ('locations.create', 'locations.update', 'locations.delete')
            AND ur.is_active = true
        )
    );

CREATE POLICY "Locations read policy" ON locations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = locations.tenant_id
            AND p.name = 'locations.read'
            AND ur.is_active = true
        )
    );

-- Inventory by location: Read access based on location access
CREATE POLICY "Inventory by location read policy" ON inventory_by_location
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = inventory_by_location.location_id
            AND l.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- Inventory transfers: Based on tenant and location access
CREATE POLICY "Inventory transfers manage policy" ON inventory_transfers
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = inventory_transfers.tenant_id
            AND p.name = 'locations.transfer'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Inventory transfers read policy" ON inventory_transfers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Location users: Users can see their own assignments, managers can see all for their locations
CREATE POLICY "Location users read policy" ON location_users
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM location_users lu
            WHERE lu.location_id = location_users.location_id
            AND lu.user_id = auth.uid()
            AND lu.role IN ('manager', 'supervisor')
            AND lu.is_active = true
        )
    );

-- Location settings: Read access based on location access
CREATE POLICY "Location settings read policy" ON location_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = location_settings.location_id
            AND l.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- Functions for location operations
CREATE OR REPLACE FUNCTION create_inventory_transfer(
    from_location UUID,
    to_location UUID,
    product_uuid UUID,
    variant_uuid UUID,
    transfer_quantity INTEGER,
    notes_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    transfer_id UUID;
    current_stock INTEGER;
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid()
        AND p.name = 'locations.transfer'
        AND ur.is_active = true
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    -- Check available stock
    SELECT quantity_on_hand INTO current_stock
    FROM inventory_by_location
    WHERE product_id = product_uuid
    AND product_variant_id = variant_uuid
    AND location_id = from_location;
    
    IF current_stock < transfer_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, transfer_quantity;
    END IF;
    
    -- Create transfer record
    INSERT INTO inventory_transfers (
        tenant_id, from_location_id, to_location_id, 
        product_id, product_variant_id, quantity, 
        status, initiated_by, notes
    )
    VALUES (
        (SELECT tenant_id FROM locations WHERE id = from_location),
        from_location, to_location, product_uuid, variant_uuid,
        transfer_quantity, 'pending', auth.uid(), notes_param
    )
    RETURNING id INTO transfer_id;
    
    -- Reserve stock from source location
    UPDATE inventory_by_location
    SET quantity_reserved = quantity_reserved + transfer_quantity
    WHERE product_id = product_uuid
    AND product_variant_id = variant_uuid
    AND location_id = from_location;
    
    RETURN transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_inventory_transfer(transfer_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    transfer_record RECORD;
BEGIN
    -- Get transfer details
    SELECT * INTO transfer_record
    FROM inventory_transfers
    WHERE id = transfer_uuid AND status = 'in_transit';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer not found or not in transit';
    END IF;
    
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM location_users lu
        WHERE lu.user_id = auth.uid()
        AND lu.location_id = transfer_record.to_location_id
        AND lu.role IN ('manager', 'supervisor', 'staff')
        AND lu.is_active = true
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    -- Update inventory
    -- Remove from source location
    UPDATE inventory_by_location
    SET 
        quantity_on_hand = quantity_on_hand - transfer_record.quantity,
        quantity_reserved = quantity_reserved - transfer_record
    WHERE product_id = transfer_record.product_id
    AND product_variant_id = transfer_record.product_variant_id
    AND location_id = transfer_record.from_location_id;
    
    -- Add to destination location
    INSERT INTO inventory_by_location (
        product_id, product_variant_id, location_id, quantity_on_hand
    ) VALUES (
        transfer_record.product_id,
        transfer_record.product_variant_id,
        transfer_record.to_location_id,
        transfer_record.quantity
    )
    ON CONFLICT (product_id, product_variant_id, location_id)
    DO UPDATE SET
        quantity_on_hand = inventory_by_location.quantity_on_hand + transfer_record.quantity;
    
    -- Update transfer status
    UPDATE inventory_transfers
    SET status = 'completed', received_at = NOW()
    WHERE id = transfer_uuid;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_location_inventory(location_uuid UUID)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    variant_id UUID,
    quantity_on_hand INTEGER,
    quantity_reserved INTEGER,
    quantity_available INTEGER,
    reorder_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ibl.product_id,
        p.name,
        ibl.product_variant_id,
        ibl.quantity_on_hand,
        ibl.quantity_reserved,
        ibl.quantity_available,
        ibl.reorder_level
    FROM inventory_by_location ibl
    JOIN products p ON ibl.product_id = p.id
    WHERE ibl.location_id = location_uuid
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get low stock items across all locations
CREATE OR REPLACE FUNCTION get_low_stock_items(tenant_uuid UUID)
RETURNS TABLE(
    location_id UUID,
    location_name TEXT,
    product_id UUID,
    product_name TEXT,
    current_stock INTEGER,
    reorder_level INTEGER,
    shortage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        ibl.product_id,
        p.name,
        ibl.quantity_on_hand,
        ibl.reorder_level,
        ibl.reorder_level - ibl.quantity_on_hand
    FROM inventory_by_location ibl
    JOIN locations l ON ibl.location_id = l.id
    JOIN products p ON ibl.product_id = p.id
    WHERE l.tenant_id = tenant_uuid
    AND ibl.quantity_on_hand <= ibl.reorder_level
    AND ibl.reorder_level > 0
    ORDER BY shortage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
