# KiTS Business Terminal — Master Plan

> **Vision:** The all-in-one, multi-vertical, AI-powered business platform that dominates the Lebanese and MENA market. Beautiful enough to stop a conversation. Intelligent enough to replace a consultant. Simple enough for a 19-year-old cashier on day one. Built for Lebanon — designed to scale globally.

> **Last Updated:** 2026-06-20
> **Status Legend:** `[PENDING]` → `[IN_PROGRESS]` → `[COMPLETED]` | `[BLOCKED]`

---

## Market Position (Research-Validated)

**The gap we own:** No platform today combines multi-vertical POS + integrated accounting with Lebanese VAT (11%, rising to 12%) + NSSF payroll (22.5%) + LBP/USD dual-currency on a single transaction + offline resilience + WhatsApp-native receipts + Toters/Zomato delivery integration — at under $79/month with self-serve onboarding.

**Closest competitors:**
- **Sandooq** ($29/mo) — best local POS, handles LBP/USD with split drawers and Sayrafa rate sync. No CRM, no payroll, no delivery integration, no verticals.
- **MAPOS** — has Toters/Zomato for F&B. No self-serve, no payroll, no retail verticals.
- **Foodics** ($113–$326/mo) — best MENA restaurant POS, offline capable, Arabic-first. No LBP, no Lebanese VAT, no Lebanese payments, Gulf pricing only.
- **Marn** — deadpooled May 2026. Gone.
- **Odoo/SAP** — enterprise only, $8K–$80K year-one cost, no self-serve.

**Our unoccupied position:** Self-serve · Multi-vertical · Lebanese-compliant · Offline-first · Under $79/month

**Beachhead sequence:** Beirut/Tripoli F&B → Lebanese retail → Services → MENA (Jordan, Egypt, Iraq)

**Pricing tiers:**
| Tier | Price | Target |
|---|---|---|
| Starter | Free | Micro-SMBs, trial |
| Growth | $29/month | Restaurants, boutiques |
| Business | $79/month | Growing businesses, chains |

---

## Principles (Every Agent Reads This First)

1. **Zero half-baked screens.** Every sprint ships complete, polished, tested UI.
2. **TypeScript strict, always.** `npm run typecheck` must pass before any sprint is marked complete.
3. **Lebanon DNA.** USD/LBP dual currency, Whish payments, offline-first, Arabic RTL, Ramadan modes — these are not optional extras, they are the product.
4. **Three layers:** Employee layer (dead simple), Manager layer (powerful), Enterprise/Investor layer (unified intelligence).
5. **Zero-cost AI.** In-platform statistical algorithms + Groq free tier via Edge Function proxy. No OpenAI costs.
6. **Dark navy.** `bg-slate-900`, `bg-slate-950`, `text-white`. Never introduce light backgrounds unless explicitly told to.
7. **Mobile-first.** Test at 375px before 1440px. Touch targets minimum 44px.
8. **i18n always.** Every string through `useTranslation()`. No hardcoded English.

---

## Stack Reference

- **Frontend:** React 18, Vite, TypeScript strict, Tailwind CSS v4, shadcn/ui
- **Data:** Supabase (PostgREST direct), RLS for tenant isolation
- **State:** AppContext (domain), SubscriptionContext (tier/role), TanStack Query (async)
- **Auth:** Supabase Auth, `onAuthStateChange` in App.tsx
- **i18n:** i18next, locales in `src/i18n/locales/`
- **Path alias:** `@/` → `src/`
- **Theme:** ThemeContext + `html.light-theme` / `html.dark-theme` CSS classes + Tailwind `dark:` variants

---

## Track 1 — Polish & Demo-Readiness

*Goal: Make every existing screen impressive enough to demo. Fix what's broken. Elevate what exists. The dashboard must make investors lean forward.*

---

### Sprint 1.1 — Theme System Unification [COMPLETED]
> Completed 2026-06-20: ThemeContext now adds `.dark` class alongside `dark-theme` so Tailwind v4 `dark:` variants and shadcn CSS variables activate correctly in dark mode.

**Track:** 1 · Polish & Demo-Readiness
**Priority:** Critical — blocks everything visual
**Depends on:** None
**Estimated effort:** Medium

#### Goal
The light/dark theme toggle exists (`ThemeContext`, `themes.css`) but does not apply consistently. The ThemeContext adds `html.light-theme` / `html.dark-theme` classes, but Tailwind's `dark:` variants expect a `.dark` class on `<html>`. These two systems fight each other. Fix the theme to be a single, consistent, fully-applied system across every page, component, modal, and service.

#### Problem Details
- `ThemeContext` sets `html.light-theme` and `html.dark-theme` CSS class
- `themes.css` overrides `bg-slate-900/950` etc. for light mode via `html.light-theme` selectors
- Tailwind `dark:` variants need `html.dark` — these never fire because the class is `dark-theme` not `dark`
- Result: light theme partially works via CSS overrides, Tailwind `dark:` variants never activate

#### Files to Modify
- `src/context/ThemeContext.tsx` — also apply/remove `dark` class alongside `dark-theme`
- `src/styles/themes.css` — audit all light-theme overrides, ensure complete coverage
- `src/styles/globals.css` — verify `@custom-variant dark` directive is aligned
- `src/pages/Login.tsx` — verify theme applies
- `src/pages/Dashboard.tsx` — verify theme applies
- `src/components/Layout.tsx` — verify sidebar/header theme applies
- All modal components — verify theme applies

#### Acceptance Criteria
- [ ] Toggle button in sidebar correctly switches between light and dark
- [ ] Dark mode: all backgrounds `bg-slate-900/950`, text `text-white`
- [ ] Light mode: clean white/slate backgrounds, dark text, visible borders
- [ ] Theme persists across page refresh (already in localStorage — verify it works)
- [ ] Theme applies to: Dashboard, Login, POS, Finance, Inventory, Employees, Reports, all modals
- [ ] `npm run typecheck` passes with zero errors
- [ ] No console errors related to theming

---

### Sprint 1.2 — Login Page Complete Overhaul [IN_PROGRESS]

**Track:** 1 · Polish & Demo-Readiness
**Priority:** Critical — first impression
**Depends on:** Sprint 1.1
**Estimated effort:** High

#### Goal
Redesign the login page from a static form into an animated, role-aware, visually stunning entry point that immediately communicates the platform's quality. This is the first thing any investor, client, or employee sees. It must be memorable.

#### Design Direction
- **Split layout:** Left panel = animated brand/feature showcase. Right panel = auth form.
- **Animated background:** Aurora effect (CSS radial gradient animation) or subtle particle mesh — zero runtime cost
- **3D brand element:** KiTS logo with subtle 3D tilt on hover using CSS `perspective` + `rotateX/Y` transforms — no Three.js needed for this
- **Role-aware flow:** After login, detect role and route accordingly. Employees see a simplified "clock in" style flow. Owners/managers see the full dashboard redirect.
- **Micro-interactions:** Form field focus animations, password strength indicator, smooth error states
- **Social proof strip:** "Trusted by 500+ Lebanese businesses" type messaging with animated counter (even if aspirational for now)
- **Feature highlights:** Animated cycling of platform capabilities in the left panel

#### Files to Create/Modify
- `src/pages/Login.tsx` — full redesign (keep auth logic, replace all UI)
- `src/components/login/LoginForm.tsx` — extract form as sub-component
- `src/components/login/BrandPanel.tsx` — animated left panel
- `src/styles/login.css` — aurora/animation keyframes if needed

#### Acceptance Criteria
- [ ] Split layout on desktop, stacked on mobile (form first on mobile)
- [ ] Aurora or animated gradient background — visible and smooth
- [ ] Form: email, password, show/hide toggle, forgot password link
- [ ] Sign up toggle: business name field appears smoothly
- [ ] Loading state: skeleton/spinner while authenticating
- [ ] Error state: animated error message, no layout shift
- [ ] Left panel cycles through 3-4 platform features with smooth transition
- [ ] All text uses `useTranslation()` — Arabic RTL ready
- [ ] `npm run typecheck` passes

---

### Sprint 1.3 — Navigation Restructure & Search Enhancement [PENDING]

**Track:** 1 · Polish & Demo-Readiness
**Priority:** High
**Depends on:** None
**Estimated effort:** Medium

#### Goal
Reorder the navigation to be logical and intuitive. Add search enhancements. The current order (Dashboard → Inventory → POS → Customers → Employees → Monitoring → Reports → Finance → Enterprise) is not grouped by user workflow.

#### New Navigation Order
```
── Operations ──
  Dashboard
  POS / Sales
  Inventory

── People ──
  Customers & CRM
  Employees

── Intelligence ──
  Reports
  Finance
  Forecasting

── Platform ──
  Monitoring
  Enterprise
  Settings
```

Section dividers with labels in the sidebar. Grouped logically.

#### Search Enhancements
- Global search (`GlobalSearch.tsx`) should search across: products, customers, employees, sales, expenses
- Keyboard shortcut `Cmd/Ctrl+K` opens search
- Search results grouped by type with icons
- Recent searches persisted in localStorage
- Fuzzy matching (not just exact string match)

#### Files to Modify
- `src/components/Layout.tsx` — reorder navItems array, add section dividers
- `src/components/GlobalSearch.tsx` — enhance search with categories, fuzzy match, recents
- `src/components/NavItem.tsx` — support section divider rendering

#### Acceptance Criteria
- [ ] Navigation items in new logical order with section labels
- [ ] Section dividers render cleanly in both dark/light themes
- [ ] `Cmd+K` / `Ctrl+K` opens global search
- [ ] Search returns results across products, customers, employees
- [ ] Results grouped by type (Products, Customers, Employees, etc.)
- [ ] Recent searches shown when search is empty
- [ ] Mobile nav also reflects new order
- [ ] `npm run typecheck` passes

---

### Sprint 1.4 — 3D Dashboard Overhaul [PENDING]

**Track:** 1 · Polish & Demo-Readiness
**Priority:** Critical — the hero demo screen
**Depends on:** Sprint 1.1, Sprint 1.3
**Estimated effort:** Very High

#### Goal
Transform the current basic dashboard (288 lines, 4 stat cards + table) into an awe-inspiring command center that makes investors lean forward. This is the centerpiece of every demo.

#### Design Architecture
**Header zone:** Greeting with tenant name, current time, today's date in both Arabic and English. Live "pulse" indicator showing system is active.

**KPI Row (Bento Grid):** 4-6 animated metric cards using Aceternity `3D Card Effect` + `Number Ticker` for count-up animation on load:
- Today's Revenue (USD + LBP equivalent)
- Today's Transactions
- Active Inventory Value
- Customer Count + New Today
- Low Stock Alerts (clickable → inventory)
- Gross Margin %

**3D Globe (optional/flagship):** If enterprise multi-location: `three-globe` or `@react-three/fiber` globe showing branch locations with glow pins. Lazy-loaded, image fallback on mobile. `frameloop="demand"`.

**Charts Section (2-col grid on desktop):**
- Revenue trend: `<AreaChart>` with gradient fill — last 30 days
- Sales by hour: `<BarChart>` — today's hourly distribution (helps optimize staffing)
- Top Products: `<HorizontalBarChart>` — top 5 by revenue today
- Customer Activity: sparkline + total

**Live Activity Feed:** Right-side panel, last 10 transactions in real-time with Supabase `channel().on()` subscription. Each item animates in from bottom.

**AI Insight Cards:** 2-3 "smart insight" cards at bottom using Groq llama-3.1-8b-instant (via Edge Function proxy, cached 1hr). Examples: "Sales are 23% above last Tuesday at this hour", "3 products will be out of stock by tomorrow at current rate".

**Quick Actions:** Floating action buttons: New Sale → POS, Add Product → Inventory, View Reports.

#### Install Required
```bash
npm install @react-three/fiber @react-three/drei recharts framer-motion
```
(Check if already installed first — some may be present)

#### Files to Create/Modify
- `src/pages/Dashboard.tsx` — complete rewrite
- `src/components/dashboard/KPICard.tsx` — 3D tilt card with Number Ticker
- `src/components/dashboard/RevenueChart.tsx` — Recharts area chart
- `src/components/dashboard/LiveActivityFeed.tsx` — real-time transaction feed
- `src/components/dashboard/AIInsightCard.tsx` — AI insight display
- `src/components/dashboard/QuickActions.tsx` — floating action buttons
- `supabase/functions/ai-insights/index.ts` — Groq proxy Edge Function

#### Acceptance Criteria
- [ ] Page loads and KPI numbers count up from 0 with smooth animation
- [ ] All charts render with real data from AppContext
- [ ] Live activity feed updates in real-time (or simulated if Supabase channel not available in local mode)
- [ ] Mobile layout: single column, charts full-width, no 3D (performance)
- [ ] 3D globe: loads lazily, shows fallback image on mobile/low-end devices
- [ ] AI insights: at minimum shows static intelligent messages based on data patterns (Groq optional)
- [ ] All text translated via `useTranslation()`
- [ ] `npm run typecheck` passes
- [ ] No console errors

---

### Sprint 1.5 — Notification System Overhaul [PENDING]

**Track:** 1 · Polish & Demo-Readiness
**Priority:** High
**Depends on:** Sprint 1.1
**Estimated effort:** Medium-High

#### Goal
Replace the stale notification panel with a real-time, intelligent notification engine that surfaces timely, actionable alerts from every module.

#### Notification Types
**Inventory:** Low stock alert (product below reorder point), Expiry alert (items expiring within 7 days), Purchase order received, Stock transfer completed
**Sales:** Large sale (above threshold), End-of-day summary, Payment pending (customer debt)
**Employees:** Clock-in/out events, Shift starting in 30 min, Performance milestone
**Finance:** Budget exceeded (category), Expense approval needed, Payroll due date
**System:** New device login, Failed sync, Offline mode entered/exited
**AI-generated:** Anomaly detected in sales pattern, Unusual expense category spike

#### Architecture
- Notification center in Layout header (bell icon with unread count badge)
- Slide-out panel (from right) with grouped notifications
- Each notification: icon, title, body, timestamp, action button (deep link to relevant page)
- Mark as read / mark all read / dismiss
- Notification preferences per category (on/off) in System Settings
- Real-time via Supabase channel subscriptions where applicable
- Browser push notifications (request permission on first open)

#### Files to Create/Modify
- `src/components/NotificationCenter.tsx` — replace/enhance existing notification UI
- `src/hooks/useNotifications.ts` — notification state and subscriptions
- `src/utils/notificationEngine.ts` — logic for generating notifications from data
- `src/components/Layout.tsx` — wire NotificationCenter to header bell icon
- `src/components/NotificationSettings.tsx` — preferences UI

#### Acceptance Criteria
- [ ] Bell icon in header shows unread count badge
- [ ] Click opens slide-out panel (smooth animation)
- [ ] At least 5 notification types generated from real app data
- [ ] Mark as read updates badge count
- [ ] "Mark all read" clears all
- [ ] Notifications persist in localStorage (no DB table needed initially)
- [ ] Deep links navigate to the relevant page/section
- [ ] Notification preferences toggles in System Settings
- [ ] `npm run typecheck` passes

---

## Track 2 — Vertical Intelligence

*Goal: Build industry-specific modules that make KiTS irreplaceable for each business type. Each vertical adds its own data model, UI, and workflows without breaking the generic platform.*

---

### Sprint 2.1 — Industry Selection System & Vertical Routing [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** Critical — foundation for all verticals
**Depends on:** Sprint 1.3
**Estimated effort:** High

#### Goal
Build the industry selection system that determines which vertical-specific features, navigation items, dashboard widgets, and POS flows are shown. This is the foundation every other vertical sprint builds on.

#### Industries to Support
1. **Restaurant / F&B** — tables, KDS, menu, delivery
2. **Pharmacy** — drug database, expiry, prescriptions, narcotics
3. **Supermarket / Grocery** — FIFO, weight items, departments, shelf life
4. **Clothing & Fashion** — size-color matrix, seasons, markdowns
5. **Electronics** — serial numbers, warranty, repair orders
6. **Phone Shop / Mobile** — IMEI, carrier, repair, trade-in
7. **General Retail** — no vertical-specific features, full generic platform

#### Architecture
**Tenant-level setting:** `industry` column on `tenants` table (migration required).
**Onboarding step:** Industry selection added as step 1 of OnboardingWizard with visual cards for each industry.
**Vertical context:** `src/context/IndustryContext.tsx` — provides `industry`, `hasVerticalFeature(feature)`.
**Vertical navigation:** Layout adds/hides nav items based on industry. Restaurant shows "Tables" and "Kitchen Display". Pharmacy shows "Drug Database" and "Prescriptions". Etc.
**Vertical dashboard widgets:** Dashboard pulls in industry-specific KPI widgets.
**POS vertical mode:** EnhancedPOS gets industry-aware panels.

#### Files to Create
- `src/context/IndustryContext.tsx`
- `src/types/industry.ts` — Industry enum, vertical feature flags
- `src/components/industry/IndustrySelector.tsx` — visual card picker
- `supabase/migrations/20260620_000030_industry_column.sql`

#### Files to Modify
- `src/components/OnboardingWizard.tsx` — add industry selection step
- `src/components/Layout.tsx` — conditional nav items per industry
- `src/pages/Dashboard.tsx` — industry-specific widget slots
- `src/App.tsx` — wrap with IndustryProvider

#### Acceptance Criteria
- [ ] Industry stored on tenant and persists
- [ ] Onboarding wizard includes industry selection with visual cards
- [ ] Existing tenants can change industry in System Settings
- [ ] Navigation shows/hides items based on industry
- [ ] `hasVerticalFeature()` hook available to all components
- [ ] Migration runs cleanly
- [ ] `npm run typecheck` passes

---

### Sprint 2.2 — Restaurant Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** High
**Depends on:** Sprint 2.1
**Estimated effort:** Very High

#### Goal
Build the core restaurant management module. When industry = restaurant, the platform becomes a full F&B management system.

#### Features to Build
**Table Management:**
- Visual floor plan with drag-and-drop table layout editor
- Table states: available / occupied / reserved / cleaning
- Seat count per table, section assignment (terrace, indoor, bar)
- Real-time table status board

**Order Management:**
- Table-linked orders (replace generic POS for restaurant vertical)
- Course-based ordering: appetizers / mains / desserts
- Item modifiers: required and optional, price delta, multi-select
- "Fire course" action — tells kitchen to start preparing next course
- Split bill: by seat, by item, evenly N ways

**Kitchen Display System (KDS):**
- Full-screen KDS view (`/restaurant/kds`) — for kitchen tablet/monitor
- Tickets by station (grill, cold, bar, pastry)
- Ticket age timer with color coding (green → yellow → red)
- Bump to confirm item ready

**Menu Management:**
- Time-based menus: breakfast / lunch / dinner auto-switch
- 86 list: mark item as out-of-stock, propagates instantly
- Recipe cards with ingredient-level cost calculation
- Modifier group management

**Reservations:**
- Booking form: name, phone (WhatsApp), party size, date/time, special notes
- Reservation list view with upcoming/today filter
- Table assignment from reservation
- WhatsApp confirmation message on booking

#### Database
- `tables`, `table_orders`, `order_items`, `modifiers`, `modifier_groups`, `menu_time_slots`, `reservations`, `kds_stations`

#### Files to Create
- `src/pages/restaurant/TableManagement.tsx`
- `src/pages/restaurant/KitchenDisplay.tsx`
- `src/pages/restaurant/Reservations.tsx`
- `src/components/restaurant/FloorPlan.tsx`
- `src/components/restaurant/OrderTicket.tsx`
- `src/components/restaurant/MenuEditor.tsx`
- `supabase/migrations/20260620_000031_restaurant_schema.sql`

#### Lebanon/MENA Specifics
- **Toters** (Lebanon's dominant delivery app): order injection webhook + menu sync — this is table stakes for any Beirut restaurant in 2026
- **Zomato Lebanon**: webhook integration (secondary but growing)
- **Talabat**: placeholder webhook (confirm Lebanon presence before deep integration)
- Service charge (10–15%) vs. tip: separate fields, separate accounting, separate staff disbursement
- Ramadan mode toggle: Iftar/Suhoor time-based menu switching, Iftar rush prep alerts based on reservations
- Informal tipping: optional cash prompt (never mandatory US-style); tip pool vs. individual attribution
- No-show tracking with WhatsApp deposit confirmation (Lebanon no-show rate is high)
- Lebanese VAT 11% on food/beverage (configurable for upcoming 12% rate)

#### Acceptance Criteria
- [ ] Table map renders, tables can be dragged to new positions
- [ ] Order can be placed on a table, sent to KDS
- [ ] KDS displays tickets with age timers, bump works
- [ ] Bill split works for at least 3 split modes
- [ ] Reservations CRUD works with WhatsApp notification
- [ ] All text translatable (Arabic RTL)
- [ ] `npm run typecheck` passes

---

### Sprint 2.3 — Pharmacy Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** High
**Depends on:** Sprint 2.1
**Estimated effort:** Very High

#### Goal
Build the pharmacy management module aligned with Lebanese MoPH regulations and Order of Pharmacists requirements.

#### Features to Build
**Drug Database:**
- Product import from MoPH drug registry format (CSV/JSON)
- Drug search by: trade name, generic name, ATC code, manufacturer
- Automatic product creation from drug database lookup on barcode scan
- Drug classification badges (OTC / Prescription Required / Controlled)

**Expiry & Lot Tracking:**
- FEFO enforcement (First Expired First Out) at POS — warn if selling later expiry when earlier exists
- Lot number recorded at receiving
- Expiry alerts dashboard: 30-day, 7-day, expired
- Near-expiry report with return-to-supplier workflow

**Prescription Management:**
- Prescription capture (camera scan or manual entry)
- Link sale to prescription record
- Track partial fills for chronic medication
- Pharmacist on-duty attribution per sale

**Controlled Substances (Narcotics Register):**
- Dedicated controlled substance log (Law 673/1998 compliance)
- Per-dispensing: drug, quantity, lot, prescribing doctor, patient ID, pharmacist
- Daily log printable for ISF inspection
- Controlled substance inventory reconciliation

**Lebanese Insurance Integration:**
- Insurance provider selection at POS (CNSS, Allianz, AXA, Medgulf, etc.)
- Manual co-payment calculation (% of drug price by insurer)
- Insurance claim record (for manual submission to insurer)

**VAT Exemption:**
- Medications: VAT-exempt (0%)
- Parapharmacy/cosmetics: VAT 11%
- Automatic classification based on drug database category

#### Database
- `drug_database`, `prescriptions`, `narcotics_log`, `pharmacy_insurance`, `lot_tracking` (extends existing batch_tracking)

#### Files to Create
- `src/pages/pharmacy/DrugDatabase.tsx`
- `src/pages/pharmacy/NarcoticsRegister.tsx`
- `src/pages/pharmacy/Prescriptions.tsx`
- `src/components/pharmacy/ExpiryAlertDashboard.tsx`
- `src/components/pharmacy/InsuranceCoPay.tsx`
- `supabase/migrations/20260620_000032_pharmacy_schema.sql`

#### Acceptance Criteria
- [ ] Drug database searchable, products auto-populate from it
- [ ] POS warns when selling expired or near-expired lot
- [ ] FEFO enforcement at scan — earlier expiry sold first
- [ ] Narcotics log records all controlled substance dispensings
- [ ] Daily narcotics report printable
- [ ] VAT applied correctly (0% medication, 11% parapharmacy)
- [ ] `npm run typecheck` passes

---

### Sprint 2.4 — Supermarket / Grocery Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** High
**Depends on:** Sprint 2.1
**Estimated effort:** Very High

#### Goal
Build the grocery-specific management module with focus on FIFO, shelf-life, weight items, department management, and the tight-margin precision grocery retail requires.

#### Features to Build
**Department Management:**
- Grocery departments: Produce, Dairy, Meat, Bakery, Dry Goods, Frozen, Beverages, HBC
- Per-department P&L (revenue, cost, shrinkage, margin)
- Department-level inventory

**Weight-Based Items:**
- PLU code support (4-digit codes for produce without barcodes)
- Scale integration placeholder — manual weight entry at POS
- Price-per-kg calculation at checkout

**FIFO / FEFO Inventory:**
- Receiving records lot and expiry per batch
- POS enforces FIFO/FEFO at scan
- Auto-markdown rules: within 3 days of expiry → 30% off; 1 day → 50%
- Expired item blocking (cannot be sold after expiry date)

**Shelf Life Tracking:**
- Daily expiry report by department
- Pull-and-destroy workflow (mark items removed from shelf)
- Waste tracking (cost of destroyed items)

**Bulk & Tiered Pricing:**
- Buy X get Y free
- Quantity-based price breaks
- Case price vs. unit price

**End-of-Day Reconciliation:**
- Multiple till management
- Cash denomination count per till
- Shortage/overage per cashier
- Safe drop recording

#### Files to Create
- `src/pages/supermarket/DepartmentManager.tsx`
- `src/pages/supermarket/ShelfLifeTracker.tsx`
- `src/components/supermarket/ExpiryDashboard.tsx`
- `src/components/supermarket/TillReconciliation.tsx`
- `supabase/migrations/20260620_000033_supermarket_schema.sql`

#### Acceptance Criteria
- [ ] Department P&L renders with real data
- [ ] FIFO/FEFO enforced at POS with warning modal
- [ ] Near-expiry auto-markdown applied at checkout
- [ ] Pull-and-destroy workflow records waste cost
- [ ] Bulk pricing rules apply at checkout
- [ ] `npm run typecheck` passes

---

### Sprint 2.5 — Clothing & Fashion Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** Medium
**Depends on:** Sprint 2.1
**Estimated effort:** High

#### Features to Build
- Size-Color-Style variant matrix at POS (visual grid selector)
- Season / Collection management
- Markdown calendar with scheduled automatic price changes
- Layaway / installment tracking
- Returns & exchanges with receipt matching
- Alteration job tickets
- Staff commission tracking per brand/item
- WhatsApp customer styling consultations (order via WhatsApp)

---

### Sprint 2.6 — Electronics Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** Medium
**Depends on:** Sprint 2.1
**Estimated effort:** High

#### Features to Build
- Serial number tracking per unit (per-unit inventory, not qty-based)
- Warranty management (start date, duration, manufacturer vs. extended)
- Service / Repair order module with job cards
- Trade-in valuation and used inventory
- RMA (Return Merchandise Authorization) management
- Grey market vs. official distributor tracking
- Parts inventory for repairs (model-compatible)

---

### Sprint 2.7 — Phone Shop / Mobile Vertical [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** Medium
**Depends on:** Sprint 2.1, Sprint 2.6
**Estimated effort:** High

#### Features to Build
- IMEI tracking (dual-IMEI support, blacklist check)
- Lebanese carrier plan management (MTC Touch, Alfa — SIM cards, recharge)
- Condition grading system (Grade A+ through D)
- Repair job module (extends electronics repair)
- IMEI unlocking service management
- Installment / layaway tracking (critical for Lebanese market)
- Trade-in with IMEI-based pricing guide
- Recharge card inventory by denomination

---

### Sprint 2.8 — POS Enhancements (All Verticals) [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** High
**Depends on:** Sprint 2.1
**Estimated effort:** High

#### Goal
Enhance the existing POS (`EnhancedPOS.tsx`, `POS.tsx`) to support all new vertical capabilities, plus general improvements.

#### Features to Build
**General POS:**
- Barcode scanner input mode (listen for rapid keystroke sequences = scanner input)
- Customer quick-add at checkout (name + phone, no full form required)
- Debt/credit on account (customer charges to their tab)
- Multi-payment split: cash USD + cash LBP + Whish (partially paid, remainder pending)
- Void/refund with manager PIN confirmation
- Receipt: print, WhatsApp, email — three options always visible
- Offline mode indicator: green/orange dot in header, queue transactions when offline, auto-sync on reconnect

**Vertical-Specific at POS:**
- Restaurant: table selection before order, course fire button
- Pharmacy: expiry warning at scan, prescription link
- Grocery: PLU weight entry dialog, FIFO warning
- Fashion: size-color grid selector
- Electronics/Mobile: serial number / IMEI scan at checkout

---

### Sprint 2.9 — Employee System Overhaul [PENDING]

**Track:** 2 · Vertical Intelligence
**Priority:** High
**Depends on:** Sprint 1.2
**Estimated effort:** Very High

#### Goal
Build a comprehensive employee management system with role-based login flows, performance monitoring, flexible payroll, and attendance tracking that accommodates Lebanon's informal employment reality.

#### Role-Based Login Flow
**Owner/Admin/Manager:** → Full dashboard with all metrics
**Cashier:** → POS directly, minimal navigation, just what they need
**Stockkeeper:** → Inventory page directly
**Accountant:** → Finance/Reports directly
**Supervisor:** → Dashboard with team view

The login page must detect the role on auth and route correctly. Employee-facing screens are simplified — no sidebar overwhelm.

#### Attendance & Time Tracking
- Clock in / clock out from any device
- GPS location capture at clock-in (optional, toggleable per tenant)
- Shift schedule management
- Late arrival / early departure flagging
- Overtime calculation (configurable rules per tenant)
- Absence management with reason codes

#### Performance Monitoring
- Sales per employee (cashiers)
- Items processed per hour (cashiers)
- Inventory actions per shift (stockkeepers)
- Expense approvals processed (accountants)
- Customer interactions (CRM)

#### Flexible Payroll (Lebanon-Specific)
Manager-configurable pay logic:
- Fixed monthly salary (USD or LBP)
- Hourly rate with OT multiplier
- Commission-based (% of sales)
- Mixed: base + commission
- Informal arrangements: free-form notes per employee

NSSF (22.5% employer, 8.5% employee) pre-calculated but toggleable
Transport allowance (configurable daily amount)
End of Service calculations (8.5% accrual, already in Finance module — link here)

#### Features to Build
- `src/pages/Employees.tsx` — enhance with performance dashboard
- `src/components/employees/AttendanceTracker.tsx`
- `src/components/employees/ShiftScheduler.tsx`
- `src/components/employees/PerformanceDashboard.tsx`
- `src/components/employees/FlexiblePayrollConfig.tsx`
- Employee-facing layout (simplified Layout variant)

---

## Track 3 — Lebanon DNA

*Goal: Features that make KiTS feel like it was born in Lebanon, not adapted for it.*

---

### Sprint 3.1 — USD/LBP Currency Rate Management [PENDING]

**Track:** 3 · Lebanon DNA
**Priority:** Critical
**Depends on:** None
**Estimated effort:** High

#### Goal
Build the currency rate management system with 6 selectable algorithms for handling existing inventory when the exchange rate changes.

#### Algorithm Implementations

**1. Weighted Average Cost (WAC)**
Blends all purchase costs at their respective rates. New rate changes only affect new purchases.
`new_cost = Σ(batch_qty × batch_cost_usd) / total_qty`

**2. FIFO Currency**
First inventory purchased = first inventory sold. Older stock retains its original cost rate. New stock uses new rate.

**3. Margin-Protection Repricing**
When rate changes, auto-recalculate all LBP selling prices to maintain same USD margin %.
`new_lbp_price = cost_usd × new_rate × (1 + target_margin_%)`

**4. Cost-Plus Rate Lock**
Lock a "working rate" for a defined period. Absorb fluctuations within ±X% of locked rate. Trigger repricing only outside the band.

**5. Rate Ladder (Band Pricing)**
Define price bands by rate range. E.g.: rate 85,000-90,000 → price A; 90,000-95,000 → price B. Prices auto-switch when rate crosses band boundary.

**6. Market Rate + Fixed Spread**
Always price at: `cost_usd × current_market_rate × (1 + spread_%)`
Most aggressive — prices update in near real-time with rate.

#### UI
- Rate change modal: current rate, new rate, algorithm picker with description, preview of affected products and new prices
- Algorithm comparison table: show price impact of each algorithm for top 10 products
- Confirmation step: "Apply to X products in inventory"
- History: rate change log with algorithm used, who changed it, impact

#### Files to Create
- `src/components/currency/RateChangeModal.tsx`
- `src/components/currency/AlgorithmComparison.tsx`
- `src/utils/currencyAlgorithms.ts` — all 6 algorithm implementations
- `src/hooks/useExchangeRate.ts`
- `supabase/migrations/20260620_000034_exchange_rate_history.sql`

#### Acceptance Criteria
- [ ] All 6 algorithms implemented and unit tested
- [ ] Rate change modal shows algorithm comparison before applying
- [ ] Applying repricing updates all affected products' LBP prices
- [ ] Rate change history logged with algorithm used
- [ ] Current rate displayed in header (configurable display)
- [ ] `npm run typecheck` passes

---

### Sprint 3.2 — Whish Payment Integration [PENDING]

**Track:** 3 · Lebanon DNA
**Priority:** High
**Depends on:** Sprint 2.8
**Estimated effort:** Medium

#### Goal
Integrate Whish (Lebanon's fastest-growing mobile payment platform) as a first-class payment method in the POS.

#### What Whish Is
Whish Money is a Lebanese e-wallet and money transfer app used by millions of Lebanese. Businesses can receive payments via QR code or phone number transfer. No formal merchant API is publicly documented — integration is via:
1. **QR code generation** (Whish business accounts have a static QR)
2. **Manual confirmation** (cashier confirms payment on Whish app)
3. **Webhook** (if/when Whish provides API access)

#### Implementation Approach (Practical for Lebanon)
Since Whish doesn't have a public merchant API yet:
- Add "Whish" as a payment method alongside Cash, Card
- On selecting Whish: show tenant's Whish QR code (configured in settings) + phone number
- Cashier manually confirms payment received in the Whish app
- System records transaction as "Whish" payment with amount in USD + LBP equivalent
- Receipt shows "Paid via Whish"

Future: webhook integration when Whish releases merchant API.

#### Files to Create/Modify
- `src/components/pos/WhishPayment.tsx` — QR display + confirmation UI
- `src/pages/SystemSettings.tsx` — add Whish QR/phone configuration
- `src/components/EnhancedPOS.tsx` — add Whish to payment methods

#### Acceptance Criteria
- [ ] Whish appears as payment option in POS
- [ ] Selecting it shows business Whish QR code
- [ ] Manual confirm records payment
- [ ] Transactions tagged as "Whish" in reports
- [ ] Whish QR configurable in settings
- [ ] `npm run typecheck` passes

---

### Sprint 3.3 — Offline-First POS [PENDING]

**Track:** 3 · Lebanon DNA
**Priority:** Critical
**Depends on:** Sprint 2.8
**Estimated effort:** High

#### Goal
Make the POS fully operational during power outages and internet disruptions. Transactions queue locally and sync automatically when connection restores.

#### Architecture
- **IndexedDB** (via `idb` library, ~4KB) for local transaction storage
- **Service Worker** for background sync when connection restores
- POS detects offline state via `navigator.onLine` + active ping to Supabase
- Offline mode: accept sales, store in IndexedDB, show orange "OFFLINE" indicator
- Reconnect: auto-sync queued transactions to Supabase in order, show sync progress
- Conflict resolution: offline sales always succeed (inventory may be slightly off — reconcile on sync)

#### PWA Manifest Enhancement
- Already has `PWAInstallPrompt.tsx` — verify manifest is complete
- App shell cached in service worker for true offline launch

#### Files to Create/Modify
- `src/utils/offlineStore.ts` — IndexedDB wrapper for queued transactions
- `src/hooks/useOfflineSync.ts` — sync logic on reconnect
- `src/components/OfflineIndicator.tsx` — enhance existing with sync status
- `public/sw.js` — service worker with background sync

#### Acceptance Criteria
- [ ] POS works when internet is disconnected (use browser DevTools offline mode to test)
- [ ] Transactions created offline are stored in IndexedDB
- [ ] Orange "OFFLINE" indicator visible when disconnected
- [ ] On reconnect, queued transactions sync to Supabase automatically
- [ ] Sync progress shown: "Syncing 3 transactions…"
- [ ] App launches offline (PWA shell cached)
- [ ] `npm run typecheck` passes

---

### Sprint 3.4 — Arabic RTL Complete Coverage [PENDING]

**Track:** 3 · Lebanon DNA
**Priority:** High
**Depends on:** Sprint 1.1
**Estimated effort:** High

#### Goal
Complete Arabic RTL support across every page, component, modal, chart, and form in the platform. Currently partial — this sprint makes it production-ready.

#### Scope
- Audit every component for RTL correctness
- Fix directional issues: margins, paddings, flex direction, icons (arrows, chevrons must flip)
- Font system: Cairo (headings) + Tajawal (body) for Arabic mode. Inter/Geist for numbers in all modes.
- All charts and tables: wrap in `<div dir="ltr">` (charts don't support RTL natively — this is the correct approach)
- Phone numbers: always `<span dir="ltr">` even in Arabic mode
- Missing translations: audit all `t('key', 'fallback')` for Arabic translations
- New translation file additions from sprints 1.x and 2.x
- BiDi text: customer names in Arabic, UI labels in English — both must render correctly

#### Files to Create/Modify
- `src/i18n/locales/ar.json` — fill all missing translations from previous sprints
- `src/styles/rtl.css` — extend with any missing overrides found in audit
- Every component using directional classes (ml-, mr-, pl-, pr-, left-, right-) — audit and fix

#### Acceptance Criteria
- [ ] Switch to Arabic: every page renders correctly RTL
- [ ] No broken layouts, overlapping text, or cut-off content in RTL
- [ ] Arabic text uses Cairo/Tajawal fonts
- [ ] Numbers and phone numbers remain LTR within RTL context
- [ ] Charts render correctly (wrapped in ltr div)
- [ ] All new UI from sprints 1.x-2.x has Arabic translations
- [ ] `npm run typecheck` passes

---

### Sprint 3.5 — Lebanese Business DNA Features [PENDING]

**Track:** 3 · Lebanon DNA
**Priority:** Medium
**Depends on:** Sprint 1.4, Sprint 2.9
**Estimated effort:** Medium

#### Features to Build
**Generator Cost Tracking:**
- Pre-seeded expense category: "Generator / Private Electricity"
- Monthly/daily generator subscription (abonnement) fee entry — LBP-denominated, informal receipt
- Generator cost allocation by department/location
- Generator cost in P&L as a separate operating expense line

**Lollar vs. Fresh Dollar Accounting:**
- This is the most completely unaddressed feature in the entire Lebanese market — no software handles it
- "Lollar": pre-Oct 2019 USD deposits in Lebanese banks, effectively frozen/haircut — distinct from fresh USD
- "Fresh dollar": post-2019 USD cash, wire transfers, Whish settlements — spendable, fungible
- Tag every USD receivable/payable as: `fresh_usd` | `lollar` | `lbp`
- Cash position report shows these three buckets separately
- This single feature is a structural moat no international platform can quickly replicate

**Informal Cash Management:**
- Cash denomination tracker (how many 100k LBP, 50k LBP, $100, $50 bills in drawer)
- "Under the table" transaction recording (optional, off-book tracking for reconciliation purposes)
- Informal credit (customer owes money without formal invoice)
- Post-dated check tracking (common in Lebanese B2B)

**Ramadan Mode:**
- Tenant setting: Ramadan mode on/off
- When on: Iftar time highlighted on sales graphs, Suhoor time marker
- Restaurant: Iftar rush prep alerts based on reservation count
- Special Ramadan reporting: Iftar vs. non-Iftar revenue split

**Lebanese Tax Compliance:**
- TVA (VAT) 11% applied correctly with exemptions
- TVA report for quarterly filing
- Stamp duty tracking where applicable

---

## Track 4 — Intelligence Layer

*Goal: Zero-cost AI/ML that makes KiTS feel like a built-in consultant. Statistical algorithms + Groq free tier.*

---

### Sprint 4.1 — In-Platform ML: Demand Forecasting [PENDING]

**Track:** 4 · Intelligence Layer
**Priority:** High
**Depends on:** Sprint 1.4
**Estimated effort:** High

#### Algorithms to Implement (all pure TypeScript, zero API cost)
**Holt-Winters Triple Exponential Smoothing** — primary forecasting engine
- Handles level + trend + seasonality
- Parameters: alpha (level), beta (trend), gamma (seasonality)
- Auto-detect weekly/monthly seasonality from historical data
- 7-day and 30-day forecasts per product

**Simple Moving Average** — for new products with < 4 weeks of data

**Seasonal Decomposition** — extract weekly patterns (Mon-Sun sales differ significantly for most Lebanese businesses)

#### UI
- Forecasting dashboard (already has `Forecasting.tsx` — enhance)
- Per-product demand forecast chart (actual + predicted)
- "Expected stockout date" for each product based on forecast vs. current stock
- Recommended reorder quantities
- Holiday impact indicators (Lebanese public holidays, Ramadan)

#### Files to Modify/Create
- `src/utils/mlForecasting.ts` — Holt-Winters implementation
- `src/pages/Forecasting.tsx` — enhance with per-product drill-down
- `src/components/Forecasting.tsx` — new forecast widgets

---

### Sprint 4.2 — Anomaly Detection & Business Intelligence [PENDING]

**Track:** 4 · Intelligence Layer
**Priority:** High
**Depends on:** Sprint 4.1
**Estimated effort:** Medium

#### Anomaly Detection (IQR method, pure TS)
- Unusual sales day (revenue > Q3 + 1.5×IQR or < Q1 - 1.5×IQR)
- Inventory discrepancies (actual vs. theoretical based on sales)
- Expense category spikes
- Employee clock-in pattern changes
- Customer churn detection (customer who bought weekly hasn't appeared in 3 weeks)

#### Business Intelligence Engine
- Margin optimizer: identify products below margin threshold
- Cross-sell patterns: products frequently bought together
- ABC analysis: A (top 20% products = 80% revenue), B, C classification
- Dead stock alert: products not sold in X days with stock > 0
- Peak hours analysis per day of week

---

### Sprint 4.3 — AI Assistant (Groq/LLaMA via Edge Function) [PENDING]

**Track:** 4 · Intelligence Layer
**Priority:** Medium
**Depends on:** Sprint 4.1, Sprint 4.2
**Estimated effort:** Medium

#### Architecture
- Groq `llama-3.1-8b-instant` — free tier, fast, sufficient for business summaries
- Supabase Edge Function as proxy (keeps API key server-side, rate limiting)
- localStorage cache: AI responses cached for 1 hour to minimize API calls
- Rate limiter: max 10 Groq requests per hour per tenant (stays within free tier)

#### Features
- Daily business summary: natural language summary of today's performance
- Anomaly explanations: "Sales dropped 40% today — possible causes based on your patterns: Monday is typically slower, and you had no new customer acquisitions this week"
- Natural language query: "How much did I spend on generators last quarter?" → SQL-like query execution
- Weekly digest: emailed/WhatsApp summary generated by AI

#### Edge Function
- `supabase/functions/ai-assistant/index.ts`
- Takes: aggregated business data (never raw customer PII)
- Returns: natural language insight
- Caches response at Edge level (30 min)

---

### Sprint 4.4 — Predictive Restocking & Supplier Intelligence [PENDING]

**Track:** 4 · Intelligence Layer
**Priority:** Medium
**Depends on:** Sprint 4.1
**Estimated effort:** Medium

#### Features
- Auto-generate purchase orders based on demand forecast vs. current stock
- Lead time awareness (if supplier takes 3 days, order when 3 days of stock remain)
- Supplier performance scoring (on-time %, fill rate %, price consistency)
- Optimal order quantity (EOQ formula: minimize carrying cost + ordering cost)
- Seasonal stock-up recommendations (before Ramadan, Christmas, summer)

---

## Track 5 — Enterprise Layer

*Goal: Multi-domain investor dashboard. One view, every business.*

---

### Sprint 5.1 — Multi-Domain Investor Dashboard [PENDING]

**Track:** 5 · Enterprise Layer
**Priority:** High
**Depends on:** Sprint 1.4
**Estimated effort:** Very High

#### Goal
Build a cross-tenant, cross-industry executive dashboard for investors managing multiple businesses. One login, one screen, everything consolidated.

#### Features
- Cross-tenant P&L consolidation (aggregate revenue/expenses across all businesses)
- Per-business performance cards (each with sparkline, key KPIs, industry badge)
- Comparative analytics: which business is performing best/worst and why
- Cash position across all entities (total cash on hand, total receivables)
- Headcount and payroll cost across all entities
- Alert aggregation: all low-stock, anomaly, and overdue alerts across all businesses
- Switch into any business with one click (tenant context switch)

#### Architecture Note
This requires a super-admin context that can query across tenant boundaries. Implement via:
- `investor_groups` table linking tenants to an investor user
- RPC functions that aggregate data across grouped tenants
- Strict security: investors can only see tenants in their group

---

### Sprint 5.2 — Finance + Reports Deep Integration [PENDING]

**Track:** 5 · Enterprise Layer
**Priority:** High
**Depends on:** None (can run in parallel)
**Estimated effort:** High

#### Goal
Finance and Reports are currently separate. Integrate them so that reports are driven by financial data and finance has inline intelligence.

#### Features
- Report Builder linked directly to Finance module data
- P&L drill-down: click any line → see underlying transactions
- Budget vs. Actual inline on Finance page (not separate page)
- Financial ratios: current ratio, quick ratio, gross/net margin (auto-calculated)
- Cash flow statement (operating / investing / financing — simplified)
- Period comparison: this month vs. last month vs. same month last year
- Export package: generate full financial report package (P&L, Balance Sheet, CF) as PDF
- Finance health score: 0-100 score with plain-language explanation of what's dragging it down

---

### Sprint 5.3 — Enterprise Multi-Entity Features [PENDING]

**Track:** 5 · Enterprise Layer
**Priority:** Medium
**Depends on:** Sprint 5.1
**Estimated effort:** Very High

#### Features
- Inter-company transactions (transfer inventory between entities)
- Consolidated financial statements (IFRS for SMEs simplified)
- Branch vs. subsidiary accounting modes
- Multi-location inventory management (already has migrations — complete the UI)
- Group-level budget setting with entity allocation
- Holding company reporting package

---

## Automation Infrastructure

---

### Sprint A.1 — Groq Edge Function Proxy [PENDING]

**Track:** Automation / Infrastructure
**Priority:** High (needed by Sprint 4.3)
**Depends on:** None
**Estimated effort:** Low

#### Goal
Create the Supabase Edge Function that proxies Groq API calls server-side, keeping the API key secure and adding caching + rate limiting.

#### Implementation
```typescript
// supabase/functions/ai-assistant/index.ts
// - Receives: { prompt: string, context: Record<string, unknown> }
// - Rate limits: 10 req/hr per tenant (check in KV or DB)
// - Calls: Groq llama-3.1-8b-instant
// - Returns: { insight: string, cached: boolean }
// - Caches responses for 30 min in Supabase KV or edge memory
```

Env var: `GROQ_API_KEY` (set in Supabase Dashboard → Functions → Secrets)

---

### Sprint A.2 — Sprint Log & Monitoring Dashboard [PENDING]

**Track:** Automation / Infrastructure
**Priority:** Low
**Depends on:** None
**Estimated effort:** Low

#### Goal
Build an in-app view of the automation log so the owner can see what the agents have been building, what's completed, and what's next — without opening GitHub.

#### Implementation
- Parse `docs/MASTER_PLAN.md` via a simple utility
- Display in System Settings or a new Admin tab
- Show: completed sprints (green), in-progress (yellow), pending (grey), blocked (red)
- Link each completed sprint to its git commit

---

## Appendix: Dependency Graph

```
1.1 (Theme) ←── 1.2 (Login) 
               ←── 1.4 (Dashboard)
               ←── 1.5 (Notifications)
               ←── 3.4 (RTL)

1.3 (Nav)    ←── 2.1 (Industry System)
                     ←── 2.2 (Restaurant)
                     ←── 2.3 (Pharmacy)
                     ←── 2.4 (Supermarket)
                     ←── 2.5 (Fashion)
                     ←── 2.6 (Electronics)
                     ←── 2.7 (Mobile)

2.8 (POS)    depends on 2.1
             ←── 3.2 (Whish)
             ←── 3.3 (Offline)

4.1 (Forecast) ←── 4.2 (Anomaly) ←── 4.3 (AI) ←── 4.4 (Restock)
1.4 (Dashboard) ←── 4.1, 4.2, 4.3

5.1 (Investor) depends on 1.4
5.2 (Finance) is independent
```

---

## Progress Tracker

| Sprint | Track | Status | Completed |
|--------|-------|--------|-----------|
| 1.1 — Theme System | Polish | PENDING | — |
| 1.2 — Login Overhaul | Polish | PENDING | — |
| 1.3 — Navigation & Search | Polish | PENDING | — |
| 1.4 — 3D Dashboard | Polish | PENDING | — |
| 1.5 — Notifications | Polish | PENDING | — |
| 2.1 — Industry System | Verticals | PENDING | — |
| 2.2 — Restaurant | Verticals | PENDING | — |
| 2.3 — Pharmacy | Verticals | PENDING | — |
| 2.4 — Supermarket | Verticals | PENDING | — |
| 2.5 — Fashion | Verticals | PENDING | — |
| 2.6 — Electronics | Verticals | PENDING | — |
| 2.7 — Mobile | Verticals | PENDING | — |
| 2.8 — POS Enhancements | Verticals | PENDING | — |
| 2.9 — Employee Overhaul | Verticals | PENDING | — |
| 3.1 — Currency Algorithms | Lebanon DNA | PENDING | — |
| 3.2 — Whish Integration | Lebanon DNA | PENDING | — |
| 3.3 — Offline-First POS | Lebanon DNA | PENDING | — |
| 3.4 — Arabic RTL Coverage | Lebanon DNA | PENDING | — |
| 3.5 — Lebanese Business DNA | Lebanon DNA | PENDING | — |
| 4.1 — Demand Forecasting ML | Intelligence | PENDING | — |
| 4.2 — Anomaly Detection | Intelligence | PENDING | — |
| 4.3 — AI Assistant | Intelligence | PENDING | — |
| 4.4 — Predictive Restocking | Intelligence | PENDING | — |
| 5.1 — Investor Dashboard | Enterprise | PENDING | — |
| 5.2 — Finance+Reports Integration | Enterprise | PENDING | — |
| 5.3 — Multi-Entity Enterprise | Enterprise | PENDING | — |
| A.1 — Groq Edge Function | Infra | PENDING | — |
| A.2 — Sprint Monitor | Infra | PENDING | — |
