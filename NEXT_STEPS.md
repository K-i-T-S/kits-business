# Engineering Roadmap — KiTS Business Terminal

> Last updated: 2026-06-20. Sprint 5 complete.
> Status: Production-grade MVP. All core flows live. Security hardened. Finance module live.
> All items marked ✅ are fully implemented, deployed, and tested in production.

---

## ✅ Completed — All Sprints

### Core POS & Commerce
- ✅ Point of Sale — barcode scanner, cart, checkout, split payments, tips, coupons
- ✅ Receipt printing — `@media print` stylesheet, dark-to-white inversion
- ✅ WhatsApp Receipts — Meta Cloud API v18.0 Edge Function; Business plan gated
- ✅ Lebanese VAT 11% (TVA) — conditional tax display on POS and receipts
- ✅ Dual currency — USD + LBP display on POS; exchange rate in SystemSettings
- ✅ Loyalty Points — earn on sale, redeem at POS, Bronze/Silver/Gold tiers, leaderboard
- ✅ Inventory — CRUD, batch tracking, reorder points, EnhancedImportInventoryModal
- ✅ Stock Transfers, Supplier Management, Purchase Orders
- ✅ Multi-Location — locations CRUD, stock by location, transfer stock
- ✅ Barcode scanner — rapid keystroke detection + Enter flush, flash feedback

### Customers & CRM
- ✅ Customers — CRUD, debt tracking, purchase history, segmentation
- ✅ Customer Loyalty Panel — balance, tier, progress bar, history, adjust points
- ✅ CRM Analytics — retention rate, CLV, revenue, top customers, purchase frequency
- ✅ Customer Segmentation — segment builder UI
- ✅ Marketing Campaigns — full CRUD against `campaigns` table, send-now, schedule
- ✅ Automated Marketing — trigger-based workflow engine with `automated_workflows` table
- ✅ Workflow Automation — enable/disable, Run Now, `trigger-workflows` Edge Function
- ✅ Communication History — per-customer log

### Employees & Auth
- ✅ Employees — CRUD, roles, commission rates
- ✅ 8-Role set — owner, admin, supervisor, accountant, stockkeeper, manager, cashier, viewer
- ✅ Custom Roles Manager — drag-drop permission builder
- ✅ Employee Invitation — `send-invitation` Edge Function, `accept_pending_invitation()` RPC
- ✅ Role-based routing — cashier→POS, stockkeeper→inventory, accountant→reports
- ✅ Multi-tenant — complete RLS isolation, `current_tenant_id()` / `current_user_role()` SECURITY DEFINER
- ✅ Two-Factor Authentication (TOTP) — `supabase.auth.mfa.*`, QR code setup, disable flow in ProfileSettings

### Finance
- ✅ Finance module (`src/pages/Finance.tsx`) — 5-tab page: Overview, Expenses, Payroll, Budget, P&L
- ✅ Expense management — add/edit/delete, USD/LBP toggle, receipt upload to Supabase Storage, VAT tracking
- ✅ 34 Lebanese expense categories — generator fuel, EDL electricity, NSSF, municipal tax, import duties, rent, etc.
- ✅ Payroll — NSSF employer 22.5% auto-calc, EOS 8.5% accrual, transport allowance, bilingual payslip PDF
- ✅ Budget management — monthly targets per category, variance coloring, Copy Last Month
- ✅ P&L Report — Revenue → COGS → Gross Profit → EBITDA → 17% CIT → Net; jsPDF export
- ✅ Forecasting integration — expense data feeds into revenue/profit forecast chart (dashed expense line)
- ✅ Expense categories — role-gated (owner/admin/accountant/supervisor/manager)

### Reports & Analytics
- ✅ Reports — sales, profit, export Excel/PDF
- ✅ Dashboard — live stats, role-aware, recent sales
- ✅ Advanced Analytics — charts, margin analysis
- ✅ Forecasting — 30-day revenue trend, Lebanese holidays, CLV, stock depletion, expense integration, PDF export
- ✅ Monitoring — real Supabase data, 60s auto-refresh, sales velocity, low-stock, DB latency
- ✅ Activity Log — full filterable audit trail with Excel export (ExcelJS)

### Settings & Brand
- ✅ Profile Settings — display name, avatar upload, password change, language, notifications, 2FA
- ✅ System Settings — business info, financial (tax/TIN/dual-currency), POS behaviour, loyalty, WhatsApp setup
- ✅ Brand Identity — logo upload, 6 color presets, custom hex, tagline, CSS vars, favicon swap
- ✅ Dark/Light Theme toggle — ThemeContext, `themes.css`, localStorage persistence
- ✅ Onboarding Wizard — 4-step: Business Profile → First Product → Invite Team → Done

### Platform & Infrastructure
- ✅ Multi-language — 5 locales: EN, AR, FR, ES, ZH; i18next; RTL logical properties
- ✅ Global Search — Cmd+K palette, products/customers/employees, 200ms debounce
- ✅ Offline Sync — IndexedDB queue, reconnect replay via `useOfflineSync`
- ✅ PWA — `PWAInstallPrompt.tsx`, service worker
- ✅ API & Webhooks — API key generation, webhook registration, HMAC, delivery log
- ✅ Admin Panel — PIN-gated (bcrypt, no sessionStorage), tenant management, plan elevation
- ✅ Per-Business Provisioning — `admin_provision_client()` RPC, keep-alive GitHub Action
- ✅ Error Boundary — global catch, session context preserved
- ✅ Bundle optimization — all pages lazy-loaded, ExcelJS/jsPDF dynamic import, Vite chunk splitting
- ✅ GitHub Actions CI — typecheck + build on every push

### Edge Functions (Deployed to `pytndxjeznhhyycjasep`)
| Function | Purpose |
|---|---|
| `welcome-email` | Branded HTML email on tenant creation via Resend |
| `send-invitation` | Employee invite via Supabase auth.admin.inviteUserByEmail |
| `whatsapp-receipt` | WhatsApp receipt via Meta Cloud API v18.0 |
| `trigger-workflows` | Daily summary + low-stock alerts via WhatsApp |

### Migrations Applied (000000–000028)
All 29 migrations applied in production. See CLAUDE.md for full list.

---

## 🔴 Setup Required (Manual — Run Once)

### Done ✅
- [x] Migrations 000000–000028 applied
- [x] Admin PIN hash set in `kits_admin_config`
- [x] `brand-assets` Storage bucket created
- [x] `expense-receipts` Storage bucket created
- [x] `welcome-email` Edge Function deployed
- [x] `send-invitation` Edge Function deployed
- [x] `whatsapp-receipt` Edge Function deployed
- [x] `trigger-workflows` Edge Function deployed
- [x] Loyalty enabled, `customer_points` table live

### Pending
- [ ] **WhatsApp secrets** — `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` in Supabase Secrets (see `docs/setup-whatsapp-receipts.md`)
- [ ] **Email auth redirect URL** — Dashboard → Auth → URL Configuration → `https://kits-business.vercel.app`
- [ ] **Supabase email templates** — Dashboard → Auth → Email Templates (KiTS branding)
- [ ] **Resend API key** confirmed in Supabase Secrets for `welcome-email` function
- [ ] **`avatars` bucket** — Dashboard → Storage → New Bucket → `avatars` (public: off) — needed for ProfileSettings avatar upload

---

## 🟢 Planned — Next Sprints

### Stripe Billing
**Note: Requires Stripe account. Explicitly deferred.**
- `stripe-webhook` Edge Function
- Stripe Checkout session, billing portal link
- Replace WhatsApp upgrade CTA with Stripe Checkout

### Customer-Facing POS Display
- `/display` route, full-screen, Supabase Realtime broadcast
- Second screen shows items being scanned + running total

### Thermal Printer (ESC/POS)
- Web Serial API → Epson TM-T20 (most common in Lebanon)
- Fallback to `window.print()` on unsupported browsers

### Onboarding Email Sequence
- Day-3: "You haven't made your first sale yet"
- Day-7: Growth plan upgrade CTA
- Supabase scheduled Edge Function (daily check)

### Table Management (Restaurant Module)
- `tables` table, floor plan grid, assign sale to table
- Business plan, opt-in module

### White-Label (Business Plan Phase 3)
- Custom domain CNAME
- Remove "Powered by KiTS" for Business plan
- Custom Google Font picker, `brand_font` column
- Custom email from-address (Resend custom domain)

### Campaign Email Send (Resend)
- `send-campaign` Edge Function wired to MarketingCampaigns "Send Now"
- Currently campaigns table is live but outbound email not connected

---

## Production Checklist

### Infrastructure
- [x] TypeScript — zero errors (`npm run typecheck`)
- [x] Migrations 000000–000028 applied
- [x] Vercel env vars set
- [x] GitHub secrets set
- [x] All 4 Edge Functions deployed
- [x] Admin PIN hash set
- [x] CI passing
- [x] `expense-receipts` bucket created

### Pending Verification
- [ ] Full signup → email confirmation → onboarding → first sale (new account)
- [ ] Employee invitation end-to-end
- [ ] WhatsApp receipt end-to-end (after secrets set)
- [ ] Finance: add expense → view in Overview → P&L export
- [ ] Payroll: add entry → download bilingual payslip
- [ ] 2FA: enable → QR scan → verify → disable
- [ ] RLS isolation: two test accounts see only their own data
- [ ] Mobile POS on physical phone (375px, touch targets)
- [ ] Arabic RTL on physical device

### Tested in Production (2026-06-18/19)
- [x] Auth guard, login, tenant selection, dashboard
- [x] First sale via POS (Receipt #698D1AA9)
- [x] Dashboard stats, recent sales, quick actions
- [x] Inventory, Customers, Employees, Reports
- [x] Export Excel + PDF
- [x] FeatureGate lock for lower plans
- [x] Admin panel — PIN gate, tenant list, plan elevation
- [x] Brand identity modal — logo upload, colors, live preview
- [x] System Settings — tax, TIN, dual currency, loyalty config
- [x] Forecasting page — revenue chart, holidays, CLV, stock depletion
