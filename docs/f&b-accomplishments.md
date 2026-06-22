# KiTS Restaurant OS — Implementation Tracker

> **Updated:** 2026-06-22 | Agents write to this after completing tasks to track progress across all phases.
> **Read this before starting any work** to understand current state and what's left to do.

---

## Baseline State (2026-06-22)

### Already Implemented (13 restaurant pages from docs/f&b-plan.md)
- ✅ TableManagement.tsx — visual floor plan, drag-and-drop, sections (indoor/terrace/bar)
- ✅ MenuManagement.tsx — Menu Builder, Waiter Order tab, QR Menu tab with code generator
- ✅ WaiterInterface.tsx — table grid, menu browser, order creation
- ✅ KitchenDisplay.tsx — live KDS, station routing, ticket aging, sound alerts
- ✅ ArgileStation.tsx — argile session management, coal tracking, flavor catalog
- ✅ QRMenu.tsx — public QR menu page at `/menu/:tenantSlug`, add-to-cart flow
- ✅ Reservations.tsx — booking calendar, status management
- ✅ RestaurantAnalytics.tsx — revenue charts, live ops, waiter performance
- ✅ ShiftManager.tsx — weekly shifts, clock-in/out
- ✅ TipsManagement.tsx — tip calculation and distribution
- ✅ EODReport.tsx — end-of-day summary with print
- ✅ RecipeInventory.tsx — ingredient stock, recipe costing, waste log
- ✅ MultiBranchHub.tsx — multi-location overview

### Code Quality Baseline
- **TypeCheck:** ✅ CLEAN — no type errors
- **Build:** ✅ SUCCESS — 30.75s, all chunks generated
- **Lint:** ⚠️ 368 errors, 1346 warnings (pre-existing in non-F&B code, not blockers for F&B work)

### Package Status
**Already Installed:**
- ✅ framer-motion v12.40.0

**Missing for Phase 1-6 (to be installed):**
- 3D Floor Plan: three, @react-three/fiber, @react-three/drei, @use-gesture/react
- 2D Canvas: konva, react-konva
- Animations: lottie-react, react-countup
- Charts: @nivo/core, @nivo/line, @nivo/bar, @nivo/pie, @nivo/calendar, @nivo/stream, @nivo/sankey, @nivo/bump, @nivo/heatmap
- Offline: dexie, dexie-react-hooks, vite-plugin-pwa, workbox-window
- AI: @anthropic-ai/sdk
- Utilities: date-fns-tz, react-intersection-observer

---

## Phase 0 — Close Existing Gaps

### A. Bill Close / Payment Flow
- [ ] CloseBillModal component in WaiterInterface.tsx
- [ ] Itemized bill display with quantities and prices
- [ ] Subtotals: Food + Argile separate
- [ ] Service charge % calculation (from config)
- [ ] VAT % calculation (from config)
- [ ] Tip input (USD)
- [ ] Discount input (manager-only via RoleGate)
- [ ] Dual-currency total: USD + LBP at daily rate
- [ ] Payment method selector: Cash USD / Cash LBP / Card / Split
- [ ] Cash received input with change calculation
- [ ] fn_close_restaurant_bill() RPC call (with fallback if RPC missing)
- [ ] Table reset to 'available' on success

### B. Send to Kitchen (Order Sending)
- [ ] Send to Kitchen FAB in TableDetail
- [ ] Shows count of unsent items
- [ ] Updates restaurant_order_items: status='in_progress', sent_at=now()
- [ ] useRestaurantOrder hook updated if needed

### C. Pending Orders Panel (QR/Delivery)
- [ ] Pending orders badge in WaiterInterface header
- [ ] Load from restaurant_pending_orders where status='pending'
- [ ] Panel/drawer showing each pending order
- [ ] Confirm button: creates table_orders + restaurant_order_items, updates status to 'confirmed'
- [ ] Reject button: updates pending order status to 'rejected'

### D. Menu Item Photo Upload
- [ ] Image upload in ItemFormModal (MenuManagement.tsx)
- [ ] Upload to Supabase Storage: menu-images/{tenantId}/{itemId}
- [ ] photo_url saved to restaurant_menu_items
- [ ] Thumbnail displayed in item grid cards
- [ ] Photos shown in QR menu item cards (fallback to placeholder if missing)
- [ ] QR checkout creates restaurant_pending_orders correctly
- [ ] Success screen after QR submission: "Order Submitted! 🎉"

---

## Phase 1 — Visual Revolution

### Dependencies
- [ ] Install: three, @react-three/fiber, @react-three/drei, @use-gesture/react
- [ ] Install: konva, react-konva
- [ ] Install: lottie-react, react-countup
- [ ] Install: @nivo/core + all nivo chart libraries
- [ ] Install: date-fns-tz

### 3D Floor Plan (Hero Feature)
- [ ] RestaurantHub.tsx — new landing page (replace `/restaurant` redirect)
- [ ] FloorPlan3D.tsx — 3D isometric floor plan (react-three-fiber)
- [ ] Tables render as 3D meshes with emissive status colors
- [ ] Order badges float above occupied tables (cover count, total, time seated)
- [ ] Drag-to-reposition tables in 3D space
- [ ] Toggle: "Floor View" ↔ "Command Center"
- [ ] FloorPlan2D.tsx — Konva.js 2D fallback for low-end devices
- [ ] WebGL detection + auto-fallback

### Real-Time Supabase Channels (Replace All Polling)
- [ ] useRestaurantRealtime.ts hook
- [ ] Subscribe to: restaurant_order_items, table_orders, restaurant_pending_orders, restaurant_kds_stations, restaurant_argile_sessions, restaurant_argile_events, restaurant_slow_alerts, restaurant_tables
- [ ] Replace setInterval polling in: KitchenDisplay, WaiterInterface, ArgileStation, RestaurantAnalytics
- [ ] Enable Supabase Realtime on 8 tables (user must do via Dashboard)

### Command Center Dashboard
- [ ] AnalyticsCommandCenter.tsx — owner analytics view
- [ ] Live KPI row: Today Revenue, Covers, Avg Check, Open Tables, Pending Orders
- [ ] Revenue Calendar: Nivo ResponsiveCalendar heatmap (past 365 days)
- [ ] Revenue Stream: Nivo ResponsiveStream (food/argile/drinks over 30 days)
- [ ] Demand Forecast Panel (next 7 days, confidence bands)
- [ ] Menu Engineering Matrix (4-quadrant plot: margin vs popularity)
- [ ] Top Waiters Leaderboard (animated rank changes)
- [ ] Slow Alert Feed (real-time)
- [ ] AI Assistant Panel (embedded chat)

### Premium Dark UI + Animations
- [ ] Design tokens: base (#0a0f1e), surface (#111827), elevated (#1e2d40), border (rgba 0.08)
- [ ] Status colors: emerald (available), amber (occupied), violet (reserved), red (alert)
- [ ] Glassmorphism: backdrop-filter blur + rgba overlay on cards/modals
- [ ] Framer Motion: entrance animations, status transitions, page transitions
- [ ] Lottie animations: order-sent, bill-paid, table-cleaned, new-qr-order, offline-mode
- [ ] KPI cards: react-countup animated number changes

### KDS Multi-Mode
- [ ] Station Mode (default): full-screen KDS for one station only
- [ ] Expediter Mode: all stations side-by-side for head chef overview
- [ ] Manager Overview: condensed view of all tickets
- [ ] Ticket age colors: <5min green, 5-10 amber, 10-15 orange, >15 red + pulse
- [ ] Allergen tickets: red pulsing border for 5s on arrival

### WaiterInterface Redesign
- [ ] Thumb-zone optimized: all primary actions in bottom 40% of screen
- [ ] Top bar: restaurant name, shift, pending count badge, offline indicator (read-only)
- [ ] Main: table grid OR open order display
- [ ] Bottom nav tabs: Tables / My Orders / Send Queue / Pending QR
- [ ] FAB: "+ Add Item" (persistent, always accessible)
- [ ] Gestures: swipe left to delete item, long-press for context menu

---

## Phase 2 — AI Layer

### Dependencies
- [ ] Set VITE_ANTHROPIC_API_KEY in Vercel env + Supabase secrets (user must do)
- [ ] Install: @anthropic-ai/sdk (dev must have API key)

### AI Restaurant Assistant
- [ ] restaurant-ai-assistant Edge Function (Claude Sonnet 4.6 + function calling)
- [ ] AIAssistant.tsx page at `/restaurant/ai`
- [ ] Embedded panel in AnalyticsCommandCenter (right drawer)
- [ ] Full-screen chat interface: message history, language toggle (EN/AR)
- [ ] Voice input: Web Speech API (optional)
- [ ] Suggested prompts: "How did we do today?", "Which items to 86?", "Write me a Friday promo"
- [ ] Response rendering: markdown + inline tables/charts (Nivo sparklines)
- [ ] Capabilities: answer data questions, draft marketing copy (Arabic + English), recommend actions

### Demand Forecasting
- [ ] Forecasting Edge Function (nightly cron at 2am Beirut)
- [ ] LSTM model on per-tenant history + Lebanese holidays + Ramadan + weather
- [ ] DB table: restaurant_demand_forecasts (date, covers, revenue, confidence, factors, prep list, staffing recs)
- [ ] Analytics tab: "Forecast" — 7-day prediction with confidence bands
- [ ] Prep list: quantities by item and time slot
- [ ] Staffing recommendation: waiters / kitchen / argile needed

### Menu Engineering Matrix
- [ ] menuEngineering.ts: BCG matrix (popularity vs margin)
- [ ] Analytics tab: "Menu Matrix" — 4-quadrant plot, hover tooltips
- [ ] Star/Plowhorse/Puzzle/Dog categories with recommendations
- [ ] Export: "Download Menu Engineering Report" (PDF)

### AI Upsell Prompts
- [ ] upsellEngine.ts: Apriori association rules on transaction data
- [ ] Nightly cron: compute rules, save to restaurant_upsell_rules table
- [ ] QuickAddModal: after item added, show "Guests who order X also loved Y" banner
- [ ] Tap banner: pre-fills suggested item for quick add

### AI Menu Content Generator
- [ ] ItemFormModal: "+ Generate with AI" button
- [ ] Modal: enter item name + ingredients list
- [ ] AI generates: English description + Arabic translation
- [ ] Preview + edit before saving to database
- [ ] Also offers: "Generate promotional photo description" for social media

---

## Phase 3 — Offline PWA

### Dependencies
- [ ] Install: dexie, dexie-react-hooks, vite-plugin-pwa, workbox-window

### Service Worker + Workbox
- [ ] vite.config.ts: VitePWA plugin config
- [ ] Workbox caching strategies: StaleWhileRevalidate for menu, NetworkFirst for live data
- [ ] Asset caching: JS, CSS, images
- [ ] Background sync for order mutations during offline

### Dexie.js Local Database
- [ ] restaurantDB.ts: IndexedDB schema for offline_orders, menu_cache
- [ ] Offline order queue: INSERT to Dexie when Supabase offline
- [ ] Menu cache: cache on first load, update in background
- [ ] Sync on reconnect: replay queued inserts, resolve conflicts (server wins)

### Offline Detection + UI
- [ ] useOfflineStatus.ts hook: navigator.onLine monitoring
- [ ] Offline banner: persistent at top "🔴 OFFLINE — Orders queuing (3 pending)"
- [ ] Pending count updates live
- [ ] Auto-sync triggered on reconnect with visual feedback

### Offline Cash Tracking
- [ ] Waiters can: open table, add items, close bill (cash only) while offline
- [ ] All transactions stored locally, synced on reconnect
- [ ] Bluetooth receipt printing works offline (direct printer, no internet)

---

## Phase 4 — Operations Complete

### Database Migrations (user must run in Supabase SQL Editor)
- [ ] Migration 42: restaurant_3d_floor (table_shape, zone_color, 3D metadata)
- [ ] Migration 43: restaurant_cash (cash_sessions, cash_entries, daily_rates)
- [ ] Migration 44: restaurant_delivery (delivery_orders, virtual_brands, fn_create_delivery_order)
- [ ] Migration 45: restaurant_loyalty (programs, members, transactions, challenges)
- [ ] Migration 46: restaurant_events (events, BEOs, packages)
- [ ] Migration 47: restaurant_ai (AI queries, forecasts, upsell rules, menu engineering cache)
- [ ] Migration 48: restaurant_hotel (outlets, room_number, tabs for bar mode)
- [ ] Migration 49: restaurant_subscriptions (trial, referral, founding member tracking)
- [ ] Migration 50: restaurant_zatca (e-invoicing for Saudi Arabia)

### Dual-Currency Cash Drawer System
- [ ] CashManagement.tsx page at `/restaurant/cash`
- [ ] Open shift: enter opening balance in USD + LBP
- [ ] Real-time running total as sales come in
- [ ] Denomination breakdown: exact bills on hand (5x $100, 12x $20, etc.)
- [ ] LBP to USD reconciliation at end of shift
- [ ] Print shift report
- [ ] Over/short detection with alert

### Exchange Rate Management
- [ ] RestaurantSettings.tsx: "Exchange Rates" section
- [ ] Daily rate input: "Today's USD:LBP rate" (editable by manager)
- [ ] Rate history log (last 30 days)
- [ ] Auto-update from API (lirarate.org or similar)
- [ ] Rate change impact preview: how it affects menu LBP prices
- [ ] Stock revaluation: existing inventory revalued on rate change, COGS recalculated

### Delivery Aggregation Hub
- [ ] Toters webhook receiver Edge Function
- [ ] Talabat Connect API integration Edge Function
- [ ] Careem Food API integration Edge Function
- [ ] DeliveryHub.tsx page at `/restaurant/delivery`
- [ ] Three panels: Incoming orders (by platform, colored), Active deliveries, Platform analytics
- [ ] Accept/Reject buttons on delivery cards
- [ ] Revenue and metrics per platform (last 30 days)

### Advanced Order Features
- [ ] Modifier groups in QuickAddModal (required + optional)
- [ ] BillSplitModal: equal split / by amount / by item
- [ ] Course management: items tagged (appetizer/main/dessert/drinks)
- [ ] Fire Course button: send all mains to KDS simultaneously
- [ ] Reservation → Table order link: seated reservation creates table_orders with covers

---

## Phase 5 — Revenue Features

### Loyalty Ecosystem
- [ ] DB migration 45: loyalty tables (programs, members, transactions, challenges)
- [ ] LoyaltyProgram.tsx page at `/restaurant/loyalty`
- [ ] Member list with tier badges, visit count, points balance
- [ ] Challenge builder: gamified challenges (visit streaks, spend targets, item orders, referrals)
- [ ] Tier configuration: Bronze/Silver/Gold/VIP with perks
- [ ] Points redemption log
- [ ] Waiter-side: "Add to loyalty" button on bill close
- [ ] Phone lookup → show member card (tier, points, perks)
- [ ] Auto-apply earned points after payment
- [ ] QR-based enrollment: scan → name + phone → enrolled
- [ ] AI-generated personalized offers

### Events Module (Add-on: $49/mo)
- [ ] DB migration 46: events, BEOs, packages
- [ ] EventsManager.tsx page at `/restaurant/events` (FeatureGate: Events add-on)
- [ ] Events calendar (month view)
- [ ] Event pipeline Kanban: Inquiry → Proposal → Confirmed → Deposit Paid → Completed
- [ ] Proposal builder: select date/covers/section → choose menu packages → PDF proposal with pricing
- [ ] BEO (Banquet Event Order): structured day-of document with timeline, staff, setup, menu
- [ ] Event P&L: revenue vs food cost + labor + venue
- [ ] Client CRM: past events, total spend, preferences

### Ghost Kitchen Module
- [ ] GhostKitchen.tsx page
- [ ] Virtual brand management: separate name, logo, cuisine, pricing
- [ ] Each brand has own menu subset
- [ ] KDS integration: brand logo on tickets, brand-level filtering
- [ ] Per-brand P&L and analytics
- [ ] Compare efficiency metrics across brands

### Staff Performance Dashboard
- [ ] Analytics → "Team" tab
- [ ] Waiter leaderboard: avg check, covers served, tip earned, upsell rate, customer rating
- [ ] Sortable by any metric, period selector (Today / Week / Month)
- [ ] Trend arrows vs previous period
- [ ] Share: export team performance PDF
- [ ] Kitchen performance: avg ticket time per station, throughput, waste per cook

### Advanced Features
- [ ] Auto-86 from recipe stock: ingredient stock < 0 → mark menu items as 86'd
- [ ] Trigger: ingredient movement, auto-update menu items
- [ ] WhatsApp integration: receipts, loyalty, promotions via WhatsApp Business API
- [ ] Edge Function: whatsapp-restaurant for outbound messages

---

## Phase 6 — Expansion & Specialized Verticals

### Hotel F&B Module
- [ ] HotelFnB.tsx page (Coming Soon placeholder first)
- [ ] Outlet management: Main Restaurant, Bar, Rooftop, Pool, Room Service, Minibar
- [ ] Each outlet: separate floor plan, menu, KDS, staff
- [ ] Consolidated cross-outlet reporting
- [ ] Room service: order takes room_number, auto-prints in kitchen + room delivery
- [ ] Optional: PMS (Property Management System) sync for guest name autofill

### Bar & Nightclub Module
- [ ] Bar mode in WaiterInterface
- [ ] Tab management: customer opens tab (running credit)
- [ ] Bottle service tracking: bottle type, opener fee, mixer tracking
- [ ] Round ordering: quick repeat of last round
- [ ] Late checkout: EOD at 5am instead of midnight
- [ ] Age verification notes (UI reminder, not enforcement)

### ZATCA Compliance (Saudi Arabia)
- [ ] DB migration 50: restaurant_zatca_invoices
- [ ] For SA tenants: all table_orders generate ZATCA-compliant e-invoice (XML + QR)
- [ ] Automatic submission after bill close
- [ ] Receipt shows QR code with invoice hash per ZATCA Phase 2

### Public API + Webhooks
- [ ] APIManagement.tsx page at `/restaurant/settings/api`
- [ ] API key management interface
- [ ] Webhook configuration for: order.created, order.sent_to_kitchen, order.closed, delivery.order_received, loyalty.points_earned, reservation.created
- [ ] Webhook delivery history + retry logic
- [ ] Role gate: Enterprise plan only

### International Expansion
- [ ] Multi-country VAT support: LB (11%), AE (5%), SA (15%), KW (0%), EG (14%), JO (16%)
- [ ] Multi-currency: USD, LBP, AED, SAR, KWD, EGP, JOD
- [ ] Timezone handling: date-fns-tz for Beirut, Dubai, Riyadh, Cairo, etc.
- [ ] RTL layout: full Arabic UI support
- [ ] Ramadan calendar integration: yearly periods pre-loaded
- [ ] Arabic dialects: support Lebanese, Gulf, Egyptian Arabic in AI assistant

### Data Migration Wizard
- [ ] Menu import: CSV (category, item name EN, name AR, price USD, allergens)
- [ ] Supplier import: CSV (name, items)
- [ ] Historical sales import: CSV from legacy POS
- [ ] Staff import: CSV (name, role, daily rate)
- [ ] Zero-friction migration: up and running in < 2 hours
- [ ] Run old system + new system in parallel for 2 weeks with no data loss

---

## User Action Items (Cannot Be Done By Agents)

### Immediate (BLOCKING Phase 0)
- [ ] **Create Supabase Storage bucket** `menu-images` (public)
  - Dashboard → Storage → New bucket → name: `menu-images` → Public: ON

### Before Phase 1 Starts
- [ ] **Enable Supabase Realtime** on 8 tables
  - Dashboard → Database → Replication → toggle ON for:
    - restaurant_order_items
    - table_orders
    - restaurant_pending_orders
    - restaurant_kds_stations
    - restaurant_argile_sessions
    - restaurant_argile_events
    - restaurant_slow_alerts
    - restaurant_tables

### Before Phase 2 (AI Layer)
- [ ] Add `VITE_ANTHROPIC_API_KEY` to Vercel Environment Variables
- [ ] Run: `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref pytndxjeznhhyycjasep`

### Before Phase 4 (Operations)
- [ ] Run DB migrations 42-50 in Supabase SQL Editor (files generated by agents in supabase/migrations/)
- [ ] Obtain Toters Business webhook/API credentials
- [ ] Obtain Talabat Connect API credentials
- [ ] Obtain Careem Food API credentials

### Before Phase 6 (Expansion)
- [ ] WhatsApp Business API: setup WABA account via Meta Business Manager

---

## Agent Work Log

| Date | Agent | Task | Status | Details |
|------|-------|------|--------|---------|
| 2026-06-22 | foundation-audit | Baseline: typecheck, lint, build, package audit | ✅ | Typecheck ✅, Build ✅ (30.75s), Lint ⚠️ (pre-existing), framer-motion only installed |
| 2026-06-22 | phase0-waiter-interface | Send to Kitchen + Pending Orders + Bill Close | ⏳ | In progress |
| 2026-06-22 | phase0-qrmenu-photos | Menu photos + QR E2E | ⏳ | In progress |

---

**Next:** Phase 0 implementation agents will check in when complete. Phase 1 prep (install dependencies) begins after Phase 0 closes all 4 gaps.
