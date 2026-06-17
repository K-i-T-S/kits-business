-- Test script to verify multi-tenant implementation
-- Run this in Supabase SQL editor to test RLS policies

-- 1. Check if tables have tenant_id columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('products', 'sales', 'customers', 'employees', 'tenants', 'tenant_users')
    AND column_name = 'tenant_id'
ORDER BY table_name;

-- 2. Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('products', 'sales', 'customers', 'employees', 'tenants', 'tenant_users')
ORDER BY tablename;

-- 3. Check RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('products', 'sales', 'customers', 'employees', 'tenants', 'tenant_users')
ORDER BY tablename, policyname;

-- 4. Test tenant functions exist
SELECT 
    proname,
    prorettype::regtype as return_type,
    proargtypes::regtype[] as arg_types
FROM pg_proc 
WHERE proname IN ('current_tenant_id', 'current_user_role', 'create_tenant', 'get_current_user_tenant')
ORDER BY proname;

-- 5. Check default tenant exists
SELECT 
    id,
    name,
    slug,
    created_at
FROM tenants 
WHERE slug = 'default-store';

-- 6. Verify indexes exist for performance
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('products', 'sales', 'customers', 'employees', 'tenant_users')
    AND indexname LIKE '%tenant%'
ORDER BY tablename, indexname;

-- 7. Test data isolation (simulate)
-- This would need actual user sessions to test properly
-- But we can check the structure is correct

-- Expected results:
-- - All main tables should have tenant_id columns
-- - RLS should be enabled on all tables
-- - RLS policies should exist for each table
-- - Tenant functions should be available
-- - Default tenant should exist
-- - Performance indexes should be in place
