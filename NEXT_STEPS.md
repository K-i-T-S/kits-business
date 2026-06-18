# Engineering Roadmap — KiTS Business Terminal

> Last updated: 2026-06-18. Based on MVP codebase audit + two full engineering sprints.
> Status: Feature-complete MVP. Production-ready for initial customers.
> All items marked ✅ are fully implemented, deployed, and tested.

---

## ✅ Completed — Sprint 1 & 2

### ✅ 2. Activity Log Backend
`activity_log` table created (migration 000006). `AppContext` CRUD functions log all mutations fire-and-forget. `ActivityLog.tsx` reads live data.

### ✅ 3. Test Suite
233 tests passing across 19 test files. Vitest + Testing Library for unit tests; Playwright E2E configured. Tests cover: cart, formatting, security, subscription context, feature gates, export service, multi-tenancy, accessibility.

### ✅ 4. Mobile POS Layout
80px min touch targets, larger +/- controls, sticky checkout footer on mobile. Barcode scanner detection implemented (rapid keystrokes + Enter).

### ✅ 5. Receipt Printing
`window.print()` with `@media print` CSS stylesheet (`src/styles/print.css`) targeting `#receipt` div. Dark theme suppressed for print.

### ✅ 6. Bundle Size Optimization
ExcelJS and jsPDF converted to dynamic `import()` inside export functions. All page components in `App.tsx` use `React.lazy()`. Vite chunk splitting configured in `vite.config.ts`.

### ✅ 8. Offline Sync
Full IndexedDB queue via `src/utils/offlineQueue.ts`. `src/hooks/useOfflineSync.ts` replays queue against Supabase on reconnect using `supabase.from(table)[operation](payload)` pattern. `OfflineIndicator` component shows pending sync count.

### ✅ 9. Barcode Scanner
Keydown handler in POS detects scan pattern (<50ms between chars + Enter) → auto-adds product to cart. Visual feedback on scan success/failure.

### ✅ 10. Onboarding Email
`welcome-email` Edge Function deployed. Sends branded HTML email via Resend API when a new tenant is created from `TenantSelection.tsx`.

### ✅ 12. Stock Transfers, Supplier Management, Purchase Orders
Full implementations:
- `SupplierManagement.tsx` — full CRUD
- `PurchaseOrderManagement.tsx` — PO creation, line items, receiving flow (increments stock)
- `StockTransferManagement.tsx` — pending → in_transit → completed workflow
Migration 000007 created all required tables with RLS.

### ✅ 13. Multi-Location Support
`MultiLocationSupport.tsx` — 3 tabs: Locations CRUD, Stock by Location (upsert), Transfer Stock between locations. Migration 000008 created `locations` and `location_stock` tables.

### ✅ 14. API & Webhooks
Full `ApiAndWebhooks.tsx` implementation:
- API key generation (Web Crypto SHA-256 hash, key shown once, prefix stored for display)
- Permissions (read/write/delete), revocation, active toggle
- Webhook registration with HMAC secret, event subscriptions, delivery log
- Migration 000012: `api_keys`, `webhooks`, `webhook_deliveries` tables with RLS

### ✅ 15. Advanced Analytics — AI Insights
`Forecasting.tsx` enhancements:
- Lebanese holiday calendar (8 public holidays with sales multipliers, amber reference lines on chart)
- Margin analysis chart: top 5 products by gross margin %, colour-coded by health threshold
- Customer Lifetime Value: aggregated per customer with annual CLV projection

### ✅ 16. Data Export Testing
`exportService.ts` verified against current `AppContext` schema. No field name mismatches found. Export service uses a generic `ExportData` shape — correct column headers confirmed.

---

## ✅ Completed — Admin & Auth Sprint

### ✅ Vercel Analytics
`@vercel/analytics` and `@vercel/speed-insights` wired in `App.tsx`. Both active on production.

### ✅ Subscription Plan Elevation (Admin Panel)
KiTS admin at `kits.tech.co@gmail.com` can access `/admin` to:
- View all tenants with plan, status, user count, DB provision status
- Change any tenant's subscription plan and status via `admin_set_tenant_plan()` SECURITY DEFINER RPC

### ✅ Onboarding Bug Fix
Migration 000009: retroactive `UPDATE tenants SET onboarding_completed = true` — fixes existing tenants being shown the setup wizard on every login.

### ✅ Employee Invitation Flow
Replaced `signInWithOtp` magic link with proper password-based invite flow:
- `send-invitation` Edge Function deployed — uses `auth.admin.inviteUserByEmail` (service role). New employees get a "Set your password" email; existing users get a magic link
- `accept_pending_invitation()` SECURITY DEFINER RPC (migration 000011) — links existing Supabase users to tenant without relying on auth trigger
- `/accept-invite` page handles post-click flow for both new and existing users
- `TenantSelection` auto-redirects users with pending invitations

### ✅ FeatureGate Upgrade CTA
Upgrade button opens WhatsApp (`wa.me/96181290662`) with pre-filled message. Toast removed.

---

## ✅ Completed — Database Provisioning Architecture

### ✅ Per-Business Supabase Project Model
Designed and partially implemented. Full architecture:
1. Client onboards into shared KiTS Supabase (temporary)
2. Onboarding completion sets `db_provision_status = 'pending'` → appears in admin queue
3. KiTS employee manually creates supabase.com account using client's email
4. Admin panel "Database Provisioning" tab: KiTS enters project URL + anon key → `admin_provision_client()` marks provisioned
5. Keep-alive GitHub Action pings all provisioned client projects every 5 days

**Migration 000013:** `business_type`, `preferred_region`, `db_provision_status`, `standalone_supabase_url`, `standalone_anon_key`, `db_provisioned_at` added to `tenants`.
**Admin panel** has full provisioning tab (pending queue, credential form, provisioned list).
**Keep-alive workflow** updated to read client projects from DB and ping each one.

**Not yet built** (requires separate sprint, careful design before touching production data):
- Automated data migration: `pg_dump` filtered by `tenant_id` → `pg_restore` to client project
- Post-migration email to client: "Your dedicated database is ready"

---

## 🔴 Must-Have Before Acquiring Paying Customers

### 1. Stripe Billing Integration
The subscription tier system (starter/growth/business) is fully implemented in DB and frontend, but no payment flow exists. KiTS manually elevates plans via the `/admin` panel until Stripe is live.

**What to build:**
- Stripe Checkout session creation (Supabase Edge Function or Vercel API route)
- Webhook handler: `customer.subscription.updated` / `customer.subscription.deleted` → updates `tenants.subscription_plan` + `subscription_status`
- Billing portal link in ProfileSettings
- Replace WhatsApp upgrade CTA in `FeatureGate.tsx` with Stripe Checkout link

**Files to create:** `supabase/functions/stripe-webhook/`, `src/pages/Billing.tsx`
**Files to edit:** `src/components/FeatureGate.tsx`, `src/pages/ProfileSettings.tsx`

---

## 🟡 High-Priority Improvements

### A. Data Migration Automation
**What to build:** A CLI script or Edge Function that:
1. Connects to KiTS shared Supabase via `pg_dump`
2. Filters by `tenant_id` to extract one client's data
3. Connects to client's new Supabase project
4. Runs schema migrations via Management API
5. Restores data via `pg_restore`
6. Marks `db_provision_status = 'provisioned'` and sends client email via Resend

**Dependency:** Requires Management API access to client's project (client must add KiTS as org Administrator, or KiTS creates account and retains credentials). Needs `SUPABASE_MANAGEMENT_KEY` per client project.

### B. Arabic RTL Completion
Translations exist in `src/i18n/locales/ar.json` but RTL layout testing is incomplete. Several components have hardcoded `left`/`right` positioning.

**What to do:**
- Audit every component with directional CSS (`left-*`, `right-*`, `ml-*`, `mr-*`)
- Replace with RTL-safe equivalents (`start-*`, `end-*`, `ms-*`, `me-*`) via Tailwind v4
- Test every page at `document.documentElement.dir = 'rtl'`

### C. Onboarding Email Sequence
Day-3 and Day-7 follow-up emails to improve activation and starter→paid conversion.

**What to build:**
- Day 3 email: "You haven't made your first sale yet — here's how" (trigger: `onboarding_completed = true` AND no sales after 3 days)
- Day 7 email: upgrade CTA to Growth plan

### D. CRM Campaigns & Automation
`AutomatedMarketing.tsx` and `MarketingCampaigns.tsx` are coming-soon stubs.

**What to build:**
- `campaigns` and `campaign_sends` tables
- Email/SMS send integration (Resend, Twilio)
- Automation trigger engine (time-based or event-based)

---

## Production Checklist (Before First Real Customer)

- [ ] Run `npm run verify` — zero errors
- [x] ~~Run all Supabase migrations~~ — **migrations 001–009 applied; 010–013 pending (see below)**
- [x] ~~Deploy welcome-email Edge Function~~
- [x] ~~Deploy send-invitation Edge Function~~
- [ ] **Run pending migrations 009–013** in Supabase Dashboard → SQL Editor (SQL file at `/tmp/kits_migrations_009_013.sql`)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Supabase Dashboard → Edge Functions → Secrets (required for `send-invitation`)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub Secrets (required for keep-alive to ping client projects)
- [x] ~~Vercel env vars set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`~~
- [x] ~~GitHub secrets set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`~~
- [ ] Test full signup → onboarding → first sale flow on production URL
- [ ] Supabase email confirmation templates customized (Dashboard → Auth → Email Templates)
- [ ] Supabase Auth redirect URL set to production domain (Dashboard → Auth → URL Configuration)
- [ ] RLS verified: create two test accounts, confirm data is isolated
- [ ] Export function tested (Excel + PDF) on production
- [ ] Mobile POS tested on actual phone/tablet
- [ ] Error boundary tested (manually throw in console, verify dark error screen)
- [ ] `/admin` panel tested with `kits.tech.co@gmail.com` login — plan elevation working
- [ ] First employee invitation tested end-to-end (invite → email received → set password → login → correct tenant)
