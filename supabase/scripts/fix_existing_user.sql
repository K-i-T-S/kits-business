-- Fix existing user by creating default tenant and assigning them
-- Run this in Supabase SQL Editor

-- Create default tenant
INSERT INTO tenants (name, slug, settings) VALUES (
    'Default Business', 
    'default-business', 
    '{}'
) ON CONFLICT (slug) DO NOTHING;

-- Assign existing user to tenant
INSERT INTO tenant_users (tenant_id, user_id, role)
SELECT 
    (SELECT id FROM tenants WHERE slug = 'default-business'),
    id, 
    'owner'
FROM auth.users
WHERE email = 'your-email@example.com'  -- Replace with your actual email
ON CONFLICT (tenant_id, user_id) DO NOTHING;
