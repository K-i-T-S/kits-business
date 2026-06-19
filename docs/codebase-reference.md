# Codebase Reference

> Deep-dive reference for AI agents and developers. Last updated: 2026-06-20.
> See `CLAUDE.md` for commands and quick-start. This file covers architecture, schema, and component map.

---

## 1. Product Overview

**KiTS Business Terminal** — multi-tenant POS + business management SPA built and maintained by KiTS (Khoder's IT Solutions) for Lebanese/MENA SMB clients.

**Feature status:**

| Feature | Status |
|---|---|
| POS — barcode scan, cart, checkout, sale recording | ✅ Live |
| Lebanese VAT 11% (TVA) + dual currency USD/LBP | ✅ Live |
| WhatsApp receipts — Meta Cloud API v18.0 | ✅ Live (Business plan) |
| Loyalty points — earn/redeem, Bronze/Silver/Gold tiers | ✅ Live |
| Inventory — CRUD, batch tracking, reorder points | ✅ Live |
| Stock transfers, supplier management, purchase orders | ✅ Live |
| Multi-Location — locations, stock by location | ✅ Live |
| Customers — CRUD, debt tracking, purchase history | ✅ Live |
| CRM — analytics, segmentation, communication history | ✅ Live |
| Marketing Campaigns — CRUD, send-now, schedule | ✅ Live |
| Automated Marketing — trigger-based workflows | ✅ Live |
| Employees — CRUD, 8 roles, commission rates | ✅ Live |
| Custom Roles Manager — drag-drop permission builder | ✅ Live |
| Employee Invitation — email invite + RPC accept | ✅ Live |
| Finance — expenses, payroll, budget, P&L report | ✅ Live |
| Reports — real sales data, date filters, export | ✅ Live |
| Dashboard — live stats, role-aware | ✅ Live |
| Advanced Analytics — margin analysis, charts | ✅ Live |
| Forecasting — 30-day trend, holidays, CLV, stock depletion | ✅ Live (Growth+) |
| Monitoring — real Supabase data, 60s refresh | ✅ Live (Business+) |
| Activity Log — audit trail, Excel export | ✅ Live |
| Enterprise dashboard — employee/product counts | ✅ Live (Business+) |
| Roles & Permissions manager | ✅ Live (Business+) |
| Workflow Automation — enable/disable, Run Now | ✅ Live (Business+) |
| API & Webhooks — key gen, HMAC, delivery log | ✅ Live (Business+) |
| Multi-location | ✅ Live (Business+) |
| Profile Settings — name, avatar, password, language, 2FA | ✅ Live |
| Two-Factor Authentication (TOTP) | ✅ Live |
| System Settings — tax, TIN, dual currency, loyalty | ✅ Live |
| Brand Identity — logo, colors, tagline, CSS vars | ✅ Live |
| Dark/Light Theme toggle | ✅ Live |
| Onboarding wizard — 4-step | ✅ Live |
| Global Search — Cmd+K palette | ✅ Live |
| Offline Sync — IndexedDB queue | ✅ Live |
| PWA install prompt | ✅ Live |
| Admin Panel — PIN-gated, tenant management | ✅ Live |
| Multi-language — EN, AR, FR, ES, ZH | ✅ Live |
| RTL (Arabic) — logical CSS properties | ✅ Live |
| Stripe billing | ❌ Not yet — deferred |
| Campaign email send (Resend outbound) | ❌ Not yet — `send-campaign` Edge Function pending |

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite 5 + TypeScript 5 (strict) |
| UI primitives | Radix UI |
| Styling | Tailwind CSS v3 + CSS custom properties (`--brand-primary`, `--brand-secondary`) |
| State — global | React Context (AppContext + SubscriptionContext + ThemeContext) |
| State — server/async | TanStack Query v5 |
| Routing | React Router DOM v6 (lazy-loaded pages) |
| Charts | Recharts (ComposedChart, PieChart, BarChart) |
| Drag-and-drop | @dnd-kit |
| Export | ExcelJS (xlsx) + jsPDF + html2canvas (dynamic import) |
| Toasts | Sonner |
| Icons | Lucide React |
| i18n | i18next + react-i18next |
| Error monitoring | Sentry (`@sentry/react`, optional via `VITE_SENTRY_DSN`) |
| Performance | `@vercel/speed-insights`, `@vercel/analytics` |
| Backend | Supabase (PostgreSQL + Auth + PostgREST + Edge Functions + Storage) |
| CI/CD | GitHub Actions → Vercel |
| Testing (unit) | Vitest + jsdom + @testing-library/react |
| Testing (E2E) | Playwright |
| Component dev | Storybook 10 |

---

## 3. Environment Variables

| Variable | Context | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Production | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Production | Supabase anon key (safe for browser) |
| `VITE_USE_LOCAL_MODE` | Development | `true` → localStorage mock, skip Supabase |
| `VITE_SENTRY_DSN` | Optional | Sentry error tracking DSN |
| `VITE_APP_VERSION` | Optional | Shown in monitoring dashboard |

**GitHub secrets** (for keep-alive workflow): `SUPABASE_URL`, `SUPABASE_ANON_KEY`

**Supabase Edge Function secrets**:
- `RESEND_API_KEY` — transactional email (welcome-email, send-invitation)
- `WHATSAPP_TOKEN` — Meta Cloud API bearer token
- `WHATSAPP_PHONE_ID` — Meta sender phone number ID

---

## 4. Database Schema

All tables use UUIDs, have `tenant_id` (RLS-enforced), and `created_at` timestamps.

### `tenants`
```
id UUID PK
name TEXT | slug TEXT UNIQUE | owner_user_id UUID → auth.users
subscription_plan TEXT (starter|growth|business) DEFAULT 'starter'
subscription_status TEXT (active|trialing|past_due|canceled) DEFAULT 'active'
onboarding_completed BOOLEAN | onboarding_step INTEGER | industry TEXT
phone TEXT | country TEXT DEFAULT 'Lebanon' | currency TEXT DEFAULT 'USD'
exchange_rate NUMERIC DEFAULT 89500
trial_ends_at TIMESTAMPTZ
stripe_customer_id TEXT | stripe_subscription_id TEXT
brand_logo_url TEXT | brand_primary TEXT | brand_secondary TEXT | brand_tagline TEXT
db_provision_status TEXT (pending|provisioned)
```

### `tenant_users`
```
tenant_id UUID → tenants | user_id UUID → auth.users
role TEXT -- owner|admin|supervisor|accountant|stockkeeper|manager|cashier|viewer
```

### `custom_roles`
```
id UUID PK | tenant_id | name TEXT | permissions JSONB | is_active BOOLEAN
```

### `products`
```
id UUID PK | tenant_id | name | sku | barcode | category | unit | supplier
validity_date DATE | price NUMERIC | cost NUMERIC | stock_quantity INT
min_stock_level INT | is_active BOOLEAN
```

### `customers`
```
id UUID PK | tenant_id | name | email | phone | address | city | country
debt_balance NUMERIC | total_purchases NUMERIC | visit_count INT
last_purchase_date TIMESTAMPTZ | notes TEXT | points_balance INT DEFAULT 0
```

### `customer_points`
```
id UUID PK | tenant_id | customer_id → customers
points INT | type (earn|redeem|adjust) | sale_id (nullable) | notes TEXT
```

### `employees`
```
id UUID PK | tenant_id | user_id UUID (nullable, links auth.users)
name | email | phone | role TEXT | commission_rate NUMERIC
is_active BOOLEAN | hire_date DATE
```

### `sales`
```
id UUID PK | tenant_id | customer_id (nullable) | employee_id (nullable)
subtotal | discount | tax_amount | total_amount
payment_method (cash|card|transfer|other)
payment_status (completed|pending|refunded|void)
notes | sale_date
```

### `sale_items`
```
id UUID PK | sale_id → sales | product_id → products
quantity | unit_price | unit_cost | total_price
```

### `inventory_movements`
```
id UUID PK | tenant_id | product_id | movement_type (sale|purchase|adjustment|return|transfer)
quantity | reference_id | notes | created_by → auth.users
```

### `expense_categories`
```
id UUID PK | tenant_id (NULL = system default) | name TEXT | name_ar TEXT
type TEXT (operational|cogs|payroll|tax|financing)
is_cogs BOOLEAN | is_system BOOLEAN | is_active BOOLEAN | sort_order INT
```
34 Lebanese system categories pre-seeded: generator fuel/subscription, EDL electricity, water, internet, NSSF employer, NSSF employee, EOS accrual, municipal tax, income tax (17% CIT), VAT (TVA), import duties, customs, transport allowance, rent, salaries, commissions, bank fees, loan interest, equipment, maintenance, office supplies, marketing, insurance, legal/accounting fees, cleaning, security, subscriptions, software, travel, fuel vehicle, miscellaneous.

### `expenses`
```
id UUID PK | tenant_id | category_id → expense_categories
amount NUMERIC | currency TEXT (USD|LBP) | amount_usd NUMERIC (computed)
exchange_rate_used NUMERIC | expense_date DATE | description TEXT
is_recurring BOOLEAN | recurring_frequency TEXT (monthly|quarterly|yearly)
receipt_url TEXT | vat_amount NUMERIC | is_vat_inclusive BOOLEAN
```

### `expense_budgets`
```
id UUID PK | tenant_id | category_id → expense_categories
year INT | month INT | budgeted_amount_usd NUMERIC
UNIQUE (tenant_id, category_id, year, month)
```

### `payroll_entries`
```
id UUID PK | tenant_id | employee_id → employees
period_year INT | period_month INT
gross_salary NUMERIC | nssf_employer NUMERIC (22.5%)
eos_accrual NUMERIC (8.5%) | nssf_employee NUMERIC (3%)
transport_allowance NUMERIC | net_salary NUMERIC | total_employer_cost NUMERIC
currency TEXT (USD|LBP) | notes TEXT
```

### `campaigns`
```
id UUID PK | tenant_id | name TEXT | type TEXT (email|whatsapp|sms)
status TEXT (draft|scheduled|sending|sent|failed)
subject TEXT | body TEXT | target_segment TEXT
scheduled_at TIMESTAMPTZ | sent_at TIMESTAMPTZ | sent_count INT
```

### `automated_workflows`
```
id UUID PK | tenant_id | name TEXT
trigger_type TEXT (daily_summary|low_stock_alert|new_customer|no_purchase_30d|birthday)
action_type TEXT (whatsapp|email)
action_config JSONB | is_active BOOLEAN
last_run_at TIMESTAMPTZ | run_count INT
```

### `activity_log`
```
id UUID PK | tenant_id | user_id → auth.users
action TEXT | entity_type TEXT | entity_id UUID
metadata JSONB | created_at TIMESTAMPTZ
```

### `api_keys`
```
id UUID PK | tenant_id | key_hash TEXT | name TEXT | scopes TEXT[]
last_used_at TIMESTAMPTZ | is_active BOOLEAN
```

### `webhooks` / `webhook_deliveries`
Webhook registrations and per-delivery log with HTTP status and response body.

### `locations` / `location_stock`
Multi-location stock management. `location_stock` has `(location_id, product_id, quantity)`.

### `suppliers` / `purchase_orders` / `purchase_order_items`
Supplier records, POs with status, PO line items.

### `stock_transfers` / `stock_transfer_items`
Transfer records between locations with status tracking.

### `kits_admin_config`
```
key TEXT PK | value TEXT
-- Row: key='admin_pin_hash', value=bcrypt_hash_of_pin
```

---

## 5. RLS Architecture

All domain tables have `ENABLE ROW LEVEL SECURITY`.

Two SECURITY DEFINER functions are the RLS backbone:

```sql
current_tenant_id() → UUID   -- active tenant for the session
current_user_role() → TEXT   -- role for current user in the active tenant
```

RLS policy pattern:
```sql
CREATE POLICY "view tenant products" ON products
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage products" ON products
  FOR ALL USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','supervisor','manager'));
```

**Frontend implication**: Never add `.eq('tenant_id', ...)` to queries — the database filters automatically.

---

## 6. AppContext

`src/context/AppContext.tsx` is the single source of truth for all domain data.

**Provides:**
```typescript
products: Product[] | sales: Sale[] | customers: Customer[] | employees: Employee[]
currentTenant: Tenant | null | currentEmployee: Employee | null | loading: boolean

addProduct(p) / updateProduct(id, changes) / deleteProduct(id)
addSale(s) / addCustomer(c) / updateCustomer(id, changes) / deleteCustomer(id)
addEmployee(e) / updateEmployee(id, changes) / deleteEmployee(id)
loadData()  // re-fetches all tables
setCurrentTenant(t)
```

**`loadData()`** fires `Promise.all` across all tables. RLS handles tenant isolation — no `.eq('tenant_id', ...)` needed.

---

## 7. Subscription System

### Types (`src/types/subscription.ts`)

```typescript
type SubscriptionPlan = 'starter' | 'growth' | 'business'
type UserRole = 'owner' | 'admin' | 'supervisor' | 'accountant' | 'stockkeeper' | 'manager' | 'cashier' | 'viewer'
type Feature = 'pos' | 'basic_reports' | 'advanced_analytics' | 'forecasting' |
               'crm' | 'inventory_management' | 'enterprise_dashboard' |
               'monitoring' | 'api_webhooks' | 'multi_location' | 'loyalty' | 'finance'
```

### SubscriptionContext (`src/context/SubscriptionContext.tsx`)

Reads from `get_current_user_tenant` RPC on auth change. Provides:
- `hasFeature(feature: Feature): boolean`
- `canPerform(action: RoleAction): boolean`
- `isWithinLimit(resource, currentCount): boolean`

### Gate components

```tsx
// Plan gate — shows lock UI + upgrade CTA if plan insufficient
<FeatureGate feature="advanced_analytics">
  <AdvancedAnalytics />
</FeatureGate>

// Route gate — renders 403 page if feature not available
<FeatureRoute feature="forecasting">
  <ForecastingPage />
</FeatureRoute>

// Role gate — renders nothing for insufficient roles
<RoleGate action="edit_employees">
  <DeleteEmployeeButton />
</RoleGate>
```

---

## 8. Finance Module

`src/pages/Finance.tsx` — 5-tab page. Role-gated to `owner | admin | accountant | supervisor | manager`.

### Tabs

**Overview** — KPI cards (total expenses, avg daily, recurring/month, VAT recoverable), month selector, Recharts PieChart donut (expense by category), BarChart (6-month comparison), upcoming recurring expenses list.

**Expenses** — filter bar (category, date range, currency, search), paginated table, add/edit modal with USD/LBP toggle, receipt upload to `expense-receipts` Supabase Storage bucket, ExcelJS export.

**Payroll** — per-employee entry: gross salary, NSSF employer auto-calc (22.5%), EOS accrual (8.5%), transport allowance (LBP 48,000/day default per Lebanese labor law), NSSF employee deduction (3%), net salary. jsPDF bilingual payslip (EN/AR). Total employer cost column.

**Budget** — inline-editable monthly budget per category. Variance bar coloring (green/amber/red). Copy Last Month action.

**P&L Report** — full income statement: Revenue → COGS → Gross Profit → Operating Expenses → EBITDA → Lebanese CIT 17% → Net Profit. Monthly or YTD view. jsPDF export.

### Forecasting Integration

`src/pages/Forecasting.tsx` fetches `expenses.amount_usd` from the DB, computes `avgDailyExpense`, and adds an orange dashed expense projection line to the Recharts ComposedChart alongside the revenue forecast.

---

## 9. Onboarding Flow

1. User signs up → `/tenant-selection`
2. `TenantSelection.tsx`: shows existing tenants or create-business form
3. After entering tenant: checks `tenant.onboarding_completed`
   - `false` → renders `<OnboardingWizard>` full-screen
   - `true` → `navigate('/dashboard')`
4. `OnboardingWizard.tsx` steps:
   - Step 1: Business Profile (name, industry, country, currency, phone) → updates `tenants`
   - Step 2: First Product → inserts into `products`
   - Step 3: Invite Team Member → inserts into `employees` (skippable)
   - Step 4: Done → sets `tenants.onboarding_completed = true` → navigate to dashboard

---

## 10. Auth Flow

```
/login
  ├── Sign in → supabase.auth.signInWithPassword → /tenant-selection
  └── Sign up → supabase.auth.signUp
        ├── email confirmation required → toast "check email"
        └── immediate session → /tenant-selection
              └── TenantSelection
                    ├── existing tenant (onboarding_completed=true) → /dashboard
                    ├── existing tenant (onboarding_completed=false) → OnboardingWizard
                    └── new tenant → create → OnboardingWizard → /dashboard
```

Auth errors use typed narrowing — no raw `{}` displayed to users.

---

## 11. Provider Stack

Outermost → innermost in `App.tsx`:

```
ErrorBoundary
  ThemeProvider
    Router
      AppProvider (products, sales, customers, employees, CRUD)
        SubscriptionProvider (plan, role, hasFeature, canPerform)
          QueryProvider (TanStack Query)
            LanguageProvider
              TranslationProvider
                AccessibilityProvider
                  Routes
```

---

## 12. Component Map by Feature

| Feature Area | Key Files |
|---|---|
| Auth | `src/pages/Login.tsx` |
| Post-login flow | `src/pages/TenantSelection.tsx`, `src/components/OnboardingWizard.tsx` |
| Main layout | `src/components/Layout.tsx`, `src/components/MobileNavigation.tsx` |
| Dashboard | `src/pages/Dashboard.tsx` |
| POS | `src/pages/POS.tsx`, `DiscountModal`, `SplitPaymentModal`, `TipsModal`, `LoyaltyModal`, `ReceiptCustomizationModal` |
| Inventory | `src/pages/Inventory.tsx`, `BatchTracking`, `ReorderPointManagement`, `StockTransferManagement`, `SupplierManagement`, `PurchaseOrderManagement` |
| Customers | `src/pages/Customers.tsx`, `src/pages/CustomerManagement.tsx` |
| Employees | `src/pages/Employees.tsx` |
| Finance | `src/pages/Finance.tsx` |
| Reports | `src/pages/Reports.tsx`, `src/components/ReportBuilder.tsx` |
| Forecasting | `src/pages/Forecasting.tsx` |
| Analytics | `src/components/AdvancedAnalytics.tsx` |
| CRM | `src/components/crm/CRMAnalytics.tsx`, `CustomerSegmentation.tsx`, `AutomatedMarketing.tsx`, `MarketingCampaigns.tsx`, `CustomerCommunicationHistory.tsx` |
| Enterprise | `src/components/enterprise/EnterpriseDashboard.tsx`, `RolesAndPermissionsManager.tsx`, `WorkflowAutomation.tsx`, `MultiLocationSupport.tsx`, `ApiAndWebhooks.tsx` |
| Monitoring | `src/components/monitoring/MonitoringDashboard.tsx`, `HealthCheckDashboard.tsx`, `PerformanceDashboard.tsx`, `ErrorTrackingDashboard.tsx` |
| Settings | `src/pages/ProfileSettings.tsx` (incl. 2FA tab), `src/pages/SystemSettings.tsx` |
| Brand | `src/components/BrandIdentityModal.tsx`, `src/context/ThemeContext.tsx`, `src/styles/themes.css` |
| Activity Log | `src/pages/ActivityLog.tsx` |
| Admin | `src/pages/AdminPanel.tsx` |
| Subscription / RBAC | `src/types/subscription.ts`, `src/context/SubscriptionContext.tsx`, `src/components/FeatureGate.tsx`, `src/components/FeatureRoute.tsx`, `src/components/RoleGate.tsx` |
| Global Search | `src/components/GlobalSearch.tsx` |
| PWA / Offline | `src/components/PWAInstallPrompt.tsx`, `src/components/OfflineIndicator.tsx`, `src/utils/offlineQueue.ts` |

---

## 13. Migration Order

29 migrations total. See `CLAUDE.md` → "Database Migrations" for the full ordered list with descriptions.

Quick reference by area:
- **000000–000003**: Core schema (tenants, RLS functions, domain tables)
- **000004–000006**: Onboarding, subscription, activity log
- **000007–000009**: Stock management, multi-location, onboarding fix
- **000010–000013**: Admin RPCs, invite RPC, API/webhooks, provisioning
- **000014–000017**: Bug fixes (RLS, PL/pgSQL, VARCHAR cast, trigger search_path)
- **000018–000021**: Profile columns, onboarding fix, tenant plan RPC, 8-role set
- **000022–000024**: Admin PIN, brand identity
- **000025–000026**: Loyalty points, CRM
- **000027–000028**: Campaigns/workflows, Finance (expenses/payroll/budget)

---

## 14. Edge Functions

| Function | Source | Purpose | Secrets Needed |
|---|---|---|---|
| `welcome-email` | `supabase/functions/welcome-email/` | Branded HTML welcome email on tenant creation | `RESEND_API_KEY` |
| `send-invitation` | `supabase/functions/send-invitation/` | Employee invite email | `RESEND_API_KEY` |
| `whatsapp-receipt` | `supabase/functions/whatsapp-receipt/` | WhatsApp receipt via Meta Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| `trigger-workflows` | `supabase/functions/trigger-workflows/` | Daily summary + low-stock alert workflows | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |

---

## 15. Key Utilities

### `src/utils/formatting.ts`
- `formatCurrency(amount, currency)` — `$1,234.56` or `LBP 1,234,567`
- `formatTaxBreakdown(subtotal, rate)` → `{ subtotal, taxAmount, total, taxLabel }` — `taxLabel = "TVA 11%"` when rate is 0.11

### `src/utils/supabaseClient.ts`
Exports `supabase` — switches between real client and localStorage mock based on `VITE_USE_LOCAL_MODE`.

### `src/utils/exportService.ts`
- `exportToExcel(sales, products, customers)` — ExcelJS dynamic import
- `exportToPDF(sales, products)` — jsPDF dynamic import

### `src/utils/posCalculations.ts` — `POSCalculator`
Static methods for cart subtotal, tax, discount, tip, total. Single source of truth for all POS math.

### `src/utils/offlineQueue.ts`
IndexedDB wrapper. Queues operations when offline. `useOfflineSync` hook replays on reconnect.

### `src/constants/branding.ts`
```typescript
export const BRAND = {
  name: 'KiTS Business',
  whatsapp: '+96181290662',
  email: 'kits.tech.co@gmail.com',
  instagram: '@kits.tech',
}
```

---

## 16. Known Limitations / Deferred

- **Stripe billing**: `subscription_plan` column exists. Payment/upgrade flow not built. All tenants default to `starter` unless manually elevated via AdminPanel.
- **Campaign email send**: `campaigns` table + UI are live. `send-campaign` Edge Function is not yet built — "Send Now" button is a placeholder.
- **Offline sync**: `offlineQueue.ts` and `useOfflineSync` exist and queue operations locally, but replay against Supabase PostgREST on reconnect is not fully tested.
- **Export chunk size**: ExcelJS + jsPDF are dynamically imported per-call, which keeps the initial bundle lean but the first export may have a noticeable delay.
- **Avatar bucket**: `avatars` Supabase Storage bucket must be created manually (Dashboard → Storage → New Bucket).
- **WhatsApp credentials**: `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` must be set manually as Supabase secrets. See `docs/setup-whatsapp-receipts.md`.
