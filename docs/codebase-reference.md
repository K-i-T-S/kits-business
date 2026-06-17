# Codebase Reference

> Auto-generated deep-dive. Last updated: 2026-06-17.  
> Run `/init` to regenerate CLAUDE.md; update this file manually when architecture changes.

---

## 1. Product Overview

**All-in-One Business Terminal** — a multi-tenant POS + business management SPA built and maintained by Kits (Khoder's IT Solutions) for Lebanese/MENA SMB clients.

Key capabilities:
- Point-of-sale with barcode scanning, split payments, tips, coupons, loyalty programs
- Inventory management with variants, batch tracking, supplier management, purchase orders, stock transfers, reorder automation
- Customer CRM with segmentation, communication history, marketing campaigns
- Employee management with shift tracking and sales commission
- Analytics / reporting: revenue, profit, forecasting, custom report builder
- Enterprise module: RBAC, workflow automation, multi-location, API/webhooks
- PWA (service worker, offline-first queue via IndexedDB)
- Internationalization: English, Arabic (RTL), French, Spanish, Chinese
- Monitoring: error tracking, health checks, performance dashboards

Support contacts (in `src/constants/branding.ts`):  
`BRAND.supportWhatsApp = '+961 81 290 662'`  
`BRAND.supportEmail = 'kits.tech.co@gmail.com'`

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite 6 + TypeScript 5 |
| UI primitives | Radix UI (full component suite) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| State — global | React Context (`AppContext`) |
| State — server/async | TanStack Query v5 |
| Routing | React Router DOM v6 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Drag-and-drop | @dnd-kit |
| Virtualization | react-window + react-window-infinite-loader |
| Export | ExcelJS (xlsx) + jsPDF + html2canvas |
| Toasts | Sonner |
| Icons | Lucide React |
| i18n | i18next + react-i18next + browser detector |
| Error monitoring | Sentry (`@sentry/react`) |
| Performance | `@vercel/speed-insights` |
| Backend | Supabase Edge Functions (Deno + Hono) |
| Database | Supabase (PostgreSQL) with RLS |
| Auth | Supabase Auth |
| CI/CD | GitHub Actions → Vercel |
| Testing (unit) | Vitest + jsdom + @testing-library/react |
| Testing (E2E) | Playwright |
| Component dev | Storybook 10 |

---

## 3. Environment & Configuration

### Environment Variables (all `VITE_` prefix for browser exposure)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Prod only | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Prod only | Supabase anon/public key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Optional | Admin ops (tenant CRUD, audit log) |
| `VITE_USE_LOCAL_MODE` | Dev | `"true"` bypasses Supabase entirely |
| `VITE_SENTRY_DSN` | Prod optional | Enables Sentry error reporting |
| `VITE_APP_VERSION` | Prod optional | Sentry release tag |

### Local dev (`.env.local`)
```
VITE_USE_LOCAL_MODE=true
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
When `VITE_USE_LOCAL_MODE=true`, the entire data layer is replaced with `localStorage` mocks — no Supabase account needed.

### Important vite config notes
- Dev server runs on **port 3000** (not 5173)
- Build output goes to `build/` (not `dist/`)
- Path alias: `@/` → `src/`
- Chunk splitting configured for vendor, radix, charts, i18n, export, dnd, virtualization chunks
- In production: console.log stripped by esbuild + terser; sourcemaps disabled

---

## 4. Application Entry Point & Bootstrap

**`src/main.tsx`**  
- Registers the service worker (`/sw.js`) for PWA
- Mounts `<App />` into `#root`
- Imports `./tailwind.css`

**`src/App.tsx`** (root component, not lazy-loaded)  
1. Initializes Sentry if `VITE_SENTRY_DSN` is set and `NODE_ENV === 'production'`
2. Calls `supabase.auth.getSession()` to check for existing session → sets `isAuthenticated`
3. Subscribes to `supabase.auth.onAuthStateChange` for live session tracking; updates Sentry user context
4. Shows `<LoadingSpinner />` while session is being checked
5. Renders the full provider stack + `<Routes>` tree

**Provider order (outermost to innermost):**
```
ErrorBoundary
  Router (BrowserRouter)
    AppProvider          ← global domain data
      QueryProvider      ← TanStack Query
        LanguageProvider ← RTL/language
          TranslationProvider ← custom translation management
            AccessibilityProvider ← a11y context
              [Routes + MobileComponents + KeyboardNavigationHelper + AccessibilityAudit + Toaster + SpeedInsights]
```

**Route auth guard:** inline in `App.tsx` — each protected route is either the lazy component or `<Navigate to="/login" replace />` based on `isAuthenticated` boolean. There is **no separate ProtectedRoute wrapper in use** for the main routes (the `ProtectedRoute.tsx` component file exists but is unused in main routes).

---

## 5. Authentication & Session Management

### Flow

1. User visits `/` → redirected to `/login`
2. `Login.tsx` calls `supabase.auth.signInWithPassword({ email, password })`
3. On success → navigates to `/dashboard` programmatically via `useNavigate`
4. `App.tsx` `onAuthStateChange` fires → `setIsAuthenticated(true)`
5. `AppContext` `onAuthStateChange` also fires → calls `getCurrentUserTenant()` → sets `currentTenant` → triggers `loadData()`

### Signup flow
1. `supabase.auth.signUp(...)` with `user_metadata: { name, role: 'owner', commission: 5 }`
2. Immediately signs in with `signInWithPassword`
3. User is redirected to dashboard

### Tenant selection
- `TenantSelection.tsx` is at `/tenant-selection`
- Queries `tenant_user_details` Supabase view for all tenants belonging to current user (filtered by `user_active=true` AND `tenant_active=true`)
- Auto-redirects if user has exactly one tenant
- On tenant select: navigates to `/app/{tenant_slug}/dashboard` (note: this slug-based route doesn't exist in the router — functionally the user lands on `/app/...` which hits the catch-all and redirects to `/dashboard`)
- Tenant creation calls `createTenant(name, slug, userId)` from `tenantManager.ts`

### Local dev mode auth
`localStorageClient.ts` has full mock auth:
- `signInWithPassword`: creates user in localStorage on first use (auto-provision), also auto-creates a default tenant
- Always returns a session with `access_token: 'local-token-...'`
- Passwords stored in plain text in localStorage — **development only, never production**

---

## 6. Multi-Tenancy Architecture

### Database layer
All primary data tables (`products`, `sales`, `customers`, `employees`) have a `tenant_id UUID` column and Row-Level Security (RLS) policies that enforce tenant isolation.

### Key database objects
- `tenants` — tenant registry
- `tenant_users` — junction table (user ↔ tenant membership with role)
- `tenant_user_details` — VIEW joining `tenants` + `tenant_users` + auth.users, exposed via Supabase client
- Stored procedures: `create_tenant(name, slug, owner_user_id, settings)`, `add_user_to_tenant(tenant_id, user_id, role)`, `remove_user_from_tenant(...)`, `get_current_user_tenant()`, `user_has_role(required_role)`, `set_tenant_context(tenant_id)`, `log_audit(...)`, `log_activity(...)`

### Frontend layer (`src/utils/tenantManager.ts`)
All functions in this file require **`VITE_SUPABASE_SERVICE_ROLE_KEY`** (they use a service-role Supabase client `supabaseAdmin`). In local mode they no-op or return stubs.

Exported functions:
- `createTenant(name, slug, ownerUserId, settings?)` → calls `create_tenant` RPC
- `addUserToTenant(tenantId, userId, role)` — roles: `'owner' | 'manager' | 'cashier' | 'viewer'`
- `removeUserFromTenant(tenantId, userId)`
- `getCurrentUserTenant()` → returns first tenant row from `get_current_user_tenant()` RPC
- `checkUserRole(requiredRole)` → boolean
- `getTenantUsers(tenantId)` → from `tenant_user_details`
- `getTenantsByUser(userId)` → from `tenant_user_details`

### AppContext tenant handling
On auth state change, `AppContext` calls `getCurrentUserTenant()` and stores the result in `currentTenant: Tenant`:
```ts
interface Tenant {
  id: string
  name: string
  slug: string
  userRole: 'owner' | 'manager' | 'cashier' | 'viewer'
  settings: Record<string, unknown>
}
```

---

## 7. Data Architecture

### 7.1 Backend — Edge Function

**Location:** `supabase/functions/make-server-210e7672/`  
**Runtime:** Deno  
**Framework:** Hono  
**Entry point:** `index.ts`  
**URL in production:** `https://{project-ref}.supabase.co/functions/v1/make-server-210e7672`

There are **two implementations** in this directory:

| File | Status | Description |
|---|---|---|
| `index.ts` | **Active** | Hono-based, uses service-role client + anon client for user verification |
| `indexed.ts` | Legacy/reference | Uses `serve()` from Deno std, RPC-based tenant context |

The active `index.ts` uses:
- Service-role client (`SUPABASE_SERVICE_ROLE_KEY`) for DB operations
- Anon client for user verification via `verifyUser(request)` helper — extracts Bearer token and calls `supabaseAuth.auth.getUser(accessToken)`
- All routes are prefixed with `/make-server-210e7672/`

**All API routes in `index.ts`:**

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/signup` | None | Creates auth user + employee KV record |
| GET | `/auth/session` | Bearer | Returns user + employee from KV |
| GET | `/test` | None | Health check |
| GET | `/products` | Bearer | Filters by `tenant_id`; falls back to all products if no tenant |
| POST | `/products` | Bearer | Inserts into `products` table with `tenant_id` |
| PUT | `/products/:id` | Bearer | Updates via KV (not DB table) — **mixed pattern** |
| DELETE | `/products/:id` | Bearer | Deletes from KV (not DB table) — **mixed pattern** |
| POST | `/products/:productId/variants/:variantId/stock` | Bearer | Updates variant stock in DB |
| GET | `/sales` | Bearer | Filters by `tenant_id` from `tenant_users` join |
| POST | `/sales` | Bearer | Inserts sale, updates product stock, updates customer |
| GET | `/customers` | Bearer | Filters by `tenant_id` |
| POST | `/customers` | Bearer | Writes to KV — **inconsistent with GET** |
| PUT | `/customers/:id` | Bearer | Updates via KV |
| GET | `/employees` | Bearer | Filters by `tenant_id` from DB |
| POST | `/employees` | Bearer | Creates auth user via admin, writes to KV |
| PUT | `/employees/:id` | Bearer | Updates via KV |
| POST | `/init-demo` | Bearer | Seeds demo data once via KV flag `demo:initialized` |

> **CRITICAL GOTCHA:** The backend is inconsistent — GET endpoints read from the Supabase `products`/`sales`/`customers`/`employees` tables (filtered by `tenant_id`), but POST/PUT/DELETE for customers and employees write to the **KV store**, not the DB tables. This means data written via POST may not appear in GET responses in production. This is a known architectural debt.

### 7.2 Database Schema

**Core tables** (all have `tenant_id UUID` + RLS):

| Table | Key Columns |
|---|---|
| `products` | `id`, `name`, `barcode`, `sku`, `price`, `cost`, `stock_quantity`, `min_stock_level`, `category`, `supplier`, `validity_date`, `variants JSONB`, `is_active`, `tenant_id` |
| `sales` | `id`, `customer_id`, `employee_id`, `sale_date`, `subtotal`, `tax_amount`, `total_amount`, `payment_method`, `payment_status`, `notes`, `tenant_id` |
| `customers` | `id`, `name`, `phone`, `email`, `debt_balance`, `total_purchases`, `last_visit`, `tenant_id` |
| `employees` | `id`, `name`, `email`, `role`, `commission`, `total_sales`, `shifts JSONB`, `is_active`, `tenant_id` |
| `tenants` | `id`, `name`, `slug`, `settings JSONB`, `is_active` |
| `tenant_users` | `id`, `user_id`, `tenant_id`, `user_role`, `is_active` |

**Enterprise tables** (from migrations):
- `stores` — multi-location stores per tenant
- `store_users` — store-level user assignments
- `permissions` — RBAC permission registry
- `roles` — custom roles per tenant
- `role_permissions` — permission assignments to roles
- `user_roles` — role assignments to users
- `workflows` — workflow automation definitions
- `workflow_runs` — execution logs
- `locations` — physical locations (warehouse/store/storage)
- `product_batches` — batch tracking per product+location
- `purchase_orders` + `purchase_order_items`
- `stock_transfers` + `stock_transfer_items`
- `reorder_points` — per-product per-location thresholds
- `inventory_movements` — audit trail

**KV table** (used by Edge Function):
```sql
CREATE TABLE kv_store_210e7672 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX kv_store_210e7672_key_prefix_idx ON kv_store_210e7672 (key text_pattern_ops);
```
Key patterns: `product:{id}`, `employee:{id}`, `customer:{id}`, `demo:initialized`

### 7.3 Local Dev Mode

When `VITE_USE_LOCAL_MODE=true`:
- `supabase` export is replaced with `localStorageClient` (full mock of the Supabase JS client API)
- `api` object delegates to `localApi` (read/write to `localStorage` key `business_terminal_local_data`)
- `localStorageClient.from('tenant_user_details')` works for tenant selection
- Tenant management functions (`createTenant`, etc.) log warnings and return stubs
- Audit logging is disabled
- All permissions default to `true`

`localStorageClient` caveats:
- `rpc()` always returns `{ data: [], error: null }` — no stored procedure support
- The query builder supports `.select().eq().order().limit().single()` but not complex joins or `.or()`
- Passwords are stored in plain text

### 7.4 KV Store Pattern

The `kv_store.ts` module provides a simple key-value API over the `kv_store_210e7672` Supabase table:

```ts
kv.set(key, value)     // upsert
kv.get(key)            // returns value JSONB parsed
kv.del(key)
kv.mset(keys, values)  // bulk upsert
kv.mget(keys)          // bulk get (returns values in query order)
kv.mdel(keys)
kv.getByPrefix(prefix) // LIKE '%prefix%' scan
```

---

## 8. Global State (AppContext)

**File:** `src/context/AppContext.tsx`  
**Hook:** `useApp()` — throws if used outside `AppProvider`

### State fields

| Field | Type | Description |
|---|---|---|
| `user` | `User \| null` | Always `null` — setter exists but is never populated (auth state lives in `supabase.auth`) |
| `products` | `Product[]` | All products for current tenant |
| `sales` | `Sale[]` | All sales for current tenant |
| `customers` | `Customer[]` | All customers for current tenant |
| `employees` | `Employee[]` | All employees for current tenant |
| `currentEmployee` | `Employee \| null` | Auto-set to `employees[0]` on load |
| `currentTenant` | `Tenant \| null` | Active tenant context |
| `isModalOpen` | `boolean` | Global modal flag (rarely used) |
| `loading` | `boolean` | True while initial data load is running |
| `hasSession` | `boolean` | Whether Supabase auth session exists |

### Domain types (defined in AppContext.tsx, imported everywhere)

```ts
interface Product {
  id?: string; name: string; barcode: string; sku: string;
  variants: ProductVariant[]; supplier: string; category: string; validityDate?: string;
}
interface ProductVariant {
  id: string; attributes: Record<string, string>;
  cost: number; costHistory: CostEntry[]; price: number; stock: number; reorderLevel: number;
}
interface CostEntry { date: string; cost: number; quantity: number; }
interface Sale {
  id: string; date: string; items: SaleItem[];
  subtotal: number; total: number; paymentMethod: 'cash' | 'card';
  employeeId: string; customerId?: string;
}
interface SaleItem {
  productId: string; variantId: string; productName: string;
  quantity: number; price: number; cost: number;
}
interface Customer {
  id: string; name: string; phone: string; email?: string;
  debtBalance: number; totalPurchases: number; lastPurchaseDate?: string;
  visitCount?: number; createdAt?: string;
}
interface Employee {
  id: string; name: string; email: string;
  role: 'admin' | 'manager' | 'cashier';
  commission: number; totalSales: number; shifts: Shift[];
}
interface Shift {
  id: string; date: string; startTime: string; endTime: string;
  salesCount: number; totalRevenue: number;
}
```

### Actions / mutations

| Action | Signature | Behavior |
|---|---|---|
| `addProduct` | `(product: Product) => void` | Validates via `DataValidator.validateProduct`, calls `api.post('/products', ...)`, updates local state |
| `updateProduct` | `(id, partial) => void` | `api.put('/products/{id}', ...)`, updates local state |
| `deleteProduct` | `(id) => void` | `api.delete('/products/{id}')`, filters local state |
| `addSale` | `(sale: Sale) => void` | Validates, calls `TransactionManager.executeSaleTransaction`, re-fetches products + employees |
| `addCustomer` | `(customer: Customer) => void` | Validates, `api.post('/customers', ...)` |
| `updateCustomer` | `(id, partial) => void` | `api.put('/customers/{id}', ...)` |
| `addEmployee` | `(employee: Employee) => void` | Validates, generates temp password, `api.post('/employees', ...)` |
| `updateEmployee` | `(id, partial) => void` | `api.put('/employees/{id}', ...)` |
| `updateStock` | `(productId, variantId, qty) => void` | Acquires `StockUpdateLock`, enqueues in `OperationQueue`, calls `/products/{id}/variants/{vId}/stock` |
| `setCurrentEmployee` | `(e: Employee \| null) => void` | Local state only |
| `switchTenant` | `(tenantId) => void` | Triggers `loadData()` — no actual tenant switching logic yet |
| `setUser` | `() => void` | No-op stub |
| `setCurrentTenant` | `(t: Tenant \| null) => void` | Local state update |
| `setModalOpen` | `(open: boolean) => void` | Toggles `isModalOpen` |

### Data load flow

```
supabase.auth session detected
  ↓
getCurrentUserTenant() [tenantManager.ts]
  ↓ sets currentTenant
setTimeout(100ms) → loadData()
  ↓
api.post('/init-demo', {})   ← seeds demo data if none
  ↓
Promise.all([
  api.get('/products'),
  api.get('/sales'),
  api.get('/customers'),
  api.get('/employees')
])
  ↓
Transforms DB product shape → frontend Product shape
(DB: stock_quantity → variants[0].stock, etc.)
  ↓
setProducts / setSales / setCustomers / setEmployees
  ↓
setCurrentEmployee(employees[0])
```

---

## 9. Pages — Detailed Breakdown

### 9.1 `/login` → `Login.tsx`
- **Not protected.** Accessible without auth.
- State: `isSignup`, `email`, `password`, `businessName`, `loading`, `error`, `logoError`
- On submit: `supabase.auth.signUp` or `signInWithPassword` → navigates to `/dashboard`
- Reads from: `BRAND` constant for branding, `LOGO_PLACEHOLDER_MESSAGE`
- Uses `CreateTenantModal` (mounted but not wired via this file's JSX in the visible code)
- Test attributes: `data-testid="email-input"`, `data-testid="password-input"`, `data-testid="login-button"`, `data-testid="error-message"`

### 9.2 `/tenant-selection` → `TenantSelection.tsx`
- **Not protected by router** (auth checked internally).
- Queries `supabase.from('tenant_user_details')` directly (NOT through `api`)
- If 1 tenant: auto-redirect to `/app/{slug}/dashboard`
- If 0 tenants: shows create form
- Calls `createTenant()` from `tenantManager.ts`
- Note: `createTenant` requires `VITE_SUPABASE_SERVICE_ROLE_KEY`

### 9.3 `/dashboard` → `Dashboard.tsx`
- **State consumed:** `products`, `sales`, `customers`, `currentEmployee` (via `useApp`)
- **API calls:** None beyond what AppContext loads; re-checks `tenant_user_details` directly on mount to redirect if no tenant
- **Metrics shown:** total product variants, total stock units, low stock count, today's revenue, today's profit, total customers, customers with debt
- **Key sub-components:** `Layout`

### 9.4 `/pos` → `POS.tsx`
- **State consumed:** `products`, `customers`, `currentEmployee`, `addSale`, `updateCustomer`
- **No direct API calls** — all mutations go through AppContext actions
- **Local state:** `cart: CartItem[]`, `barcode`, `selectedCustomer`, `paymentMethod`, `showReceipt`, `lastSale`, split payment states, tip state, coupon state, loyalty state, receipt template state, `taxRate = 0.08`
- **Barcode flow:** finds product by `product.barcode`, adds first variant to cart
- **Checkout flow:** calls `addSale()` which calls `TransactionManager.executeSaleTransaction()`
- **Sub-components:** `DiscountModal`, `LoyaltyModal`, `ReceiptCustomizationModal`, `SplitPaymentModal`, `TipsModal`, `Layout`
- **Calculations:** `POSCalculator` from `posCalculations.ts`
- **Demo data:** coupons, loyalty program, receipt templates loaded from `src/data/demoPosData.ts`

### 9.5 `/inventory` → `Inventory.tsx`
- **State consumed:** `products`, `deleteProduct`
- **Local state:** `searchQuery`, `filterCategory`, `showAddModal`, `showImportModal`, `selectedProduct`
- **Filtering:** by name/barcode/SKU and category
- **Stats:** total SKUs, total variants, total stock units, low stock count, inventory value
- **Sub-components:** `AddProductModal`, `ImportInventoryModal`, `Layout`
- **Child routes (lazy):** `/inventory/batch-tracking`, `/inventory/suppliers`, `/inventory/purchase-orders`, `/inventory/stock-transfers`, `/inventory/reorder-points`

### 9.6 `/inventory/batch-tracking` → `BatchTracking.tsx`
Manages product batches, expiration tracking, FIFO enforcement. Uses `Supplier`, `Location`, `ProductBatch` types from `src/types/inventory.ts`. Mostly UI with demo data.

### 9.7 `/customers` → `Customers.tsx`
- **State consumed:** `customers`, `addCustomer`, `updateCustomer`
- **Tabs:** `overview` | `segments` | `communications` | `marketing` | `analytics`
- **Sub-components (CRM module):** `CRMAnalytics`, `CustomerSegmentation`, `AutomatedMarketing`, `MarketingCampaigns`, `CustomerCommunicationHistory`, `Layout`
- **Debt payment:** `handlePayDebt(customerId, amount)` → `updateCustomer(id, { debtBalance: newBalance })`

### 9.8 `/employees` → `Employees.tsx`
- **State consumed:** `employees`, `sales`, `addEmployee`, `currentTenant`
- **Shows:** TenantSwitcher, employee cards with role, commission, sales, `InviteTeamMemberModal`
- **Add employee:** generates temp password, calls `addEmployee()` which calls `api.post('/employees', { ...employee, password: tempPassword })`

### 9.9 `/reports` → `Reports.tsx`
- **State consumed:** `products`, `sales`, `customers`, `employees`
- **Date ranges:** today / last 7 days / last 30 days
- **Metrics:** revenue, profit, transaction count, avg transaction value, top products, employee performance
- **Charts:** Bar (daily revenue), Line (cumulative), Pie (payment methods) via Recharts
- **Sub-components (lazy):** `AdvancedAnalytics`, `ReportBuilder`, `Forecasting`
- **Export:** `ExportService.exportToPDF`, `exportToCSV`, `exportToExcel`

### 9.10 `/profile-settings` → `ProfileSettings.tsx`
User profile editing, password change, notification preferences. Calls `supabase.auth.updateUser`.

### 9.11 `/system-settings` → `SystemSettings.tsx`
- **State consumed:** `currentEmployee` (for role check), `announce/setAriaAttribute/setRole` from `useAccessibility`
- **Tabs:** general, business, security, notifications, integrations, backup, team
- **Uses:** `BRAND` constant for defaults; `log` from logger util
- **Timezone default:** `Asia/Beirut`; currency default: `USD`

### 9.12 `/activity-log` → `ActivityLog.tsx`
Static demo data in local state (no real API calls). Shows filtered log entries by category/severity/date range. Categories: `system | user | inventory | sales | customer | employee | settings`.

### 9.13 `/translation-manager` → `TranslationManager.tsx`
Admin UI for managing i18n translation keys. Uses `TranslationContext`.

### 9.14 `/enterprise` → `EnterpriseDashboard.tsx`
Landing for enterprise features with live stats (mock data). Links to sub-routes.

### 9.15 `/enterprise/roles` → `RolesAndPermissionsManager.tsx`
RBAC management UI. Reads permissions and roles schema.

### 9.16 `/enterprise/workflows` → `WorkflowAutomation.tsx`
Visual workflow builder for automated business rules.

### 9.17 `/enterprise/locations` → `MultiLocationSupport.tsx`
Multi-store/location management. Uses `stores` table.

### 9.18 `/enterprise/api` → `ApiAndWebhooks.tsx`
API key management and webhook configuration UI.

### 9.19 `/monitoring` → `MonitoringDashboard.tsx`
Tabs: overview alerts | `PerformanceDashboard` | `HealthCheckDashboard` | `ErrorTrackingDashboard`. Alert management with severity levels (`low | medium | high | critical`).

---

## 10. Major Shared Components

### `Layout.tsx`
The main shell used by every authenticated page. Contains:
- **Sidebar** (desktop) with full navigation tree including sub-items
- **Top navigation bar** with search, notifications, profile, language switcher
- **Mobile nav toggle**
- `StoreSwitcher`, `TenantInfo`, `TenantSwitcher`, `UserProfileModal`
- `LanguageSwitcher`
- Logout calls `supabase.auth.signOut()` → navigates to `/login`
- Uses `useAccessibility()` for announce/aria helpers

Navigation structure:
- Dashboard
- Inventory (+ sub: Products, Batch Tracking, Suppliers, Purchase Orders, Stock Transfers, Reorder Points)
- POS
- Customers
- Employees
- Reports
- Translation Manager
- Enterprise (+ sub: Roles, Workflows, Locations, API)
- Monitoring
- Activity Log
- System Settings
- Help & Support

### `EnhancedPOS.tsx`
A more feature-rich POS alternative loaded lazily. Includes more advanced barcode scanning flow, touch-optimized UI.

### `AdvancedAnalytics.tsx`
Deep analytics component embedded in Reports page. Multiple chart types, date filtering, employee comparison.

### `ReportBuilder.tsx`
Drag-and-drop custom report builder. Users can compose report widgets.

### `Forecasting.tsx`
Sales forecasting component using trend analysis from historical sales data.

### `ErrorBoundary.tsx`
Standard React error boundary wrapping the entire app. Shows fallback UI on uncaught errors.

---

## 11. CRM Module (`src/components/crm/`)

| File | Purpose |
|---|---|
| `CRMAnalytics.tsx` | CRM-level analytics: retention rate, CLV, segment growth, communication metrics |
| `CustomerSegmentation.tsx` | Dynamic and static segment management with `SegmentCriteria` filtering |
| `CustomerCommunicationHistory.tsx` | Timeline of email/SMS/call/in-person communications per customer |
| `AutomatedMarketing.tsx` | Workflow-based automated campaigns; uses `AutomatedWorkflow` / `WorkflowTrigger` / `WorkflowAction` types |
| `MarketingCampaigns.tsx` | Campaign creation/management with `MarketingCampaign` type |

CRM types are in `src/types/crm.ts`. Key types: `Customer` (extended version with segments, communication history, CLV), `Communication`, `CustomerSegment`, `SegmentCriteria`, `MarketingCampaign`, `AutomatedWorkflow`, `CRMAnalytics`.

---

## 12. Enterprise Module (`src/components/enterprise/`)

| File | Purpose |
|---|---|
| `EnterpriseDashboard.tsx` | Overview with `EnterpriseStats`, `RecentActivity`, `SystemHealth` (all local state/demo) |
| `RolesAndPermissionsManager.tsx` | RBAC UI for managing custom roles and permission assignments |
| `WorkflowAutomation.tsx` | Visual workflow automation builder |
| `MultiLocationSupport.tsx` | Manage stores/locations, transfer stock between them |
| `ApiAndWebhooks.tsx` | API key generation and webhook registration UI |

---

## 13. Monitoring Module (`src/components/monitoring/`)

| File | Purpose |
|---|---|
| `MonitoringDashboard.tsx` | Parent with tabs: overview, performance, health, errors |
| `PerformanceDashboard.tsx` | LCP/FID/CLS display, API latency, bundle size |
| `HealthCheckDashboard.tsx` | Service health checks for API, DB, Edge Functions, CDN |
| `ErrorTrackingDashboard.tsx` | Recent errors by severity, stack traces |

All monitoring components use local state with demo/mock data — they are UI scaffolds, not wired to real monitoring backends.

---

## 14. Services

### `src/services/sentryService.ts`
Singleton `SentryService` class (pattern: `SentryService.getInstance()`).

Key methods:
- `initialize(config: SentryConfig)` — called once in `App.tsx` on prod
- `setUser(user: Sentry.User | null)` — called on auth change
- `captureException(error, context?)` — manual error reporting
- `captureMessage(message, level?, context?)`
- `captureUserAction(action, details?)` — adds breadcrumb
- `captureApiCall(url, method, statusCode, duration)` — adds breadcrumb
- `capturePerformanceMetric(name, value, unit?)` — adds breadcrumb

`PerformanceMonitor` export: `startTimer(name)` returns a stop function; `measureAsync(name, fn)` wraps async calls.

Export `sentryService` is the singleton instance. Export `useSentry()` is a React hook wrapping the instance methods.

---

## 15. Hooks

### `src/hooks/useApi.ts`
TanStack Query wrappers over `api` + `supabase` direct. Use these in components that want React Query caching rather than AppContext.

- `useProducts()`, `useProduct(id)`, `useCreateProduct()`, `useUpdateProduct()`, `useDeleteProduct()`
- `useSales()`, `useCreateSale()`
- `useCustomers()`, `useCustomer(id)`, `useCreateCustomer()`, `useUpdateCustomer()`
- `useEmployees()`, `useEmployee(id)`, `useCreateEmployee()`, `useUpdateEmployee()`
- `useUpdateStock()` — calls `/products/{id}/variants/{vId}/stock`
- `queryKeys` — canonical query key factory: `queryKeys.products`, `queryKeys.product(id)`, etc.

> **Important:** These hooks read directly from the `products/sales/customers/employees` Supabase tables (via `supabase.from(table).select()`), **bypassing the Edge Function**. They don't apply tenant filtering automatically unless the RLS policies handle it. Use AppContext actions for mutations in most cases.

### `src/hooks/usePWA.ts`
- State: `isInstallable`, `isInstalled`, `isOnline`
- `install()` — triggers `beforeinstallprompt`
- `requestNotificationPermission()` — Web Notifications API
- `showNotification(title, options?)` — via service worker

### `src/hooks/useOfflineSync.ts`
- Uses IndexedDB (`BusinessTerminalDB` database, `pendingActions` object store) to queue mutations when offline
- `syncStatus: { isOnline, pendingActions, lastSyncTime, isSyncing }`
- Replays queued actions when coming back online

### `src/hooks/useLocalizedFormat.ts`
Formatting hooks that use `LanguageContext` for locale-aware currency/date formatting.

### `src/hooks/useModalAccessibility.ts`
Focus trap + aria-modal management for modals.

### `src/hooks/useTouchGestures.ts`
Swipe gesture detection for mobile navigation.

### `src/hooks/useServiceWorker.ts`
Registration and update management for the PWA service worker.

### `src/hooks/usePushNotifications.ts`
Web Push API integration (subscription management).

---

## 16. Utilities — Detailed Reference

### `supabaseClient.ts` — THE entry point for all backend calls
- Exports `supabase` (auth client; mock in local mode)
- Exports `api` object with `.get(endpoint)`, `.post(endpoint, data)`, `.put(endpoint, data)`, `.delete(endpoint)`
- Exports `getAuthHeaders()` — used internally
- All `api` calls prepend the Edge Function URL and add cache-busting `_cb` param
- **Always import from here, never create new Supabase clients in components**

### `localStorageClient.ts`
Complete Supabase JS API mock backed by `localStorage['business_terminal_local_data']`. Used automatically when `VITE_USE_LOCAL_MODE=true`. Implements `auth`, `from(table)`, `rpc()`.

### `tenantManager.ts`
Admin functions requiring service role key. See Section 6. Functions: `createTenant`, `addUserToTenant`, `removeUserFromTenant`, `getCurrentUserTenant`, `checkUserRole`, `getTenantUsers`, `getTenantsByUser`.

### `dataValidation.ts`
`DataValidator` class with static methods:
- `validateProduct(product)` → `ValidationResult`
- `validateSale(sale)` → `ValidationResult`
- `validateCustomer(customer)` → `ValidationResult`
- `validateEmployee(employee)` → `ValidationResult`
- `validateStockUpdate(productId, variantId, quantity)` → `ValidationResult`

`ValidationResult = { isValid: boolean; errors: string[]; warnings: string[] }`

All AppContext mutations call their respective validator before making API calls.

### `raceConditionPrevention.ts`
Three utility classes for concurrency control:

**`OperationQueue`** — serial execution queue per key:
- `OperationQueue.enqueue(queueKey, operation, operationType)` → Promise
- 30-second timeout per operation
- Multiple callers with same key are processed serially

**`StockUpdateLock`** — per-product-variant mutex:
- `StockUpdateLock.acquireLock(productId, variantId, timeout?)` → `string | null` (operationId or null if locked)
- `StockUpdateLock.releaseLock(productId, variantId, operationId)` → boolean
- `StockUpdateLock.cleanupExpiredLocks()` — called automatically every 10 seconds
- Lock expires after 30 seconds

**`ConcurrentOperationGuard`** — prevents duplicate concurrent operations:
- `ConcurrentOperationGuard.executeWithGuard(resourceKey, operationId, operation)` → throws if same operationId is in-flight

### `optimisticUpdates.ts`
Two hooks:

**`useOptimisticUpdates<T>(initialData, onUpdate)`**
- `addOptimisticUpdate(item)` — adds item locally, returns update ID
- `updateOptimisticItem(id, partial)` — update in-progress item
- `markUpdateSuccess(id, finalData?)` — confirms, cleans up after 1s
- `markUpdateError(id, error)` — marks error, cleans up after 3s
- `hasPendingUpdates()`, `getPendingUpdates()`, `getErrorUpdates()`

**`useOptimisticStockUpdates(products, onUpdate)`**
- `updateStockOptimistically(productId, variantId, newStock)` — instantly updates local product state
- `confirmStockUpdate(productId, variantId)` — clears pending
- `revertStockUpdate(productId, variantId, originalStock)` — restores on error
- `getOptimisticStock(productId, variantId)` — returns pending stock value if any

### `transactionManager.ts`
`TransactionManager` class for multi-step atomic operations with rollback:

- `executeTransaction(operations: TransactionOperation[])` → `TransactionResult`
- Operations: `{ type: 'create'|'update'|'delete', entity: 'product'|'sale'|'customer'|'employee'|'stock', data, id? }`
- On failure: attempts rollback in reverse order
- **`executeSaleTransaction(saleData, products)`** — the main sale workflow: creates sale + decrements stock for each item + updates customer
- `executeBulkStockUpdate(updates)` — batch stock changes

### `auditLogger.ts`
Requires `VITE_SUPABASE_SERVICE_ROLE_KEY`. Disabled in local mode.

- `logAudit(action, entityType, entityId?, oldValues?, newValues?, metadata?)` — calls `log_audit` RPC
- `logActivity(action, description, entityType?, entityId?, metadata?)` — calls `log_activity` RPC
- `logUserLogin(userId)`, `logUserLogout(userId)`
- `logProductCreate/Update/Delete(productId, data?)` — convenience wrappers
- `logSaleCreate(saleId, data?)`
- `logStockUpdate(productId, variantId, oldQty, newQty)`

### `posCalculations.ts`
`POSCalculator` class (all static methods):
- `calculateCouponDiscount(subtotal, coupon, cartItems)` → number — handles `percentage | fixed | bogo | buy_x_get_y`
- `calculatePromotionDiscount(subtotal, promotion, cartItems)` → number
- `calculateTip(subtotal, tipInfo)` → number — handles `percentage | fixed | custom`
- `calculateLoyaltyPointsEarned(amount, program)` → number
- `calculateLoyaltyDiscount(pointsToRedeem, program)` → number
- `canRedeemPoints(points, customerLoyalty)` → boolean
- `validateSplitPayments(payments, totalAmount)` → `{ isValid, error? }`
- `calculateTax(subtotal, taxRate = 0.08)` → number
- `calculateFinalTotal(subtotal, tax, discounts, tips)` → number (Math.max(0, ...))

`CouponValidator.validateCoupon(coupon)` → `{ isValid, errors[] }`

### `cart.ts`
Pure utility functions, no dependencies:
- `calculateSubtotal(items: CartLikeItem[])` → number (sum of price × quantity)
- `calculateTotal(items, options?)` → number (subtotal × (1 + taxRate) − discount)

### `exportService.ts`
`ExportService` class:
- `exportToPDF(elementId, filename, options?)` — html2canvas + jsPDF, landscape A4
- `exportToCSV(data: ExportData, filename)` — CSV with title/metadata headers
- `exportToExcel(data: ExportData, filename)` — ExcelJS workbook with styled headers

`ExportData = { headers: string[]; rows: (string|number)[][]; title?: string; metadata?: { dateRange, generatedAt, totalRows } }`

### `formatting.ts`
Locale-aware formatting using `Intl` APIs, tied to the current i18n language:
- `initializeFormatters(language)` — lazy-initializes Intl formatters
- `formatCurrency(amount, language?)` → string
- `formatNumber(value, language?)` → string
- `formatDate(date, format: 'short'|'long'|'time'|'date', language?)` → string
- `getCurrencyForLanguage(language)` → ISO currency code (e.g., `'ar'` → `'SAR'`)

### `queryCache.ts`
Cache strategy presets for TanStack Query:
- `cacheConfig.realtime` — staleTime: 0, gcTime: 1min
- `cacheConfig.user` — staleTime: 5min, gcTime: 10min
- `cacheConfig.static` — staleTime: 30min, gcTime: 1hr
- `cacheConfig.reference` — staleTime: 2hr, gcTime: 24hr
- `prefetchStrategy.onHover(queryClient, queryKey, fn)` — returns event handlers
- `invalidationStrategy.invalidateRelated(queryClient, baseQueryKey)` — prefix-based invalidation
- `invalidationStrategy.optimisticUpdate(queryClient, queryKey, newData, updateFn)` — returns rollback fn
- `memoryManagement.cleanup(queryClient)` — removes queries >30min old
- `createOptimizedQueryClient()` — creates QueryClient with auto-cleanup every 10min
- `useQueryPerformance()` hook — getCacheStats, clearCache, prefetchCriticalData

### `performanceMonitor.ts`
`PerformanceMonitor` class (static):
- `initialize()` — sets up PerformanceObserver for LCP, FID, CLS, resource timing, long tasks
- `recordMetric(name, value)` — stores in Map, reports to Sentry
- `getMetric(name)` → average of recorded values
- Reports LCP/FID/CLS to `sentryService.capturePerformanceMetric`

### `storeManager.ts`
Admin store management (requires service role key):
- `createStore(name, code, address?, phone?, email?)` → calls `create_store` RPC
- `getStoresByTenant(tenantId)` → from `stores` table
- `updateStore(storeId, updates)`
- `assignUserToStore(storeId, userId, role)`
- `removeUserFromStore(storeId, userId)`

### `securityHeaders.ts`
Vite plugin that adds security headers to dev and preview server responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, mic, geolocation, payment, usb
- `Content-Security-Policy` — self + Supabase + Google + Vercel analytics

### `logger.ts`
Singleton `Logger` class. In production: log level = WARN (DEBUG/INFO silenced). API:
```ts
log.debug(message, context?)
log.info(message, context?)
log.warn(message, context?)
log.error(message, error?, context?)
log.time(label) / log.timeEnd(label)
log.group(label, collapsed?) / log.groupEnd()
log.table(data)
```
Keeps last 1000 log entries in memory. Access via `logger.getLogs()`.

### `frontendSecurity.ts`
`FrontendSecurity` class:
- `validateFormInput(input, type)` — wraps `SecurityValidator` from `enhancedValidation.ts`
- `sanitizeHtml(html)` — uses `textContent` to strip tags (XSS protection)
- `safeJsonParse(jsonString, schema?)` — wraps JSON.parse + `preventPrototypePollution`
- `preventPrototypePollution(obj)` — strips `__proto__`, `constructor`, `prototype` keys recursively

### `src/middleware/rateLimiter.ts`
`RateLimiter` class (frontend-side, per-browser):
- `config: { windowMs, maxRequests, skipSuccessfulRequests?, skipFailedRequests?, keyGenerator?, onLimitReached? }`
- `check(request)` → `{ allowed: boolean; remaining: number; resetTime: number }`
- Auto-cleanup of expired entries every 5 minutes

### `src/middleware/inputValidation.ts`
Input sanitization middleware for forms.

---

## 17. Security Architecture

### Frontend security layers
1. **Input validation:** `DataValidator` (domain rules) + `SecurityValidator` from `enhancedValidation.ts` (sanitization)
2. **XSS prevention:** `FrontendSecurity.sanitizeHtml()` for dynamic content
3. **Prototype pollution prevention:** `FrontendSecurity.preventPrototypePollution()`
4. **Rate limiting:** `RateLimiter` in `src/middleware/rateLimiter.ts`
5. **Security headers:** Vite plugin in dev/preview; Vercel sets headers in production
6. **CSP:** script-src restricts to self + Google Analytics + Vercel Speed Insights

### Backend security
1. **Auth:** Every Edge Function route calls `verifyUser(request)` → validates Bearer token via `supabaseAuth.auth.getUser(token)`
2. **Tenant isolation:** All data queries include `eq('tenant_id', tenantUser.tenant_id)` filter + RLS
3. **Service role usage:** Only in admin operations; never exposed to browser
4. **CORS:** `app.use('*', cors())` — allows all origins (acceptable for Supabase Edge Functions)

### RBAC
Defined in `supabase/migrations/20241228_advanced_roles_permissions.sql`. Permissions follow `{resource}.{action}` naming (e.g., `products.create`, `sales.refund`). Roles are per-tenant. System roles (`owner`, `manager`, `cashier`) are global.

### Audit logging
Via `logAudit()` / `logActivity()` in `auditLogger.ts`. Writes to Supabase via `log_audit` / `log_activity` RPCs. Disabled in local mode. Requires service role key.

---

## 18. Internationalization & RTL

### Supported languages
`en` (English, default) | `es` (Spanish) | `fr` (French) | `ar` (Arabic, RTL) | `zh` (Chinese)

### Setup (`src/i18n/index.ts`)
- Uses `i18next` + `i18next-browser-languagedetector` + `i18next-http-backend`
- Language detection order: `localStorage['language']` → `navigator.language` → `htmlTag`
- Translation files: `src/i18n/locales/{en,es,fr,ar,zh}.json`
- RTL languages: `['ar']`
- Exports: `isRTL(language)`, `getCurrentLanguage()`, `supportedLanguages[]`

### RTL handling (`src/contexts/LanguageContext.tsx`)
On language change:
- `document.documentElement.dir = 'rtl' | 'ltr'`
- `document.documentElement.lang = lng`
- `document.body.classList.add/remove('rtl')`

RTL CSS overrides in `src/styles/rtl.css` (imported globally in `App.tsx`).

### Usage pattern
```tsx
const { t } = useTranslation();
// t('auth.signIn'), t('common.loading'), etc.
```

### Language change
```tsx
const { changeLanguage } = useLanguage();
changeLanguage('ar'); // also persists to localStorage
```

---

## 19. Performance Patterns

### Code splitting
All pages and heavy components are lazy-loaded via `React.lazy()` + `<Suspense fallback={<LoadingSpinner />}>`. Fallback wraps the entire routes tree in `App.tsx`.

### Bundle chunking (vite.config.ts)
Manual chunks: `vendor` (react/react-dom), `radix` (all Radix UI), `charts` (recharts), `utils` (date-fns/clsx), `icons` (lucide), `supabase`, `query` (TanStack), `router`, `forms`, `dnd`, `virtualization` (react-window), `i18n`, `export` (exceljs/jspdf/html2canvas).

### Virtualization
Large lists use `react-window` (`FixedSizeList`) + `react-window-infinite-loader` + `react-virtualized-auto-sizer`. See `src/utils/responsive.ts` for breakpoint helpers.

### TanStack Query caching
- Default `staleTime`: 5 minutes, `gcTime`: 10 minutes
- No refetch on window focus (avoids flash on tab switch)
- Retries: 3x for 5xx errors, 0x for 4xx errors
- Cache configs in `src/utils/queryCache.ts`

### Optimistic updates
Available via `useOptimisticUpdates` hook. AppContext mutations do NOT use optimistic updates by default — they wait for API confirmation.

### Web Vitals monitoring
`PerformanceMonitor.initialize()` observes LCP, FID, CLS and reports to Sentry.

### PWA
- Service worker at `public/sw.js`
- Registered in `src/main.tsx`
- `usePWA()` hook manages install prompt, online/offline state
- Offline queue: `useOfflineSync()` stores mutations in IndexedDB `BusinessTerminalDB`

---

## 20. Testing Architecture

### Unit tests (Vitest)
- Config: `vite.config.ts` (tests section) and `vitest.config.ts`
- Environment: jsdom
- Setup file: `vitest.setup.ts`
- Test files: `src/**/*.test.{ts,tsx}`
- **Coverage thresholds (enforced):** 90% branches, 90% functions, 90% lines, 90% statements
- Excluded from coverage: `tests/`, `*.stories.*`, E2E files

### E2E tests (Playwright)
- Config: `playwright.config.ts` (main), `playwright.optimized.config.ts` (optimized), `playwright.visual.config.ts` (visual)
- Test files: `tests/e2e/*.spec.ts`
- Auth setup: `tests/e2e/auth.setup.ts` — creates auth state file `tests/e2e/auth-state.json`
- Auth mocking: `tests/e2e/auth-mocks.ts` — see `AUTH_MOCKING_GUIDE.md` before writing new E2E tests
- Test isolation: `tests/e2e/isolation.setup.ts` — per-test data setup

Key E2E test files:
- `auth.spec.ts` — login/logout/signup flows
- `dashboard.spec.ts` / `dashboard-optimized.spec.ts` — dashboard rendering
- `accessibility.spec.ts` — axe-playwright a11y checks
- `visual.spec.ts` — screenshot comparisons
- `critical-paths.spec.ts` — core business flows

### Storybook
- Config: `.storybook/main.ts` (Vite builder, React plugin, Playwright for testing, a11y addon)
- Stories: `src/stories/` + `src/components/**/*.stories.tsx`
- Visual regression: `npm run test:storybook` via `@storybook/test-runner`
- Vitest integration: Storybook stories run as Vitest browser tests via `@storybook/addon-vitest`

---

## 21. CI/CD & Deployment

### GitHub Actions workflows

**`ci.yml`** (on push to main/develop + PRs):
1. `quality-checks` — lint + typecheck (parallel with tests)
2. `unit-tests` — Vitest with coverage → Codecov
3. `build-and-test` — build + Playwright E2E on matrix: `[chromium, firefox, webkit]`
4. `deploy-staging` — on `develop` branch → Vercel staging
5. `deploy-production` — on `main` branch → Vercel production

**`deploy.yml`** (on push to main or version tags):
- typecheck → test:coverage → build → test:e2e → Vercel prod deploy

**`test.yml`** — dedicated test runner

**`monitoring.yml`** — scheduled health checks

### Vercel config
- `vercel.json` — production routing/headers
- `vercel.staging.json` — staging-specific config
- Production URL: `https://all-in-one-business-terminal.vercel.app`
- Staging URL: `https://staging-all-in-one-business-terminal.vercel.app`

### Edge Function deployment
```bash
cd supabase/functions/make-server-210e7672
npx supabase functions deploy make-server-210e7672 --project-ref <PROJECT_REF>
```
Use `--debug` if CLI reports missing entrypoint. Must run from the function directory.

### Docker
`Dockerfile` + `docker-compose.yml` available for containerized local dev. `docker-compose up` starts on port 5173.

### Scripts
- `scripts/build-production.sh` — production build automation
- `scripts/blue-green-deploy.sh` — zero-downtime deployment
- `scripts/rollback.sh` — rollback to previous deployment
- `scripts/deployment-monitor.sh` — post-deploy health monitoring
- `scripts/health-check.sh` — endpoint health verification
- `scripts/visual-tests.sh` — visual regression test runner

---

## 22. Known Patterns & Conventions

### Import conventions
- Always use `@/` alias for src imports: `import { useApp } from '@/context/AppContext'`
- Import types with `import type` when possible (TypeScript `verbatimModuleSyntax` requires it)
- Component exports: named export for utilities/hooks, default export for pages and components

### Component structure
All pages use `<Layout>` as their root element. Layout handles the sidebar and top nav.

### API response shape
The Edge Function returns shaped responses like `{ product: {...} }`, `{ products: [...] }`, `{ sale: {...} }`, etc. AppContext destructures these: `const { product: newProduct } = await api.post('/products', ...)`.

### Error handling
All AppContext mutations follow this pattern:
```ts
try {
  const result = await api.post(...)
  // update local state
  toast.success(...)
} catch (error) {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  log.error('...', errorObj)
  toast.error('...', { description: error instanceof Error ? error.message : 'Unknown error' })
  throw error  // re-throw so callers can handle
}
```

### Toast notifications
Use `toast` from `sonner`. Pattern: `toast.success('title', { description: '...' })` or `toast.error(...)`.

### Accessibility
All pages that use interactive elements should:
- Call `announce(message, 'polite' | 'assertive')` from `useAccessibility()` on important state changes
- Use `setAriaAttribute(el, attr, value)` for dynamic ARIA
- Test with keyboard navigation

### CSS variables
The app uses CSS custom properties for theming: `--background`, `--foreground`, etc. Set on the root div in `App.tsx`: `style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}`.

---

## 23. Common Gotchas

### 1. Backend inconsistency: GET vs POST/PUT for customers/employees
GET `/customers` reads from the Supabase `customers` table. POST `/customers` writes to the KV store. These are different storage backends. In production, you may write a customer and not see it in the list on next GET.

### 2. `currentUser` is always null in AppContext
`AppContext.user` is always `null`. The `setUser` action is a no-op stub. Actual auth state lives in `supabase.auth.getSession()`.

### 3. TenantSelection redirect goes to non-existent route
When selecting a tenant, `handleSelectTenant` navigates to `/app/{slug}/dashboard`. This route doesn't exist in the router — the catch-all `*` route redirects to `/dashboard` if authenticated. So tenant selection effectively just redirects to `/dashboard`.

### 4. Demo data seeding runs every session
`AppContext.loadData()` always calls `api.post('/init-demo', {})`. The Edge Function only seeds if `kv.get('demo:initialized')` is null. But in local mode, `localApi.post('/init-demo')` calls `localApi.post` which tries to add to `localStorage['init-demo']` — there is no seed logic in local mode.

### 5. `OperationQueue.performOperation` is a stub
In `raceConditionPrevention.ts`, `performOperation()` adds a random 0–100ms delay and returns `{ success: true, operationId }`. The actual operation is passed via the `operation` object but `executeOperation` calls `performOperation` instead of executing the actual function. The `operation` parameter in `OperationQueue.enqueue` (the second arg `() => Promise<T>`) is never actually called. **This is a bug** — `updateStock` in AppContext will always succeed with `{ success: true }` from the queue, then immediately make the real API call. The result from the queue is used as `setProducts(products.map(...))` which replaces products with `{ success: true }`.

### 6. Service worker and build output
The `build/` directory (Vite output) and `public/` directory both contain `sw.js`. The `public/sw.js.backup` file suggests the service worker has been modified. If updating the SW, update in `public/sw.js` — it gets copied to `build/` on build.

### 7. `src/context/` vs `src/contexts/`
Two context directories exist. `src/context/` contains `AppContext.tsx` (the main one). `src/contexts/` contains `LanguageContext.tsx` and `TranslationContext.tsx`. Don't confuse them.

### 8. `useApi.ts` hooks bypass AppContext state
Hooks in `useApi.ts` (e.g., `useProducts()`) fetch directly from Supabase tables, not through the Edge Function. They won't apply tenant filtering unless RLS does it. They also don't sync with AppContext's `products` state — components using both can show stale data.

### 9. `src/App-backup.tsx` and `src/App.tsx.backup`
Backup files exist. Do not use them. The active file is `src/App.tsx`.

### 10. TypeScript `noUncheckedIndexedAccess` is enabled
Array accesses like `arr[0]` return `T | undefined`. Use optional chaining or null checks. This is why you'll see `employeesRes.employees[0]` guarded as `if (employeesRes.employees && employeesRes.employees.length > 0)`.

### 11. Storybook has `verbatimModuleSyntax` exclusion
`.storybook/` and `*.stories.*` files are excluded from the main `tsconfig.json`. They have their own tsconfig via the Storybook toolchain.

### 12. `src/App.tsx` has a "// Test commit" comment on the last line
This is dead code from a test commit — not functional.

### 13. `vercel.json.backup` exists
If deploying and having routing issues, check both `vercel.json` and `vercel.json.backup` to understand what changed.
