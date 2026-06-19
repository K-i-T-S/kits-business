-- ─── expense_categories ──────────────────────────────────────────────────────
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,  -- NULL = system default visible to all
  name text not null,
  name_ar text,
  type text not null default 'other',
  -- type: 'cogs' | 'labor' | 'utilities' | 'facilities' | 'financial' | 'marketing'
  --       | 'taxes' | 'professional' | 'insurance' | 'technology' | 'transport' | 'other'
  is_cogs boolean default false,
  is_system boolean default false,  -- system rows: cannot delete, tenant_id is null
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table expense_categories enable row level security;
create policy "categories_visible" on expense_categories
  using (tenant_id is null or tenant_id = current_tenant_id());
create policy "categories_insert" on expense_categories
  for insert with check (tenant_id = current_tenant_id());
create policy "categories_update" on expense_categories
  for update using (tenant_id = current_tenant_id() and is_system = false);
create policy "categories_delete" on expense_categories
  for delete using (tenant_id = current_tenant_id() and is_system = false);

-- ─── Seed 30 Lebanese-specific system expense categories ─────────────────────
insert into expense_categories (tenant_id, name, name_ar, type, is_cogs, is_system, sort_order) values
-- Utilities
(null, 'Generator Fuel',           'وقود المولّد',        'utilities',     false, true, 10),
(null, 'Generator Subscription',   'اشتراك المولّد',      'utilities',     false, true, 11),
(null, 'EDL Electricity',          'كهرباء EDL',          'utilities',     false, true, 12),
(null, 'Water Bill',               'فاتورة المياه',        'utilities',     false, true, 13),
(null, 'Internet & Phone',         'إنترنت وهاتف',        'utilities',     false, true, 14),
(null, 'Gas & Propane',            'غاز وبروبان',          'utilities',     false, true, 15),
-- Facilities
(null, 'Rent / Lease',             'إيجار',                'facilities',    false, true, 20),
(null, 'Building Maintenance',     'صيانة المبنى',         'facilities',    false, true, 21),
(null, 'Cleaning & Janitorial',    'تنظيف',               'facilities',    false, true, 22),
(null, 'Security',                 'حراسة وأمن',           'facilities',    false, true, 23),
-- Labor
(null, 'Salaries & Wages',         'رواتب وأجور',          'labor',         false, true, 30),
(null, 'NSSF Employer (22.5%)',    'صندوق NSSF (22.5%)',  'labor',         false, true, 31),
(null, 'Transportation Allowance', 'بدل نقل',              'labor',         false, true, 32),
(null, 'End of Service Accrual',   'مؤونة نهاية الخدمة',  'labor',         false, true, 33),
(null, 'Bonuses & Commissions',    'مكافآت وعمولات',       'labor',         false, true, 34),
-- COGS
(null, 'Product Purchases',        'مشتريات بضاعة',        'cogs',          true,  true, 40),
(null, 'Import Duties & Customs',  'جمارك ورسوم استيراد',  'cogs',          true,  true, 41),
(null, 'Shipping & Freight',       'شحن ونقل بضاعة',       'cogs',          true,  true, 42),
(null, 'Packaging & Labels',       'تغليف وملصقات',        'cogs',          true,  true, 43),
-- Financial
(null, 'Bank Fees & Transfers',    'رسوم مصرفية وتحويلات', 'financial',     false, true, 50),
(null, 'POS Terminal Fees',        'رسوم نقاط البيع',      'financial',     false, true, 51),
(null, 'Currency Exchange Costs',  'تكاليف صرف العملات',   'financial',     false, true, 52),
-- Taxes & Government
(null, 'Municipal Tax (بلدية)',    'رسوم بلدية',           'taxes',         false, true, 60),
(null, 'Professional License',     'رخصة مهنية',           'taxes',         false, true, 61),
(null, 'TVA / Input VAT',          'ضريبة القيمة المضافة', 'taxes',         false, true, 62),
-- Professional
(null, 'Accounting & Bookkeeping', 'محاسبة وتدقيق',        'professional',  false, true, 70),
(null, 'Legal & Notary Fees',      'رسوم قانونية وكاتب عدل','professional', false, true, 71),
-- Insurance
(null, 'Business Insurance',       'تأمين تجاري',           'insurance',     false, true, 80),
(null, 'Health Insurance',         'تأمين صحي',              'insurance',     false, true, 81),
-- Marketing
(null, 'Marketing & Advertising',  'تسويق وإعلان',          'marketing',     false, true, 90),
-- Technology
(null, 'Software Subscriptions',   'اشتراكات برامج',        'technology',    false, true, 100),
(null, 'Delivery Platform Fees',   'عمولات منصات التوصيل',  'technology',    false, true, 101),
-- Other
(null, 'Office Supplies',          'قرطاسية ومستلزمات',     'other',         false, true, 110),
(null, 'Other / Miscellaneous',    'متفرقات',               'other',         false, true, 120)
on conflict do nothing;

-- ─── expenses ─────────────────────────────────────────────────────────────────
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references expense_categories(id),
  description text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  amount_usd numeric(12,2) not null,
  exchange_rate_used numeric(12,4) default 1,
  expense_date date not null default current_date,
  is_recurring boolean default false,
  recurring_frequency text,   -- 'weekly' | 'monthly' | 'quarterly' | 'annual'
  recurring_end_date date,
  vendor text,
  payment_method text default 'cash',  -- 'cash' | 'bank_transfer' | 'card' | 'check'
  vat_amount numeric(12,2) default 0,
  is_vat_inclusive boolean default false,
  notes text,
  receipt_url text,
  created_by uuid,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "expenses_tenant" on expenses
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- ─── expense_budgets ──────────────────────────────────────────────────────────
create table if not exists expense_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references expense_categories(id),
  year integer not null,
  month integer not null,
  budgeted_amount_usd numeric(12,2) not null,
  unique(tenant_id, category_id, year, month)
);

alter table expense_budgets enable row level security;
create policy "budgets_tenant" on expense_budgets
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- ─── payroll_entries ──────────────────────────────────────────────────────────
create table if not exists payroll_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid,
  employee_name text not null,
  period_start date not null,
  period_end date not null,
  base_salary numeric(12,2) not null default 0,
  base_currency text not null default 'USD',
  transport_allowance numeric(12,2) default 0,
  other_allowances numeric(12,2) default 0,
  overtime numeric(12,2) default 0,
  bonuses numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  nssf_employee numeric(12,2) default 0,    -- 3% (employee portion, sickness/maternity only, capped)
  nssf_employer numeric(12,2) default 0,    -- 22.5% (employer portion)
  eos_accrual numeric(12,2) default 0,      -- 8.5% end-of-service monthly provision
  gross_salary numeric(12,2) not null default 0,
  net_salary numeric(12,2) not null default 0,
  total_employer_cost numeric(12,2) not null default 0,
  payment_status text not null default 'pending',
  payment_date date,
  payment_method text default 'cash',
  notes text,
  created_at timestamptz default now()
);

alter table payroll_entries enable row level security;
create policy "payroll_tenant" on payroll_entries
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
