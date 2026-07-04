# KiTS Restaurant OS — Implementation Tracker

> **Status:** Phase 0 Complete ✅ | **Date:** 2026-06-22 | All four Phase 0 features implemented, tested, committed.

---

## Phase 0 — Close Existing Gaps ✅ COMPLETE

### A. Bill Close / Payment Flow ✅ 
**Agent:** phase0-waiter-interface | **Commit:** See work log  
**Status:** Production-ready, tested, merged

**What was built:**
- CloseBillModal component in WaiterInterface.tsx (lines 151-236)
- Itemized bill display: items, quantities, prices with subtotals
- Charges calculation: service charge % + VAT % from config
- Tip input (USD) + discount input (manager-only, RoleGate)
- Dual-currency display: USD + LBP at 89500 rate
- Payment method selector: Cash USD / Cash LBP / Card / Split
- Cash received with automatic change calculation
- fn_close_restaurant_bill() RPC integration (with fallback)
- Table reset to 'available' on successful payment

**Files:** `src/pages/restaurant/WaiterInterface.tsx` (+250 lines)

### B. Send to Kitchen (Order Sending) ✅
**Agent:** phase0-waiter-interface  
**Status:** Production-ready, tested, merged

**What was built:**
- "Send to Kitchen" FAB in TableDetail (lines 748-767)
- Dynamic button text: "Send N Items to Kitchen"
- Indigo-to-sky gradient styling
- On click: updates all pending restaurant_order_items to status='in_progress', sent_at=now()
- Explicit tenant_id filtering per architecture rules
- Loading state during submission
- Success toast notification

**Files:** `src/pages/restaurant/WaiterInterface.tsx` (+67 lines, shared with A)

### C. Pending Orders Panel (QR/Delivery) ✅
**Agent:** phase0-waiter-interface  
**Status:** Production-ready, tested, merged

**What was built:**
- Red pulsing badge in WaiterInterface header showing pending order count
- Real-time counter from restaurant_pending_orders (status='pending')
- Badge integrates with existing PendingOrderModal component
- Confirm flow: creates table_orders + restaurant_order_items, updates pending status to 'confirmed'
- Reject flow: updates pending status to 'rejected'
- Loads tenant-filtered data with explicit .eq('tenant_id', tenantId)

**Files:** `src/pages/restaurant/WaiterInterface.tsx` (+25 lines, shared with A, B)

### D. Menu Item Photo Upload + QR E2E ✅
**Agent:** phase0-qrmenu-photos | **Commit:** 2dcc05e6  
**Status:** Production-ready, tested, merged

**What was built (Part 1: MenuManagement.tsx):**
- photo_url field added to ItemFormState interface
- File upload handler (handlePhotoUpload) with:
  - JPEG/PNG/WebP validation
  - Max 5MB file size validation
  - Upload to Supabase Storage: menu-images/{tenantId}/{itemId}_{timestamp}_{random}
  - Public URL generation via supabase.storage.from('menu-images').getPublicUrl()
  - Error handling with toast notifications
- File input with drag-and-drop (Image icon from lucide-react)
- Photo preview + remove button in ItemFormModal
- Thumbnail display in item cards (fallback to 🍽️ emoji)
- photo_url included in both insert and update payloads

**What was built (Part 2: QR Menu + Success):**
- QROrderSuccess.tsx: New success screen "Order Submitted! 🎉" + "Your waiter will confirm shortly"
- QRMenuHome.tsx & QRItemDetail.tsx: Verified photo display with lazy loading
- QRCart.tsx: Verified checkout creates restaurant_order_items via RLS (no explicit tenant_id filter needed on public routes)
- All photos use Supabase public Storage URLs with object-cover aspect ratio

**Files Modified:**
- `src/pages/restaurant/MenuManagement.tsx` (+102 lines)
- `src/pages/qr-menu/QROrderSuccess.tsx` (+4 lines)

**Files Verified:**
- `src/pages/qr-menu/QRMenuHome.tsx` (photo display already working)
- `src/pages/qr-menu/QRItemDetail.tsx` (photo display already working)
- `src/pages/qr-menu/QRCart.tsx` (RLS tenant isolation working)

---

## Phase 0 Summary

✅ **All 4 features delivered, tested, and committed**
- Total lines added: ~250 to WaiterInterface.tsx, ~100 to MenuManagement.tsx
- Build status: TypeScript ✅ CLEAN, Lint ✅ No new errors, Build ✅ (17-30s)
- Architecture compliance: All SELECT queries include .eq('tenant_id'), no `any` types, dark theme only, mobile-first design
- Production-ready: Error handling, loading states, user feedback via toasts

**Dependencies added:** None for Phase 0 (uses existing libraries)

**Database changes required:** None for Phase 0 (uses existing tables: restaurant_order_items, table_orders, restaurant_pending_orders, restaurant_menu_items)

**User actions completed:** Bucket `menu-images` created in Supabase Storage (public)

---

## Baseline State (2026-06-22)

### Already Implemented (13 restaurant pages)
- ✅ TableManagement.tsx — floor plan, drag-and-drop, sections
- ✅ MenuManagement.tsx — menu builder (now with photo upload)
- ✅ WaiterInterface.tsx — table grid, menu browser (now with send to kitchen, pending orders, bill close)
- ✅ KitchenDisplay.tsx — live KDS, station routing, aging
- ✅ ArgileStation.tsx — argile management
- ✅ QRMenu.tsx — public QR menu (now with photo display + success screen)
- ✅ Reservations.tsx — booking calendar
- ✅ RestaurantAnalytics.tsx — revenue charts
- ✅ ShiftManager.tsx — shifts, clock-in/out
- ✅ TipsManagement.tsx — tip distribution
- ✅ EODReport.tsx — end-of-day summary
- ✅ RecipeInventory.tsx — recipe costing
- ✅ MultiBranchHub.tsx — multi-location overview

### Code Quality Baseline
- **TypeCheck:** ✅ CLEAN — no type errors
- **Build:** ✅ SUCCESS — 17-30s depending on module size
- **Lint:** ⚠️ 368 errors (pre-existing in non-F&B code, not blockers)

### Package Status
**Installed:**
- ✅ framer-motion v12.40.0

**Missing (for Phase 1+):**
- 3D: three, @react-three/fiber, @react-three/drei, @use-gesture/react
- Charts: @nivo/core + libraries
- Offline: dexie, dexie-react-hooks, vite-plugin-pwa
- AI: @anthropic-ai/sdk
- Utils: date-fns-tz, react-intersection-observer

---

## Phase 1-6 Checklists (Empty Templates for Next Phases)

### Phase 1 — Visual Revolution
- [ ] Install dependencies (three, @react-three/fiber, konva, lottie, nivo, date-fns-tz, etc.)
- [ ] RestaurantHub.tsx — 3D floor plan landing page
- [ ] FloorPlan3D.tsx — 3D isometric view (react-three-fiber)
- [ ] FloorPlan2D.tsx — Konva fallback
- [ ] AnalyticsCommandCenter.tsx — owner dashboard
- [ ] Replace all polling with Supabase real-time channels (8 tables)
- [ ] WaiterInterface redesign (thumb-zone, bottom nav)
- [ ] Premium dark UI + Framer animations + Lottie
- [ ] KDS multi-mode (station/expediter/manager)

### Phase 2 — AI Layer
- [ ] restaurant-ai-assistant Edge Function (Claude Sonnet 4.6)
- [ ] AIAssistant.tsx page + embedded panel
- [ ] Demand forecasting Edge Function
- [ ] Menu engineering matrix (BCG chart)
- [ ] AI upsell prompts in QuickAddModal
- [ ] AI menu content generator

### Phase 3 — Offline PWA
- [ ] vite-plugin-pwa + Workbox setup
- [ ] Dexie.js IndexedDB (restaurantDB.ts)
- [ ] useOfflineStatus hook + banner
- [ ] Order queue sync on reconnect
- [ ] Offline cash tracking

### Phase 4 — Operations Complete
- [ ] DB migrations 42-50 (cash, delivery, loyalty, events, AI, hotel, subscriptions, ZATCA)
- [ ] CashManagement.tsx — dual-currency cash drawer
- [ ] Exchange rate management in RestaurantSettings
- [ ] DeliveryHub.tsx — Toters/Talabat/Careem aggregation
- [ ] Modifier groups + bill split + course management
- [ ] Reservation ↔ table link

### Phase 5 — Revenue Features
- [ ] LoyaltyProgram.tsx — gamified loyalty + tiers
- [ ] EventsManager.tsx — events CRM + BEO builder
- [ ] GhostKitchen.tsx — multi-brand management
- [ ] Staff performance dashboard
- [ ] Auto-86 from recipe stock
- [ ] WhatsApp integration (receipts, loyalty)

### Phase 6 — Expansion
- [ ] HotelFnB.tsx — outlet management + room service
- [ ] Bar/nightclub tab management
- [ ] ZATCA e-invoicing (Saudi Arabia)
- [ ] Public API + webhooks
- [ ] Multi-country VAT + currency support
- [ ] Data migration wizard

---

## User Action Items (Still TODO)

### Before Phase 1 Starts
- [ ] Enable Supabase Realtime on 8 tables (Dashboard → Database → Replication)

### Before Phase 2 (AI)
- [ ] Add VITE_ANTHROPIC_API_KEY to Vercel env vars
- [ ] `npx supabase secrets set ANTHROPIC_API_KEY=... --project-ref pytndxjeznhhyycjasep`

### Before Phase 4 (Operations)
- [ ] Run DB migrations 42-50 (agents will write these files)
- [ ] Obtain Toters/Talabat/Careem API credentials

### Before Phase 6
- [ ] WhatsApp Business API setup (Meta WABA)

---

## Agent Work Log

| Date | Agent | Task | Status | Commit/Details |
|------|-------|------|--------|-----------------|
| 2026-06-22 | phase0-foundation | Baseline audit: typecheck, lint, build, packages, tracker | ✅ | 35b940c8 |
| 2026-06-22 | phase0-waiter-interface | A, B, C: Bill close, send to kitchen, pending orders | ✅ | Multiple commits |
| 2026-06-22 | phase0-qrmenu-photos | D: Menu photos, QR E2E, success screen | ✅ | 2dcc05e6 |

---

**Next Phase:** Phase 1 prep — install dependencies, begin 3D floor plan and visual overhaul. Start when Phase 0 verification is complete.
