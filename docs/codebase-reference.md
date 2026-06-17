# Codebase Reference

> Deep-dive reference for AI agents and developers. Last updated: 2026-06-18.  
> See `CLAUDE.md` for commands and quick-start. This file covers architecture, schema, and component map.

---

## 1. Product Overview

**KiTS Business Terminal** — multi-tenant POS + business management SPA built and maintained by Kits (Khoder's IT Solutions) for Lebanese/MENA SMB clients.

**Feature status:**

| Feature | Status |
|---|---|
| POS — product search, cart, checkout, sale recording | ✅ Live |
| Inventory — CRUD, edit/delete, mobile layout | ✅ Live |
| Batch tracking (validity dates) | ✅ Live |
| Reorder point management | ✅ Live |
| Customers — CRUD, debt tracking, purchase history | ✅ Live |
| Employees — CRUD, role editing, commission rates | ✅ Live |
| Reports — real sales data, date filters, export | ✅ Live |
| Dashboard — live counts | ✅ Live |
| CRM — customer data, segmentation display | ✅ Partial |
| Enterprise dashboard — real employee/product counts | ✅ Live |
| Roles & Permissions — real employee role editing | ✅ Live |
| Health check — real Supabase ping | ✅ Live |
| Error tracking — window.onerror capture | ✅ Live |
| Performance — browser Web Vitals | ✅ Live |
| Profile settings — supabase.auth.updateUser | ✅ Live |
| System settings — localStorage persistence | ✅ Live |
| Onboarding wizard (4-step post-signup) | ✅ Live |
| Subscription tier system + RBAC | ✅ Live (no billing yet) |
| CRM campaigns / marketing automation | 🔜 Coming soon |
| Stock transfers between locations | 🔜 Coming soon |
| Supplier management | 🔜 Coming soon |
| Purchase orders | 🔜 Coming soon |
| API & Webhooks | 🔜 Coming soon |
| Multi-location support | 🔜 Coming soon |
| Workflow automation | 🔜 Coming soon |
| Stripe billing | ❌ Not implemented |
| Activity log (backend table) | ❌ Not implemented |
| Offline sync (service worker wired) | ❌ Not implemented |
| Arabic RTL — complete | ❌ Partial |

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite 6 + TypeScript 5 (strict) |
| UI primitives | Radix UI (full component suite) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| State — global | React Context (AppContext + SubscriptionContext) |
| State — server/async | TanStack Query v5 |
| Routing | React Router DOM v6 |
| Charts | Recharts |
| Drag-and-drop | @dnd-kit |
| Export | ExcelJS (xlsx) + jsPDF + html2canvas |
| Toasts | Sonner |
| Icons | Lucide React |
| i18n | i18next + react-i18next |
| Error monitoring | Sentry (`@sentry/react`, optional) |
| Performance | `@vercel/speed-insights` |
| Backend | Supabase (PostgreSQL + Auth + PostgREST) |
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
| `VITE_SENTRY_DSN` | Optional | Sentry error tracking |
| `VITE_APP_VERSION` | Optional | Shown in monitoring dashboard |

GitHub secrets required for keep-alive workflow: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

---

## 4. Database Schema

All tables use UUIDs, have `tenant_id` (RLS-enforced), and created_at timestamps.

### `tenants`
```
id UUID PK
name TEXT
slug TEXT UNIQUE
owner_user_id UUID → auth.users
subscription_plan TEXT (starter|growth|business) DEFAULT 'starter'
subscription_status TEXT (active|trialing|past_due|canceled) DEFAULT 'active'
onboarding_completed BOOLEAN DEFAULT false
onboarding_step INTEGER DEFAULT 0
industry TEXT
phone TEXT
country TEXT DEFAULT 'Lebanon'
currency TEXT DEFAULT 'USD'
trial_ends_at TIMESTAMPTZ
stripe_customer_id TEXT
stripe_subscription_id TEXT
```

### `tenant_users`
```
tenant_id UUID → tenants
user_id UUID → auth.users
role TEXT (owner|manager|cashier|viewer)
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
last_purchase_date TIMESTAMPTZ | notes
```

### `employees`
```
id UUID PK | tenant_id | user_id UUID (nullable, links auth.users)
name | email | phone | role (owner|manager|cashier|viewer)
commission_rate NUMERIC | is_active BOOLEAN | hire_date DATE
```

### `sales`
```
id UUID PK | tenant_id | customer_id (nullable) | employee_id (nullable)
subtotal | discount | tax_amount | total_amount | payment_method (cash|card|transfer|other)
payment_status (completed|pending|refunded|void) | notes | sale_date
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

---

## 5. RLS Architecture

All domain tables have `ENABLE ROW LEVEL SECURITY`.

Two SECURITY DEFINER functions are the RLS backbone:

```sql
current_tenant_id() → UUID   -- active tenant for the session
current_user_role() → TEXT   -- owner|manager|cashier|viewer for current user/tenant
```

RLS policy pattern:
```sql
CREATE POLICY "view tenant products" ON products
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff manage products" ON products
  FOR ALL USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','manager'));
```

**Frontend implication**: Never add `.eq('tenant_id', ...)` to queries — the database filters automatically. Any query that works in production will only return the active tenant's data.

---

## 6. AppContext

`src/context/AppContext.tsx` is the single source of truth for all domain data.

**Provides:**
```typescript
products: Product[]
sales: Sale[]
customers: Customer[]
employees: Employee[]
currentTenant: Tenant | null
currentEmployee: Employee | null
loading: boolean

addProduct(p) / updateProduct(id, changes) / deleteProduct(id)
addSale(s) / addCustomer(c) / updateCustomer(id, changes) / deleteCustomer(id)
addEmployee(e) / updateEmployee(id, changes) / deleteEmployee(id)
loadData() — re-fetches all tables
setCurrentTenant(t)
```

**`loadData()`** pattern:
```typescript
const [productsRes, salesRes, customersRes, employeesRes] = await Promise.all([
  supabase.from('products').select('*').eq('is_active', true).order('name'),
  supabase.from('sales').select('*, sale_items(*)').order('sale_date', { ascending: false }).limit(500),
  supabase.from('customers').select('*').order('name'),
  supabase.from('employees').select('*').eq('is_active', true).order('name'),
]);
```

RLS handles tenant isolation — no `.eq('tenant_id', ...)` is used.

**Important**: `loadData` uses `useCallback` with empty dependency array (`[]`). RLS handles tenant scoping; no React state dependency on `currentTenant` is needed or desired (avoids stale closure bugs).

---

## 7. Subscription System

### Types (`src/types/subscription.ts`)

```typescript
type SubscriptionPlan = 'starter' | 'growth' | 'business'
type UserRole = 'owner' | 'manager' | 'cashier' | 'viewer'
type Feature = 'pos' | 'basic_reports' | 'advanced_analytics' | 'forecasting' |
               'crm' | 'inventory_management' | 'enterprise_dashboard' |
               'monitoring' | 'api_webhooks' | 'multi_location'
type RoleAction = 'make_sale' | 'edit_customers' | 'edit_products' | 'view_reports' |
                  'view_employees' | 'edit_employees' | 'access_settings' | 'access_enterprise'
```

### SubscriptionContext (`src/context/SubscriptionContext.tsx`)

Reads from `get_current_user_tenant` RPC on auth change. Fail-safe defaults: `starter` plan, `viewer` role. Provides:
- `hasFeature(feature: Feature): boolean`
- `canPerform(action: RoleAction): boolean`
- `isWithinLimit(resource, currentCount): boolean`

### FeatureGate usage

```tsx
<FeatureGate feature="advanced_analytics">
  <AdvancedAnalytics />
</FeatureGate>
// Shows lock UI + "Upgrade to Growth ($29/mo)" if plan is starter

<FeatureGate feature="advanced_analytics" compact>
  {/* compact mode: blurs children and overlays a small lock badge */}
</FeatureGate>
```

### RoleGate usage

```tsx
<RoleGate action="edit_employees">
  <DeleteEmployeeButton />
</RoleGate>
// Renders nothing for cashier/viewer; renders children for manager/owner
```

---

## 8. Onboarding Flow

1. User signs up → Supabase email confirmation (or immediate if confirmations off)
2. Confirmed user → `/tenant-selection`
3. `TenantSelection.tsx`: shows existing tenants or create-business form
4. After creating/entering tenant: checks `tenant.onboarding_completed`
   - `false` → renders `<OnboardingWizard>` full-screen
   - `true` → `navigate('/dashboard')`
5. `OnboardingWizard.tsx` steps:
   - Step 1: Business Profile (name, industry, country, currency, phone) → updates `tenants`
   - Step 2: First Product → inserts into `products`
   - Step 3: Invite Team Member → inserts into `employees` (skippable)
   - Step 4: Done → sets `tenants.onboarding_completed = true` → `navigate('/dashboard')`

---

## 9. Auth Flow

```
/login
  ├── Sign in → supabase.auth.signInWithPassword → /tenant-selection
  └── Sign up → supabase.auth.signUp
        ├── email confirmation required → toast "check email" → show sign-in form
        └── immediate session → /tenant-selection
              └── TenantSelection
                    ├── existing tenant (onboarding_completed=true) → /dashboard
                    ├── existing tenant (onboarding_completed=false) → OnboardingWizard → /dashboard
                    └── new tenant → create → OnboardingWizard → /dashboard
```

Auth errors are extracted with typed narrowing (no raw `{}` displayed to users).

---

## 10. Provider Stack

Outermost → innermost in `App.tsx`:

```
ErrorBoundary
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

## 11. Component Map by Feature

| Feature Area | Components |
|---|---|
| Auth | `src/pages/Login.tsx` |
| Post-login flow | `src/pages/TenantSelection.tsx`, `src/components/OnboardingWizard.tsx`, `src/components/CreateTenantModal.tsx` |
| Main layout | `src/components/Layout.tsx`, `src/components/MobileNavigation.tsx`, `src/components/NavItem.tsx` |
| Dashboard | `src/pages/Dashboard.tsx` |
| POS | `src/pages/POS.tsx`, `src/components/DiscountModal.tsx`, `src/components/SplitPaymentModal.tsx`, `src/components/TipsModal.tsx`, `src/components/LoyaltyModal.tsx`, `src/components/ReceiptCustomizationModal.tsx` |
| Inventory | `src/pages/Inventory.tsx`, `src/components/AddProductModal.tsx`, `src/components/BatchTracking.tsx`, `src/components/ReorderPointManagement.tsx`, `src/components/StockTransferManagement.tsx`, `src/components/SupplierManagement.tsx`, `src/components/PurchaseOrderManagement.tsx` |
| Customers | `src/pages/Customers.tsx`, `src/pages/CustomerManagement.tsx` |
| Employees | `src/pages/Employees.tsx` |
| Reports | `src/pages/Reports.tsx`, `src/components/ReportBuilder.tsx` |
| Analytics | `src/components/AdvancedAnalytics.tsx`, `src/components/Forecasting.tsx` |
| CRM | `src/components/crm/CRMAnalytics.tsx`, `CustomerSegmentation.tsx`, `AutomatedMarketing.tsx`, `MarketingCampaigns.tsx`, `CustomerCommunicationHistory.tsx` |
| Enterprise | `src/components/enterprise/EnterpriseDashboard.tsx`, `RolesAndPermissionsManager.tsx`, `WorkflowAutomation.tsx`, `MultiLocationSupport.tsx`, `ApiAndWebhooks.tsx` |
| Monitoring | `src/components/monitoring/MonitoringDashboard.tsx`, `HealthCheckDashboard.tsx`, `PerformanceDashboard.tsx`, `ErrorTrackingDashboard.tsx` |
| Settings | `src/pages/ProfileSettings.tsx`, `src/pages/SystemSettings.tsx` |
| Subscription / RBAC | `src/types/subscription.ts`, `src/context/SubscriptionContext.tsx`, `src/components/FeatureGate.tsx`, `src/components/RoleGate.tsx`, `src/hooks/useFeature.ts` |
| PWA / Offline | `src/components/PWAInstallPrompt.tsx`, `src/components/OfflineIndicator.tsx`, `src/hooks/usePWA.ts` |

---

## 12. Migration Order

| File | What it does |
|---|---|
| `20250617_000000_initial_schema.sql` | `tenants`, `tenant_users`, `current_tenant_id()`, `current_user_role()`, `get_current_user_tenant` RPC |
| `20250617_000001_views_and_functions.sql` | Helper views and aggregate functions |
| `20250617_000002_auth_triggers.sql` | Trigger on `auth.users` INSERT — auto-applies pending invitations |
| `20250617_000003_safe_domain_setup.sql` | All domain tables, RLS policies, indexes, updated_at triggers. **Safe to re-run on any schema state.** |
| `20260617_000004_onboarding.sql` | `onboarding_completed`, `onboarding_step`, `industry`, `phone`, `country`, `currency` on `tenants` |
| `20260618_000005_subscription_tiers.sql` | `subscription_plan`, `subscription_status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id` on `tenants` |

---

## 13. Deployment

### Frontend (Vercel)
Push to `main` → Vercel auto-deploys. Required env vars in Vercel project settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Database (Supabase)
Migrations are manual. Run in SQL Editor in the order listed above.

### CI (GitHub Actions)
`.github/workflows/ci.yml` — runs `npm run typecheck` and `npm run build` on every push/PR to `main`.

### Supabase Keep-Alive
`.github/workflows/keep-alive.yml` — cron every 3 days at 06:00 UTC. Pings `$SUPABASE_URL/rest/v1/` to prevent free-tier 7-day auto-pause. Requires GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

---

## 14. Known Limitations

- **Stripe billing**: `subscription_plan` is in the DB but payment/upgrade flow is not implemented. All users are effectively on `starter` by default.
- **Activity log**: `src/pages/ActivityLog.tsx` exists but there is no `activity_log` table — shows empty state.
- **Offline sync**: Service worker (`src/hooks/useServiceWorker.ts`) and offline queue (`src/hooks/useOfflineSync.ts`) exist but are not connected to real Supabase data writes.
- **Arabic RTL**: Partial — translations exist but RTL layout testing is incomplete.
- **Export chunk size**: The export chunk is ~1.9MB (ExcelJS + jsPDF) — consider lazy importing only when the export button is clicked.
- **Router chunk**: ~1MB — review lazy loading of heavy pages.
- **Edge Function**: `supabase/functions/make-server-210e7672/` exists in the repo but is not used by the application.
