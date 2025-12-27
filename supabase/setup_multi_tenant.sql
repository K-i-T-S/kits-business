-- Run the multi-tenant migration
-- This will set up the complete multi-tenant architecture with RLS

-- First run the main schema migration
\i supabase/migrations/20241226_create_multi_tenant_schema.sql

-- Then run the tenant management functions
\i supabase/migrations/20241226_tenant_management_functions.sql

-- Verify the setup
SELECT 'Tenants table created' as status FROM pg_tables WHERE tablename = 'tenants';
SELECT 'Tenant users table created' as status FROM pg_tables WHERE tablename = 'tenant_users';
SELECT 'Products table has tenant_id' as status FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tenant_id';
SELECT 'Sales table has tenant_id' as status FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'tenant_id';
SELECT 'Customers table has tenant_id' as status FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tenant_id';
SELECT 'Employees table has tenant_id' as status FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'tenant_id';

-- Check RLS policies
SELECT 'Products RLS enabled' as status FROM pg_tables WHERE tablename = 'products' AND rowsecurity = true;
SELECT 'Sales RLS enabled' as status FROM pg_tables WHERE tablename = 'sales' AND rowsecurity = true;
SELECT 'Customers RLS enabled' as status FROM pg_tables WHERE tablename = 'customers' AND rowsecurity = true;
SELECT 'Employees RLS enabled' as status FROM pg_tables WHERE tablename = 'employees' AND rowsecurity = true;

-- Show default tenant
SELECT * FROM tenants WHERE slug = 'default-store';

-- Show tenant functions
SELECT proname as function_name FROM pg_proc WHERE proname LIKE '%tenant%' OR proname LIKE '%current_%' ORDER BY proname;
