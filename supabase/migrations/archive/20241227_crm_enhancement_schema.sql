-- CRM Enhancement Schema
-- Adds communication history, marketing campaigns, and customer segmentation features

-- Customer communication history table
CREATE TABLE IF NOT EXISTS customer_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'phone', 'in_person', 'social_media', 'other')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    subject TEXT,
    content TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'failed', 'opened', 'replied')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'social_media', 'loyalty', 'promotion')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    target_segment_id UUID REFERENCES customer_segments(id) ON DELETE SET NULL,
    content_template JSONB,
    schedule_config JSONB,
    budget DECIMAL(10,2) DEFAULT 0,
    actual_cost DECIMAL(10,2) DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    metrics JSONB DEFAULT '{}',
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer segments table
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    is_dynamic BOOLEAN DEFAULT true,
    customer_count INTEGER DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer segment memberships table
CREATE TABLE IF NOT EXISTS customer_segment_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES customer_segments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    score DECIMAL(5,2) DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(segment_id, customer_id)
);

-- Campaign deliveries table
CREATE TABLE IF NOT EXISTS campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    communication_id UUID REFERENCES customer_communications(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'failed', 'bounced')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer interactions table (for tracking all touchpoints)
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'visit', 'inquiry', 'complaint', 'compliment', 'support', 'review', 'referral')),
    channel TEXT NOT NULL CHECK (channel IN ('pos', 'website', 'phone', 'email', 'social_media', 'in_store')),
    description TEXT,
    value DECIMAL(10,2) DEFAULT 0,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer preferences table
CREATE TABLE IF NOT EXISTS customer_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    communication_channel TEXT NOT NULL CHECK (communication_channel IN ('email', 'sms', 'phone', 'social_media')),
    is_opted_in BOOLEAN DEFAULT false,
    preferred_time TEXT, -- e.g., "morning", "afternoon", "evening"
    frequency_preference TEXT CHECK (frequency_preference IN ('daily', 'weekly', 'monthly', 'quarterly', 'never')),
    last_contact_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, communication_channel)
);

-- Loyalty programs table
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('points', 'tiers', 'cashback', 'hybrid')),
    rules JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer loyalty memberships table
CREATE TABLE IF NOT EXISTS customer_loyalty_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    program_id UUID REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    tier TEXT,
    points_balance INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, program_id)
);

-- Loyalty transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID REFERENCES customer_loyalty_memberships(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points INTEGER NOT NULL,
    description TEXT,
    reference_id UUID, -- Can reference sale_id, communication_id, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_communications_customer ON customer_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_type ON customer_communications(type);
CREATE INDEX IF NOT EXISTS idx_customer_communications_date ON customer_communications(sent_at);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_type ON marketing_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_customer_segments_dynamic ON customer_segments(is_dynamic);
CREATE INDEX IF NOT EXISTS idx_customer_segment_memberships_customer ON customer_segment_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_segment_memberships_segment ON customer_segment_memberships(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_customer ON campaign_deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_status ON campaign_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer ON customer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_type ON customer_interactions(type);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_date ON customer_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_opted_in ON customer_preferences(is_opted_in);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_active ON loyalty_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_memberships_customer ON customer_loyalty_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_memberships_program ON customer_loyalty_memberships(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_membership ON loyalty_transactions(membership_id);

-- Enable RLS on all new tables
ALTER TABLE customer_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segment_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for CRM tables
CREATE POLICY "Users can view customer communications" ON customer_communications
    FOR SELECT USING (true);

CREATE POLICY "Users can manage customer communications" ON customer_communications
    FOR ALL USING (true);

CREATE POLICY "Users can view marketing campaigns" ON marketing_campaigns
    FOR SELECT USING (true);

CREATE POLICY "Users can manage marketing campaigns" ON marketing_campaigns
    FOR ALL USING (true);

CREATE POLICY "Users can view customer segments" ON customer_segments
    FOR SELECT USING (true);

CREATE POLICY "Users can manage customer segments" ON customer_segments
    FOR ALL USING (true);

CREATE POLICY "Users can view segment memberships" ON customer_segment_memberships
    FOR SELECT USING (true);

CREATE POLICY "Users can manage segment memberships" ON customer_segment_memberships
    FOR ALL USING (true);

CREATE POLICY "Users can view campaign deliveries" ON campaign_deliveries
    FOR SELECT USING (true);

CREATE POLICY "Users can manage campaign deliveries" ON campaign_deliveries
    FOR ALL USING (true);

CREATE POLICY "Users can view customer interactions" ON customer_interactions
    FOR SELECT USING (true);

CREATE POLICY "Users can manage customer interactions" ON customer_interactions
    FOR ALL USING (true);

CREATE POLICY "Users can view customer preferences" ON customer_preferences
    FOR SELECT USING (true);

CREATE POLICY "Users can manage customer preferences" ON customer_preferences
    FOR ALL USING (true);

CREATE POLICY "Users can view loyalty programs" ON loyalty_programs
    FOR SELECT USING (true);

CREATE POLICY "Users can manage loyalty programs" ON loyalty_programs
    FOR ALL USING (true);

CREATE POLICY "Users can view loyalty memberships" ON customer_loyalty_memberships
    FOR SELECT USING (true);

CREATE POLICY "Users can manage loyalty memberships" ON customer_loyalty_memberships
    FOR ALL USING (true);

CREATE POLICY "Users can view loyalty transactions" ON loyalty_transactions
    FOR SELECT USING (true);

CREATE POLICY "Users can manage loyalty transactions" ON loyalty_transactions
    FOR ALL USING (true);

-- Insert default loyalty program
INSERT INTO loyalty_programs (name, description, type, rules) VALUES
(
    'Default Points Program',
    'Earn points with every purchase and redeem for discounts',
    'points',
    '{
        "earn_rate": 1,
        "redeem_rate": 100,
        "min_redeem": 500,
        "expiration_months": 12,
        "categories": {
            "purchase": 1,
            "referral": 500,
            "review": 50,
            "birthday": 200
        }
    }'
) ON CONFLICT DO NOTHING;

-- Insert default customer segments
INSERT INTO customer_segments (name, description, criteria, is_dynamic) VALUES
(
    'VIP Customers',
    'High-value customers with total purchases over $1000',
    '{"total_purchases": {"operator": ">", "value": 1000}}',
    true
),
(
    'New Customers',
    'Customers who joined in the last 30 days',
    '{"days_since_join": {"operator": "<=", "value": 30}}',
    true
),
(
    'Inactive Customers',
    'Customers with no purchases in the last 90 days',
    '{"days_since_last_purchase": {"operator": ">", "value": 90}}',
    true
),
(
    'Frequent Shoppers',
    'Customers with more than 10 purchases',
    '{"purchase_count": {"operator": ">", "value": 10}}',
    true
) ON CONFLICT DO NOTHING;

-- Create function to calculate customer segments
CREATE OR REPLACE FUNCTION calculate_customer_segments()
RETURNS void AS $$
DECLARE
    segment_record RECORD;
    customer_record RECORD;
    criteria_json JSONB;
    meets_criteria BOOLEAN;
BEGIN
    -- Loop through all dynamic segments
    FOR segment_record IN 
        SELECT id, criteria FROM customer_segments WHERE is_dynamic = true
    LOOP
        -- Clear existing memberships for this segment
        DELETE FROM customer_segment_memberships WHERE segment_id = segment_record.id;
        
        criteria_json := segment_record.criteria;
        
        -- Loop through all customers and check if they meet criteria
        FOR customer_record IN 
            SELECT id, total_purchases, created_at, 
                   (SELECT COUNT(*) FROM sales WHERE customer_id = customers.id) as purchase_count,
                   (SELECT MAX(sale_date) FROM sales WHERE customer_id = customers.id) as last_purchase_date
            FROM customers
        LOOP
            meets_criteria := false;
            
            -- Check total purchases criteria
            IF criteria_json ? 'total_purchases' THEN
                IF criteria_json->>'total_purchases' LIKE '%>' AND customer_record.total_purchases > (criteria_json->'total_purchases'->>'value')::decimal THEN
                    meets_criteria := true;
                END IF;
            END IF;
            
            -- Check days since join criteria
            IF criteria_json ? 'days_since_join' AND meets_criteria = false THEN
                IF criteria_json->>'days_since_join' LIKE '%<=' AND 
                   EXTRACT(days FROM NOW() - customer_record.created_at) <= (criteria_json->'days_since_join'->>'value')::integer THEN
                    meets_criteria := true;
                END IF;
            END IF;
            
            -- Check purchase count criteria
            IF criteria_json ? 'purchase_count' AND meets_criteria = false THEN
                IF criteria_json->>'purchase_count' LIKE '%>' AND customer_record.purchase_count > (criteria_json->'purchase_count'->>'value')::integer THEN
                    meets_criteria := true;
                END IF;
            END IF;
            
            -- Check days since last purchase criteria
            IF criteria_json ? 'days_since_last_purchase' AND meets_criteria = false THEN
                IF customer_record.last_purchase_date IS NOT NULL AND
                   criteria_json->>'days_since_last_purchase' LIKE '%>' AND
                   EXTRACT(days FROM NOW() - customer_record.last_purchase_date) > (criteria_json->'days_since_last_purchase'->>'value')::integer THEN
                    meets_criteria := true;
                END IF;
            END IF;
            
            -- Add customer to segment if criteria met
            IF meets_criteria THEN
                INSERT INTO customer_segment_memberships (segment_id, customer_id)
                VALUES (segment_record.id, customer_record.id)
                ON CONFLICT (segment_id, customer_id) DO NOTHING;
            END IF;
        END LOOP;
        
        -- Update customer count
        UPDATE customer_segments 
        SET customer_count = (SELECT COUNT(*) FROM customer_segment_memberships WHERE segment_id = segment_record.id),
            last_calculated = NOW()
        WHERE id = segment_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update segments when customer data changes
CREATE OR REPLACE FUNCTION trigger_segment_calculation()
RETURNS trigger AS $$
BEGIN
    -- Schedule segment recalculation (in production, this would be a background job)
    PERFORM calculate_customer_segments();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_segments
    AFTER INSERT OR UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_segment_calculation();

CREATE TRIGGER update_customer_segments_from_sales
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trigger_segment_calculation();
