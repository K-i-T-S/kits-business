# Engineering Roadmap — KiTS Business Terminal

> Generated: 2026-06-18. Based on MVP codebase audit.  
> Status: MVP complete. Production-ready for initial customers. Items below are the path to a polished, monetizable product.

---

## 🔴 Must-Have Before Acquiring Paying Customers

### 1. Stripe Billing Integration
The subscription tier system (starter/growth/business) is fully implemented in the database and frontend, but no payment flow exists. All users default to `starter` plan.

**What to build:**
- Stripe Checkout session creation (server-side, via Supabase Edge Function or Vercel API route)
- Webhook handler for `customer.subscription.updated` and `customer.subscription.deleted` → updates `tenants.subscription_plan` and `subscription_status`
- "Upgrade" button in FeatureGate lock screens that opens Stripe Checkout
- Billing portal link in ProfileSettings (Stripe Customer Portal)

**Files to create:** `supabase/functions/stripe-webhook/`, `src/pages/Billing.tsx`  
**Files to edit:** `src/components/FeatureGate.tsx` (wire upgrade button), `src/pages/ProfileSettings.tsx`

---

### 2. Activity Log Backend
`src/pages/ActivityLog.tsx` exists and renders correctly, but there is no `activity_log` table in Supabase. The page shows an empty state.

**What to build:**
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,        -- 'sale_created', 'product_added', etc.
  entity_type TEXT,            -- 'sale' | 'product' | 'customer' | 'employee'
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
Then wire `AppContext` CRUD functions to insert activity log entries on each mutation.

---

### 3. Test Suite Alignment
Unit tests in `src/**/*.test.ts` were written for the old Edge Function architecture. Many tests likely reference the `api.*` object or `kv_store` patterns that no longer exist.

**What to do:**
- Run `npm run test` and audit all failures
- Rewrite tests for `AppContext` CRUD functions to use the current `supabase.from()` pattern
- Update `src/test-utils/mocks.ts` to mock `supabase.from()` instead of the old Edge Function

---

### 4. Mobile POS Layout
The POS page stacks correctly at 375px, but the touch targets are small and the product grid is dense. For cashier use on a tablet or phone, this is the highest-traffic page.

**What to improve:**
- Product cards: minimum 80×80px touch target
- Cart item quantity controls: larger +/− buttons
- Checkout button: always visible sticky footer on mobile
- Consider a drawer-based cart on mobile (slides up from bottom)

---

### 5. Receipt Printing
Receipts are formatted in localStorage but there is no print flow. For POS hardware (thermal printers), this is a critical feature.

**Options in priority order:**
1. Browser `window.print()` with a `@media print` CSS stylesheet targeting the receipt div
2. ESC/POS via Web Serial API (for thermal printers connected via USB)
3. Network printer via a local print server (advanced, for future)

---

## 🟡 High-Priority Improvements

### 6. Bundle Size Optimization
The production build has two oversized chunks:
- `export` chunk: ~1.9MB (ExcelJS + jsPDF) — loaded on every page, should be lazy-loaded only when the export button is clicked
- `router` chunk: ~1MB — audit which pages are not lazy-loaded

**Fix:** Dynamic `import()` in `exportService.ts` and ensure all page components in `App.tsx` use `React.lazy()`.

---

### 7. Arabic RTL Completion
Translations exist in `src/i18n/locales/ar.json` but RTL layout testing is incomplete. Several components have hardcoded `left`/`right` positioning that breaks in RTL.

**What to do:**
- Audit every component with directional CSS (`left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, `pr-*`)
- Replace with RTL-safe equivalents (`start-*`, `end-*`, `ms-*`, `me-*`) via Tailwind v4
- Test every page at `document.documentElement.dir = 'rtl'`

---

### 8. Offline Sync Wiring
`src/hooks/useOfflineSync.ts` and `src/hooks/useServiceWorker.ts` exist but are not connected to the real Supabase data layer. Sales created while offline are lost.

**What to build:**
- Queue offline mutations in IndexedDB when `navigator.onLine === false`
- On reconnect, replay the queue against Supabase in order
- Conflict resolution: last-write-wins with a toast notification for conflicts

---

### 9. Barcode Scanner Hardware Integration
POS search works by typing. Physical barcode scanners (USB HID) emit keystrokes — the current input handles this, but there is no dedicated scan mode.

**What to add:**
- Detect rapid keystrokes ending in Enter (scanner pattern)
- Auto-submit the search and add the product to cart immediately on scan
- Visual/audio feedback on successful scan vs. not-found

---

### 10. Onboarding Email Sequence
After signup, users receive only Supabase's default confirmation email. A triggered email sequence improves activation.

**What to build:**
- Supabase Edge Function triggered on `tenants` INSERT → sends welcome email via Resend or SendGrid
- Day 3 email: "You haven't made your first sale yet — here's how"
- Day 7 email: upgrade CTA if on starter plan

---

## 🟢 Nice-to-Have / Future Roadmap

### 11. CRM — Campaigns and Automation
`AutomatedMarketing.tsx`, `MarketingCampaigns.tsx`, and `CustomerCommunicationHistory.tsx` show informative coming-soon states. These require:
- `campaigns` and `campaign_sends` tables
- Email/SMS send integration (Resend, Twilio)
- Automation trigger engine (time-based or event-based)

### 12. Stock Transfers, Supplier Management, Purchase Orders
Three inventory management features are currently coming-soon empty states. Building them requires:
- `stock_transfers` table with source/destination location
- `suppliers` table
- `purchase_orders` and `purchase_order_items` tables
- Receiving flow that increments `products.stock_quantity`

### 13. Multi-Location Support
`MultiLocationSupport.tsx` currently shows a single-tenant view. True multi-location requires:
- `locations` table per tenant
- `products.location_id` for per-location stock
- Location-scoped POS sessions
- Transfer workflow between locations (see Stock Transfers above)

### 14. API & Webhooks
`ApiAndWebhooks.tsx` is a coming-soon state. Building it requires:
- API key generation and storage (hashed, scoped per tenant)
- Webhook endpoint registration with secret signing (HMAC-SHA256)
- Event firing on key domain events (sale created, product updated, etc.)
- Rate limiting per API key

### 15. Advanced Analytics — AI Insights
The forecasting component uses a simple 7-day moving average. For MENA SMB clients:
- Lebanese holiday calendar for seasonality adjustments
- Margin analysis (not just revenue)
- Customer lifetime value calculation
- Top-performing products and employees in one view

### 16. Data Export Testing
`exportService.ts` handles Excel and PDF export. This has not been tested against the current schema (column names changed in the refactor). Verify all exports produce correct column headers and data before promoting to customers.

---

## Production Checklist (Before First Real Customer)

- [ ] Run `npm run verify` — zero errors
- [ ] All 6 Supabase migrations applied to production project
- [ ] Vercel env vars set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] GitHub secrets set: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (keep-alive)
- [ ] Test full signup → onboarding → first sale flow on production URL
- [ ] Supabase email confirmation templates customized (Dashboard → Auth → Email Templates)
- [ ] Supabase Auth redirect URL set to production domain (Dashboard → Auth → URL Configuration)
- [ ] RLS verified: create two test accounts, confirm data is isolated
- [ ] Export function tested (Excel + PDF)
- [ ] Mobile POS tested on actual phone/tablet
- [ ] Error boundary tested (manually throw in console, verify dark error screen appears)
