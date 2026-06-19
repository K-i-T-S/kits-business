# KiTS Business Terminal — Feature Reference

> Developer reference. Covers every feature, its architecture, data flow, plan gate, and key files.
> Last updated: 2026-06-19.

---

## Table of Contents

1. [Authentication & Multi-Tenancy](#1-authentication--multi-tenancy)
2. [Subscription Plans & Feature Gates](#2-subscription-plans--feature-gates)
3. [Point of Sale (POS)](#3-point-of-sale-pos)
4. [Inventory Management](#4-inventory-management)
5. [Customers & CRM](#5-customers--crm)
6. [Employees & Roles](#6-employees--roles)
7. [Reports & Analytics](#7-reports--analytics)
8. [Forecasting](#8-forecasting)
9. [Monitoring](#9-monitoring)
10. [Brand Identity & Theming](#10-brand-identity--theming)
11. [Settings](#11-settings)
12. [Enterprise Features](#12-enterprise-features)
13. [Edge Functions](#13-edge-functions)
14. [Internationalization & RTL](#14-internationalization--rtl)
15. [Offline & PWA](#15-offline--pwa)
16. [Admin Panel](#16-admin-panel)
17. [Database Schema Overview](#17-database-schema-overview)
18. [Key Utilities](#18-key-utilities)

---

## 1. Authentication & Multi-Tenancy

### How Auth Works

Auth is entirely Supabase-managed. The client subscribes to `onAuthStateChange` in `src/App.tsx`. On session change, `loadData()` fires from `AppContext`, which calls `get_current_user_tenant()` RPC to hydrate the active tenant.

```
Login → supabase.auth.signInWithPassword()
     → onAuthStateChange fires
     → get_current_user_tenant() RPC
     → AppContext sets currentTenant + currentEmployee
     → TenantSelection.tsx shown if user has multiple tenants
     → Dashboard (or role-specific redirect)
```

**Key files:**
- `src/App.tsx` — auth state machine, route guard
- `src/pages/Login.tsx` — login + signup form
- `src/pages/TenantSelection.tsx` — post-login tenant picker + onboarding trigger
- `src/context/AppContext.tsx` — `loadData()`, `switchTenant()`, `currentTenant`

### Multi-Tenancy Architecture

Every domain table has `tenant_id UUID NOT NULL REFERENCES tenants(id)`. Row-Level Security (RLS) is enforced via two SECURITY DEFINER functions that run at the DB level — the frontend **never** filters by `tenant_id` in queries.

```sql
-- Returns active tenant UUID for current session
create function current_tenant_id() returns uuid
  language plpgsql security definer
  set search_path = public
  as $$ ... $$;

-- Returns role of current user in active tenant
create function current_user_role() returns text
  language plpgsql security definer
  set search_path = public
  as $$ ... $$;
```

All RLS policies use these two functions. Example:
```sql
create policy "tenant_isolation" on products
  using (tenant_id = current_tenant_id());
```

**Tenant switching** (for users in multiple tenants): `AppContext.switchTenant(tenantId)` updates `current_tenant_id()` server-side and re-runs `loadData()`.

### Onboarding Wizard

Triggered from `TenantSelection.tsx` when `tenant.onboarding_completed = false`.

4 steps:
1. **Business Profile** — name, country, currency, phone → updates `tenants` table
2. **First Product** — creates first product via `addProduct()`
3. **Invite Team** — optional employee invite
4. **Done** — sets `onboarding_completed = true`, fires `welcome-email` Edge Function

**File:** `src/components/OnboardingWizard.tsx`

### Employee Invitation Flow

1. Owner/admin enters email in `InviteTeamMemberModal.tsx`
2. `supabase.functions.invoke('send-invitation')` → calls Supabase `auth.admin.inviteUserByEmail`
3. Invited user receives email, clicks link → magic link auth
4. `handle_new_user_invite` DB trigger auto-applies matching `pending_invitations` row → user joins tenant with correct role

**Migration:** `20260618_000002_auth_triggers.sql` (trigger), `20260618_000011_invite_accept_rpc.sql` (RPC)

---

## 2. Subscription Plans & Feature Gates

### Plans

| Plan | Price | Max Products | Max Customers | Max Employees |
|---|---|---|---|---|
| Starter | Free | 50 | 100 | 1 |
| Growth | $29/mo | Unlimited | Unlimited | 10 |
| Business | $79/mo | Unlimited | Unlimited | Unlimited |

### Feature Matrix

| Feature key | Starter | Growth | Business |
|---|---|---|---|
| `pos` | ✓ | ✓ | ✓ |
| `basic_reports` | ✓ | ✓ | ✓ |
| `advanced_analytics` | | ✓ | ✓ |
| `forecasting` | | ✓ | ✓ |
| `crm` | | ✓ | ✓ |
| `inventory_management` | | ✓ | ✓ |
| `enterprise_dashboard` | | | ✓ |
| `monitoring` | | | ✓ |
| `api_webhooks` | | | ✓ |
| `multi_location` | | | ✓ |

**Canonical definition:** `src/types/subscription.ts` — `PLAN_FEATURES`, `PLAN_LIMITS`, `FEATURE_DISPLAY`

### Gating Components

**`<FeatureGate feature="crm">`** — renders children if plan includes feature; renders locked card with upgrade CTA (WhatsApp link) if not.

**`<RoleGate action="manage_employees">`** — renders children if current user's role can perform action; renders nothing otherwise.

**`<FeatureRoute feature="forecasting">`** — route-level guard; redirects to `/dashboard` if plan insufficient.

**Hooks:**
- `useSubscription()` from `src/context/SubscriptionContext` → `{ plan, role, hasFeature(), canPerform(), isWithinLimit() }`
- `useFeature(feature)` from `src/hooks/useFeature.ts` → `{ available: boolean, requiredPlan }`

### Plan Changes

Admin-only via `admin_set_tenant_plan(tenant_id, plan)` SECURITY DEFINER RPC. UI in `src/pages/AdminPanel.tsx`. No Stripe integration yet — manual elevation only.

---

## 3. Point of Sale (POS)

**File:** `src/pages/POS.tsx`  
**Route:** `/pos`  
**Plan:** Starter+

### Core Flow

```
Search / Scan product → add to cart → apply discount/coupon/tip/loyalty → checkout → receipt
```

### Barcode Scanner

Keydown handler detects USB HID scanner pattern:
- Characters arrive < 50ms apart (`SCANNER_CHAR_INTERVAL_MS = 50`)
- Buffer flushed on `Enter`
- Minimum length 4 chars (`SCANNER_MIN_LENGTH`) to ignore accidental Enter presses
- Matched against `product.barcode` → auto-added to cart with green flash animation

### Cart

`CartItem[]` state: `productId`, `variantId`, `productName`, `variantAttributes`, `price`, `cost`, `quantity`. All calc via `POSCalculator` utility (`src/utils/posCalculations.ts`).

### Pricing & Tax

```typescript
const taxRate = currentTenant?.tax_rate ?? 0;
// Lebanon = 0.11 (11% TVA)
// formatTaxBreakdown(subtotal, taxRate) returns { subtotal, taxAmount, total, taxLabel }
// taxLabel = "TVA 11%" when taxRate = 0.11
```

### Dual Currency

When `currentTenant.show_dual_currency = true`:
```typescript
formatDualCurrency(total, exchangeRate, secondaryCurrency)
// → "$24.42 (2,185,590 LBP)"
```
Exchange rate stored on `tenants.exchange_rate` (default 89,500 LBP/USD). Updated via System Settings.

### Split Payment

`SplitPaymentModal.tsx` — enter cash amount; card amount auto-calculates. Both methods recorded on the sale.

### Tips

`TipsModal.tsx` — preset percentages (10/15/20%) or custom amount.

### Discounts & Coupons

`DiscountModal.tsx` — percentage or fixed amount. `demoCoupons` from `src/data/demoPosData.ts` (mock; DB-backed coupons planned).

### Loyalty Points

At checkout completion:
```typescript
// Earn: sale total × loyalty_points_per_dollar
// Deduct: redeemed points (from LoyaltyModal)
// Written to: customer_points (upsert) + point_transactions (insert)
```
`LoyaltyModal.tsx` — shows balance, tier, lets cashier apply redemption.

### Receipt

- Renders in `#receipt` div — printed via `window.print()` with `src/styles/print.css`
- Shows: items, subtotal, tax (TVA label), discounts, tips, total, payment method
- Dual currency total when enabled
- **WhatsApp send button** — Business plan only, customer must have phone

### WhatsApp Receipt

```typescript
// handleSendWhatsApp() in POS.tsx
await supabase.functions.invoke('whatsapp-receipt', {
  body: { to, customerName, saleId, items, subtotal, tax, total, paymentMethod, businessName }
});
```
Requires `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` secrets in Supabase. See `docs/setup-whatsapp-receipts.md`.

### Receipt Customization

`ReceiptCustomizationModal.tsx` — template selection (demo templates from `demoReceiptTemplates`).

---

## 4. Inventory Management

**Route:** `/inventory`  
**Plan:** Growth+ (`inventory_management`)

### Products

Direct PostgREST: `supabase.from('products')`. Fields: `name`, `sku`, `barcode`, `category`, `variants[]`, `stock_quantity`, `reorder_point`, `cost_price`.

Product variants: each product has `variants` JSONB array with `{ id, name, attributes, price, sku, barcode }`.

**Key components:**
- `AddProductModal.tsx` — create product with variants
- `EnhancedImportInventoryModal.tsx` — bulk import via CSV
- `BatchTracking.tsx` — batch/lot number tracking
- `ReorderPointManagement.tsx` — set reorder thresholds, view low-stock alerts

### Suppliers

`SupplierManagement.tsx` — CRUD against `suppliers` table. Fields: name, contact, email, phone, address, payment terms, notes.

### Purchase Orders

`PurchaseOrderManagement.tsx` — create PO against a supplier, add line items (`purchase_order_items`), track status (draft/sent/received/cancelled).

### Stock Transfers

`StockTransferManagement.tsx` — transfer stock between locations. Tables: `stock_transfers`, `stock_transfer_items`.

### Multi-Location

`MultiLocationSupport.tsx` — 3 tabs:
1. **Locations** — CRUD `locations` table
2. **Stock by Location** — `location_stock` table, view per-location inventory
3. **Transfer Stock** — create transfers between locations

**Migration:** `20260618_000008_multi_location.sql`

---

## 5. Customers & CRM

**Route:** `/customers`  
**Plan:** Starter (CRUD); Growth+ (CRM features)

### Customers

Direct PostgREST: `supabase.from('customers')`. Fields: `name`, `email`, `phone`, `address`, `debt_balance`, `total_purchases`, `visit_count`, `last_purchase_date`.

Phone placeholder: `+961 X XXX XXX` (Lebanese format).

### Loyalty Panel

**File:** `src/components/LoyaltyPanel.tsx`  
**Plan:** Growth+ (`crm`)

Shown per-customer in the Customers page (expand/collapse):
- Points balance, tier badge (Bronze 0–499 / Silver 500–1999 / Gold 2000+)
- Progress bar to next tier
- Point value in USD (`balance × loyalty_points_redeem_rate`)
- Transaction history (last 10 from `point_transactions`)
- **Adjust Points** modal (owner/manager only) — manual credit/debit with reason

**Tables:** `customer_points` (balance), `point_transactions` (ledger)  
**Migration:** `20260619_000026_loyalty_points.sql`

### CRM Tabs (in Customers page)

| Tab | Component | Description |
|---|---|---|
| Customers | — | Main list with search, filters, add/edit/delete |
| Loyalty | — | Leaderboard sorted by points balance with tier badges |
| Analytics | `CRMAnalytics.tsx` | Retention, CLV, top customers, purchase frequency |
| Segments | `CustomerSegmentation.tsx` | Create and manage customer segments |
| Campaigns | `MarketingCampaigns.tsx` | Campaign list + creation form |
| Automation | `AutomatedMarketing.tsx` | Trigger-based workflow rules |
| Communication | `CustomerCommunicationHistory.tsx` | Per-customer message log |

---

## 6. Employees & Roles

**Route:** `/employees`  
**Plan:** Starter

### Roles (8 standard roles)

| Role | POS | Products | Customers | Employees | Settings | Admin |
|---|---|---|---|---|---|---|
| viewer | — | Read | Read | — | — | — |
| cashier | ✓ | — | Read | — | — | — |
| stockkeeper | ✓ | Edit | Read | — | — | — |
| accountant | Read | Read | Read | — | — | — |
| supervisor | ✓ | Edit | Edit | Read | — | — |
| manager | ✓ | Edit | Edit | Read | Partial | — |
| admin | ✓ | Full | Full | Full | Full | — |
| owner | ✓ | Full | Full | Full | Full | ✓ |

**Migration:** `20260618_000021_roles_and_custom_roles.sql`  
**Defined in:** `src/types/subscription.ts` → `FullUserRole`, `ROLE_ACTIONS`

### Custom Roles

**File:** `src/components/CustomRolesManager.tsx` (embedded in Employees → Roles tab)

Stores in `custom_roles` table: `name`, `tenant_id`, `permissions` (JSONB array of permission keys). Permission catalogue defined in `src/types/subscription.ts` → `AVAILABLE_PERMISSIONS`.

### Role-Based Dashboard Routing

On login, `Dashboard.tsx` checks `currentEmployee.role`:
```
cashier → /pos
stockkeeper → /inventory
accountant → /reports
others → /dashboard
```

### KiTS Admin Auto-Membership

Migration 000021 adds `kits.tech.co@gmail.com` as `admin` to every tenant automatically via trigger on `tenant_users` insert.

---

## 7. Reports & Analytics

**Route:** `/reports`  
**Plan:** Starter (basic); Growth+ (advanced)

### Basic Reports

- **Sales Summary** — total revenue, transactions, avg order value
- **Product Performance** — units sold, revenue per product
- **Date filtering** — today, this week, this month, custom range

### Export

**File:** `src/utils/exportService.ts`

- **Excel:** ExcelJS (dynamic import). Separate sheets for Sales, Products, Customers.
- **PDF:** jsPDF (dynamic import). Tables with auto-column widths.

Both use `formatCurrency()` from `src/utils/formatting.ts` for consistent display.

### Advanced Analytics

**File:** `src/components/AdvancedAnalytics.tsx`  
**Plan:** Growth+

- Margin analysis chart (Recharts)
- Revenue trend by category
- Hour-of-day heatmap

### CRM Analytics

**File:** `src/components/crm/CRMAnalytics.tsx`  
**Plan:** Growth+

- Total customers, new this month, retention rate, outstanding debt
- Lifetime revenue, avg CLV
- Top 5 customers by revenue
- Purchase frequency distribution

---

## 8. Forecasting

**Route:** `/forecasting`  
**File:** `src/pages/Forecasting.tsx`  
**Plan:** Growth+ (`forecasting`)

### Revenue Forecast

- Data: 90-day actual sales from `AppContext.sales`, grouped by date
- Model: linear regression (least squares) on daily totals
- Output: 30-day ahead projection with ±15% confidence band
- Chart: Recharts `ComposedChart` — actual (solid indigo line) + forecast (dashed sky line) + shaded area

### Lebanese Holiday Calendar

34 entries for 2026–2027 hard-coded in `LEBANESE_HOLIDAYS` array:
- Fixed dates: New Year, Armenian Christmas, St Maroun, Arab Teachers Day, Labour Day, Martyrs Day, Resistance Day, Assumption, All Saints, Independence Day, Christmas
- Variable: Catholic + Orthodox Good Friday, Islamic dates (Ramadan end, Eid al-Fitr, Eid al-Adha, Islamic New Year, Prophet's Birthday)

Upcoming holidays (next 30 days) shown as amber pill badges. Holiday forecast days marked as orange `<ReferenceDot>` on chart.

### Product Velocity

90-day rolling window. Aggregated from `sale.items[]`:
- `units_per_day = total_units_sold / window_days`
- `projected_30d = units_per_day × 30`
- `revenue_per_day = total_revenue / window_days`
Top 20 by revenue/day.

### Customer Lifetime Value (CLV)

Per customer:
```
CLV = avg_order_value × purchases_per_year × retention_years (2)
```
Top 10 by CLV ranked; #1 gets gold award icon.

### Stock Depletion Forecast

For each product with `stock_quantity > 0` and `daily_velocity > 0`:
```
days_until_stockout = stock_quantity / daily_velocity
```
Warning table for products running out ≤ 30 days. Urgency badges:
- Red: ≤ 7 days
- Amber: ≤ 14 days
- Yellow: ≤ 30 days

### PDF Export

jsPDF dynamic import. Exports:
- Title + date
- Revenue trend table (30 actuals + 30 forecast)
- Product velocity table

---

## 9. Monitoring

**Route:** `/enterprise` (tab within EnterpriseDashboard)  
**File:** `src/components/monitoring/MonitoringDashboard.tsx`  
**Plan:** Business (`monitoring`)

### Real Data Sources

| Metric | Query |
|---|---|
| Today's revenue | `supabase.from('sales').select('total').gte('created_at', startOfToday)` |
| Active alerts | `supabase.from('products').select('id').lte('stock_quantity', reorder_point)` count |
| DB latency | `performance.now()` around `supabase.from('tenants').select('id').limit(1)` |
| Low stock items | `supabase.from('products').select(...).lte('stock_quantity', reorder_point)` |
| Sales velocity | Hourly grouping of last 24h `sales` → Recharts `LineChart` |

Auto-refreshes every 60 seconds via `setInterval`.

### Other Monitoring Tabs

- `PerformanceDashboard.tsx` — Web Vitals display
- `HealthCheckDashboard.tsx` — endpoint health checks
- `ErrorTrackingDashboard.tsx` — error log viewer

---

## 10. Brand Identity & Theming

### CSS Custom Properties

Applied to `<html>` element on tenant load via `applyBrandColors()` in `AppContext.tsx`:

```css
--brand-primary: #6366f1   /* tenant brand_primary */
--brand-secondary: #38bdf8  /* tenant brand_secondary */
--surface: #0f172a
--text-primary: #ffffff
```

**`.btn-brand`** class (in `src/styles/themes.css`):
```css
.btn-brand {
  background: linear-gradient(to right, var(--brand-primary), var(--brand-secondary));
}
```
All primary action buttons use `btn-brand` — color updates live when brand changes.

### Brand Identity Modal

**File:** `src/components/BrandIdentityModal.tsx`  
**Access:** Sidebar brand box (click, owner/admin only)

Features:
- Logo upload to `brand-assets` Supabase Storage bucket
- 6 color presets (KiTS Blue, Emerald, Rose, Amber, Purple, Slate)
- Custom hex color pickers for primary + secondary
- Tagline field
- Live preview with real colors
- Always-visible "Powered by KiTS" watermark

**DB:** `brand_logo_url`, `brand_primary`, `brand_secondary`, `brand_tagline` on `tenants`  
**Migration:** `20260619_000024_brand_identity.sql`

### Favicon Swap

`applyFavicon(logoUrl)` in `AppContext.tsx` — swaps `<link rel="icon">` to tenant logo on load. Falls back to `/kits-logo.png` if no logo.

### Dark / Light Theme

**File:** `src/context/ThemeContext.tsx`  
`html.light-theme` CSS class strategy. `src/styles/themes.css` (347 lines) overrides:
- `hero-gradient`, `glass-panel` containers
- `bg-white/*` → light equivalents
- `border-white/*`, `text-white/*` opacity variants
- Recharts axes, grids, tooltips
- Select, input, placeholder styles

Toggle persists to `localStorage` via `ThemeContext`. Sun/Moon icon in Layout header.

---

## 11. Settings

### Profile Settings

**Route:** `/profile-settings`  
**File:** `src/pages/ProfileSettings.tsx`

| Tab | What it does |
|---|---|
| Profile | Display name (updates `profiles` table), avatar upload to `avatars` bucket |
| Password | `supabase.auth.reauthenticate()` → `supabase.auth.updateUser({ password })` |
| Language | Picker wired to `LanguageContext` — changes i18next locale + HTML `dir` attribute |
| Notifications | Preferences stored in `localStorage` |

### System Settings

**Route:** `/system-settings`  
**File:** `src/pages/SystemSettings.tsx`

| Tab | What it does |
|---|---|
| Business Info | name, country, currency, phone → updates `tenants` table |
| Financial | tax_rate (shown as %, stored as decimal), TIN, secondary_currency, exchange_rate, show_dual_currency, decimal_places → updates `tenants` |
| POS Behaviour | requireCustomerOnSale, confirmBeforeDelete, printReceiptAutomatically, defaultPaymentMethod → `localStorage` |
| Loyalty | enable/disable loyalty, points_per_dollar, redeem_rate, tier display → updates `tenants` |
| Danger Zone | Delete account (owner only) → `supabase.from('tenants').delete()` |
| WhatsApp (Business) | `<FeatureGate feature="enterprise_dashboard">` — setup instructions for Meta API secrets |

### Tax Configuration

`tax_rate` stored on `tenants` as decimal (0.11 = 11%). Displayed in UI as percentage.
- Lebanon default: 0.11 (TVA 11%)
- `formatTaxBreakdown()` returns `taxLabel: "TVA 11%"` when rate is 0.11
- Applied in POS at checkout; shown on receipt

---

## 12. Enterprise Features

**Route:** `/enterprise`  
**Plan:** Business (`enterprise_dashboard`)

### API & Webhooks

**File:** `src/components/enterprise/ApiAndWebhooks.tsx`

- **API Keys** — generate UUID v4 keys stored in `api_keys` table (tenant-scoped)
- **Webhooks** — register URLs with event filters; HMAC secret auto-generated; stored in `webhooks` table
- **Delivery log** — `webhook_deliveries` table; shows status, HTTP code, response body per delivery

**Migration:** `20260618_000012_api_webhooks.sql`

### Enterprise Dashboard

**File:** `src/components/enterprise/EnterpriseDashboard.tsx`

Tabs: Monitoring, API & Webhooks, Multi-Location, Roles & Permissions, Workflow Automation.

### Roles & Permissions Manager

**File:** `src/components/enterprise/RolesAndPermissionsManager.tsx`

Read-only view of current tenant's role assignments. Complements `CustomRolesManager.tsx` in Employees.

### Workflow Automation

**File:** `src/components/enterprise/WorkflowAutomation.tsx`

Currently shows planned workflows (coming soon). Engine not yet built.

---

## 13. Edge Functions

All functions in `supabase/functions/`. Deployed to `pytndxjeznhhyycjasep`.

### `welcome-email`

**Trigger:** Called from `TenantSelection.tsx` after new tenant creation  
**Env:** `RESEND_API_KEY`  
**Action:** Sends branded HTML welcome email via Resend API

### `send-invitation`

**Trigger:** Called from `InviteTeamMemberModal.tsx`  
**Env:** `SUPABASE_SERVICE_ROLE_KEY` (auto-available)  
**Action:** `supabase.auth.admin.inviteUserByEmail(email, { data: { tenant_id, role } })`

### `whatsapp-receipt`

**Trigger:** Called from `POS.tsx` → `handleSendWhatsApp()`  
**Env:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`  
**Action:** POST to Meta Cloud API v18.0 → sends formatted WhatsApp text to customer phone  
**Plan gate:** Business only (checked client-side; function itself has no plan check)  
**Setup:** `docs/setup-whatsapp-receipts.md`

---

## 14. Internationalization & RTL

### Languages

5 locales in `src/i18n/locales/`: `en.json`, `ar.json`, `fr.json`, `es.json`, `zh.json`  
Library: `react-i18next` + `i18next`  
**File:** `src/i18n/index.ts`

All UI text uses `const { t } = useTranslation()`. Do not hardcode strings.

### RTL Support

When language is Arabic (`ar`), `LanguageContext` sets `document.documentElement.dir = 'rtl'`.

RTL-safe Tailwind classes used throughout (avoids `left-*`/`right-*`):
- Position: `start-*`, `end-*`, `inset-x-*`
- Spacing: `ms-*`, `me-*`, `ps-*`, `pe-*`
- Border: `border-s-*`, `border-e-*`
- Transform: `rtl:translate-x-full` for slide animations

**Components with full RTL:** `Layout.tsx`, `MobileNavigation.tsx`, `GlobalSearch.tsx`, `BrandIdentityModal.tsx`, `POS.tsx`

### Language Switcher

`LanguageSelector.tsx` — dropdown in sidebar footer.  
`LanguageSwitcher.tsx` — compact variant used in login page.  
`TranslationManager.tsx` — admin tool to view/edit translation keys in-app.

---

## 15. Offline & PWA

### Offline Queue

**File:** `src/utils/offlineQueue.ts` — IndexedDB-backed queue  
**Hook:** `src/hooks/useOfflineSync.ts` — replays queue on `online` event  
**Indicator:** `src/components/OfflineIndicator.tsx` — shows pending sync count in header

On reconnect, queued operations (add/update/delete) are replayed against Supabase in order.

### PWA

- `PWAInstallPrompt.tsx` — intercepts `beforeinstallprompt`, shows "Add to Home Screen" banner
- Service worker registered via Vite PWA plugin
- App is installable on Android/iOS

### Global Search

**File:** `src/components/GlobalSearch.tsx`  
**Trigger:** `Cmd+K` / `Ctrl+K`  
**Searches:** products, customers, employees  
**Features:** 200ms debounce, keyboard navigation (↑↓, Enter, Escape), grouped results, RTL-safe

---

## 16. Admin Panel

**Route:** `/admin`  
**Access:** `kits.tech.co@gmail.com` only (email check + PIN)  
**File:** `src/pages/AdminPanel.tsx`

### PIN Gate Security

1. Email check: if `session.user.email !== 'kits.tech.co@gmail.com'` → redirect to `/dashboard`
2. PIN form shown — no sessionStorage caching, required on every visit
3. `verify_admin_pin(pin TEXT)` SECURITY DEFINER RPC with `SET search_path = extensions, public`
4. PIN hashed with pgcrypto bcrypt in `kits_admin_config` table (RLS on, no policies = inaccessible via PostgREST)

**Migration:** `20260619_000023_admin_pin_config_table.sql`

### Admin Capabilities

| Action | RPC / Table |
|---|---|
| List all tenants | `admin_list_tenants()` |
| Change tenant plan | `admin_set_tenant_plan(tenant_id, plan)` |
| Provision client DB | `admin_provision_client(tenant_id)` |
| View provisioning status | `db_provision_status` column on `tenants` |

---

## 17. Database Schema Overview

### Core Tables

| Table | Description |
|---|---|
| `tenants` | One row per business. Holds all config: brand, plan, tax, loyalty, currency |
| `tenant_users` | Many-to-many: user ↔ tenant with role |
| `profiles` | One per auth user: display_name, avatar_url |
| `products` | Products with JSONB `variants` array |
| `sales` | Completed transactions |
| `sale_items` | Line items per sale |
| `customers` | Customer records |
| `employees` | Employee records linked to auth user |
| `pending_invitations` | Pre-auth invitation records |
| `custom_roles` | Tenant-defined role presets |

### Extended Tables

| Table | Migration | Description |
|---|---|---|
| `activity_log` | 000006 | Audit trail: action, entity_type, entity_id, metadata |
| `suppliers` | 000007 | Supplier CRUD |
| `purchase_orders` | 000007 | PO header + status |
| `purchase_order_items` | 000007 | PO line items |
| `stock_transfers` | 000007 | Transfer header |
| `stock_transfer_items` | 000007 | Transfer line items |
| `locations` | 000008 | Physical locations |
| `location_stock` | 000008 | Stock per product per location |
| `api_keys` | 000012 | API key per tenant |
| `webhooks` | 000012 | Webhook registrations |
| `webhook_deliveries` | 000012 | Delivery attempt log |
| `kits_admin_config` | 000023 | Admin PIN hash (RLS on, no policies) |
| `customer_points` | 000026 | Loyalty balance per customer |
| `point_transactions` | 000026 | Loyalty ledger |

### Key Columns on `tenants`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `subscription_plan` | text | 'starter' | Plan gate |
| `onboarding_completed` | boolean | false | Wizard trigger |
| `brand_logo_url` | text | null | Logo URL (Storage) |
| `brand_primary` | text | '#6366f1' | CSS var |
| `brand_secondary` | text | '#38bdf8' | CSS var |
| `brand_tagline` | text | null | Shown in sidebar |
| `tax_rate` | numeric | 0.11 | Lebanese TVA |
| `tin` | text | null | Tax ID number |
| `secondary_currency` | text | 'LBP' | Dual currency display |
| `exchange_rate` | numeric | 89500 | LBP per USD |
| `show_dual_currency` | boolean | false | Toggle dual display |
| `loyalty_enabled` | boolean | false | Loyalty feature |
| `loyalty_points_per_dollar` | numeric | 1 | Earn rate |
| `loyalty_points_redeem_rate` | numeric | 0.01 | $ value per point |

---

## 18. Key Utilities

### `src/utils/formatting.ts`

| Function | Signature | Description |
|---|---|---|
| `formatCurrency(amount)` | `(number) → string` | `$1,234.56` |
| `formatDate(date)` | `(string\|Date) → string` | Locale-aware date |
| `formatDualCurrency(usd, rate, currency?)` | `(number, number, string?) → string` | `"$10.00 (895,000 LBP)"` |
| `formatTaxBreakdown(subtotal, rate)` | `(number, number) → { subtotal, taxAmount, total, taxLabel }` | `taxLabel = "TVA 11%"` when rate is 0.11 |

### `src/utils/supabaseClient.ts`

Exports `supabase` — switches between:
- Real Supabase client (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- localStorage mock (`VITE_USE_LOCAL_MODE=true`) via `localStorageClient.ts`

### `src/utils/exportService.ts`

- `exportToExcel(sales, products, customers)` — ExcelJS (dynamic import)
- `exportToPDF(sales, products)` — jsPDF (dynamic import)

### `src/utils/posCalculations.ts` — `POSCalculator`

Static methods for cart subtotal, tax, discount, tip, total calculations. Single source of truth for all POS math.

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
Used in FeatureGate upgrade CTA, HelpSupport page, footer.
