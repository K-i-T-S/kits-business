-- Enhanced POS Features Database Schema
-- This migration adds tables for split payments, tips, discounts, loyalty, and receipt customization

-- Split Payments Table
CREATE TABLE IF NOT EXISTS split_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'digital')),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    transaction_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tips Table
CREATE TABLE IF NOT EXISTS tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    tip_type VARCHAR(20) NOT NULL CHECK (tip_type IN ('percentage', 'fixed', 'custom')),
    percentage DECIMAL(5,2) CHECK (percentage >= 0 AND percentage <= 100),
    employee_id UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount Coupons Table
CREATE TABLE IF NOT EXISTS discount_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'bogo', 'buy_x_get_y')),
    value DECIMAL(10,2) NOT NULL CHECK (value > 0),
    min_purchase_amount DECIMAL(10,2) CHECK (min_purchase_amount > 0),
    max_discount_amount DECIMAL(10,2) CHECK (max_discount_amount > 0),
    usage_limit INTEGER CHECK (usage_limit > 0),
    used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT valid_usage CHECK (used_count <= usage_limit),
    CONSTRAINT valid_percentage CHECK (type != 'percentage' OR (value <= 100))
);

-- Coupon Applicability (Products and Categories)
CREATE TABLE IF NOT EXISTS coupon_applicable_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES discount_coupons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(coupon_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupon_applicable_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES discount_coupons(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(coupon_id, category_id)
);

-- Promotions Table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'bundle', 'free_shipping')),
    value DECIMAL(10,2) NOT NULL CHECK (value > 0),
    min_quantity INTEGER CHECK (min_quantity > 0),
    min_amount DECIMAL(10,2) CHECK (min_amount > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_promo_dates CHECK (end_date > start_date)
);

-- Promotion Applicability
CREATE TABLE IF NOT EXISTS promotion_applicable_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS promotion_applicable_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(promotion_id, category_id)
);

-- Customer Segments for Promotions
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(promotion_id, segment_id)
);

-- Loyalty Programs Table
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points_per_dollar DECIMAL(5,2) NOT NULL CHECK (points_per_dollar > 0),
    redemption_rate DECIMAL(5,2) NOT NULL CHECK (redemption_rate > 0),
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty Tiers Table
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_points INTEGER NOT NULL CHECK (min_points >= 0),
    benefits TEXT[] NOT NULL,
    discount_rate DECIMAL(5,2) DEFAULT 0 CHECK (discount_rate >= 0 AND discount_rate <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(program_id, min_points)
);

-- Loyalty Rewards Table
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    type VARCHAR(20) NOT NULL CHECK (type IN ('discount', 'free_product', 'upgrade')),
    value DECIMAL(10,2) NOT NULL CHECK (value > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Loyalty Table
CREATE TABLE IF NOT EXISTS customer_loyalty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    current_points INTEGER DEFAULT 0 CHECK (current_points >= 0),
    tier_id UUID NOT NULL REFERENCES loyalty_tiers(id),
    total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
    total_redeemed INTEGER DEFAULT 0 CHECK (total_redeemed >= 0),
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(customer_id, program_id),
    CONSTRAINT valid_points CHECK (current_points <= total_earned)
);

-- Loyalty Points Transactions
CREATE TABLE IF NOT EXISTS loyalty_points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points INTEGER NOT NULL,
    reference_id UUID, -- Can reference sale, reward redemption, etc.
    reference_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt Templates Table
CREATE TABLE IF NOT EXISTS receipt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    header TEXT,
    footer TEXT,
    include_logo BOOLEAN DEFAULT true,
    include_barcode BOOLEAN DEFAULT true,
    include_qr_code BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt Custom Fields Table
CREATE TABLE IF NOT EXISTS receipt_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES receipt_templates(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'date', 'amount', 'custom')),
    default_value TEXT,
    position VARCHAR(20) NOT NULL CHECK (position IN ('header', 'body', 'footer')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Sales Table (Add new columns)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tip_info JSONB;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_coupon_id UUID REFERENCES discount_coupons(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_promotion_id UUID REFERENCES promotions(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_template_id UUID REFERENCES receipt_templates(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update sales table to ensure new columns have proper defaults
ALTER TABLE sales ALTER COLUMN tip_info SET DEFAULT '{}';
ALTER TABLE sales ALTER COLUMN loyalty_points_earned SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN loyalty_points_redeemed SET DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_split_payments_sale_id ON split_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_tips_sale_id ON tips(sale_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_code ON discount_coupons(code);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_active ON discount_coupons(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON customer_loyalty(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_program ON customer_loyalty(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_transactions_customer ON loyalty_points_transactions(customer_loyalty_id);
CREATE INDEX IF NOT EXISTS idx_receipt_templates_tenant ON receipt_templates(tenant_id);

-- Row Level Security Policies
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Split Payments
CREATE POLICY "Tenant can view split payments" ON split_payments
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert split payments" ON split_payments
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update split payments" ON split_payments
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete split payments" ON split_payments
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Tips
CREATE POLICY "Tenant can view tips" ON tips
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert tips" ON tips
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update tips" ON tips
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete tips" ON tips
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Discount Coupons
CREATE POLICY "Tenant can view discount coupons" ON discount_coupons
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert discount coupons" ON discount_coupons
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update discount coupons" ON discount_coupons
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete discount coupons" ON discount_coupons
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Promotions
CREATE POLICY "Tenant can view promotions" ON promotions
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert promotions" ON promotions
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update promotions" ON promotions
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete promotions" ON promotions
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Loyalty Programs
CREATE POLICY "Tenant can view loyalty programs" ON loyalty_programs
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert loyalty programs" ON loyalty_programs
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update loyalty programs" ON loyalty_programs
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete loyalty programs" ON loyalty_programs
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Customer Loyalty
CREATE POLICY "Tenant can view customer loyalty" ON customer_loyalty
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert customer loyalty" ON customer_loyalty
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update customer loyalty" ON customer_loyalty
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete customer loyalty" ON customer_loyalty
    FOR DELETE USING (tenant_id = auth.uid());

-- RLS Policies for Receipt Templates
CREATE POLICY "Tenant can view receipt templates" ON receipt_templates
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert receipt templates" ON receipt_templates
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update receipt templates" ON receipt_templates
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can delete receipt templates" ON receipt_templates
    FOR DELETE USING (tenant_id = auth.uid());

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_split_payments_updated_at BEFORE UPDATE ON split_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discount_coupons_updated_at BEFORE UPDATE ON discount_coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON loyalty_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_rewards_updated_at BEFORE UPDATE ON loyalty_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_loyalty_updated_at BEFORE UPDATE ON customer_loyalty
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipt_templates_updated_at BEFORE UPDATE ON receipt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to validate coupon usage
CREATE OR REPLACE FUNCTION validate_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if coupon has reached its usage limit
    IF NEW.used_count > (SELECT usage_limit FROM discount_coupons WHERE id = NEW.id) THEN
        RAISE EXCEPTION 'Coupon usage limit exceeded';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_coupon_usage_trigger BEFORE UPDATE ON discount_coupons
    FOR EACH ROW EXECUTE FUNCTION validate_coupon_usage();

-- Function to update customer loyalty points
CREATE OR REPLACE FUNCTION update_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_activity timestamp when points change
    IF NEW.current_points IS DISTINCT FROM OLD.current_points THEN
        NEW.last_activity = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_loyalty_points_trigger BEFORE UPDATE ON customer_loyalty
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_points();
