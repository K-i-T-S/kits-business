# KiTS F&B Vertical — Feature Inventory & Competitive Gap Analysis

**Prepared for:** KiTS internal product roadmap (F&B/restaurant vertical, Kits Business Terminal)
**Date:** 2026-07-05
**Scope:** Restaurant/F&B-specific features only (excludes generic POS/retail/pharmacy verticals except where shared)

---

## Executive Summary

We audited the actual F&B codebase (migrations, pages, components, edge functions, and the two most recent cleanup commits) against a researched baseline of the two named Lebanese competitors. **Omega Software (O-Live)** is a real, well-documented ~30-year incumbent and is confirmed as the primary market baseline. **"BAMBOO" does not exist as a Lebanese F&B POS company** — extensive research found no company or product by that name operating in this market. Per your direction, we substitute **BIM POS (Masterdine)**, a verified Beirut-based competitor (est. 2008), as the working second baseline; the "90% combined market share" figure has no independent evidentiary support and should not be repeated as fact.

The F&B vertical is substantial — 20 dedicated pages, ~25,000 lines of restaurant-specific code, 19 migrations, and coverage across POS, floor management, KDS, recipes/inventory, staff, CRM, multi-branch, cash management, and AI. Three findings matter most:

1. **A confirmed competitive gap**: Omega explicitly markets "table transfer" — we do not have this. This is the highest-priority build.
2. **A correctness bug, not a gap**: the delivery-aggregator webhook receiver was deleted in last week's cleanup, but the UI still generates and displays a webhook URL for Toters/Talabat/Zomato/Careem — pointing at a dead endpoint. This needs fixing before it's a feature gap conversation.
3. **Three "AI" panels are decorative**: demand forecasting, menu engineering matrix, and automated upsell rules all have live UI reading from database tables that nothing writes to anymore (their compute edge functions were deleted as "unwired" in the same cleanup). Cheapest possible wins — the scaffolding already exists.

Your two named examples — **customer/waiter table transfer** and **preset order bundles (prix-fixe)** — are both real, both currently absent from our platform, and neither is confirmed present in Omega's or BIM POS's public documentation either (waiter transfer and bundles specifically). That makes bundles a genuine white-space opportunity, not just catch-up.

---

## Part 1 — Verified Feature Inventory: What KiTS Has Built

Methodology: every entry below was confirmed by reading migrations, component code, `App.tsx` routing, and edge function source — not inferred from file names. Status key:
- ✅ **Wired** — UI, data model, and (where relevant) backend logic all connect end-to-end
- 🟡 **Partial** — exists but with a caveat (see note)
- ⚠️ **Broken/orphaned** — UI and data model exist, but the logic that should populate/serve them was removed
- ❌ **Absent** — searched for specifically, confirmed not present

### 1.1 Core POS / Checkout
| Feature | Status | Evidence |
|---|---|---|
| Order entry, cart, course tracking (appetizers/mains/desserts) | ✅ | `WaiterInterface.tsx` (2,611 lines), `table_orders.current_course` |
| Split billing (even, by-seat) | ✅ | `BillSplitModal.tsx`, `BillSplitter.tsx` |
| Checkout / close-bill flow incl. modifiers + argile | ✅ | `CloseBillModal.tsx`, patched by migration `000045_fn_close_bill_patch.sql` |
| Multiple payment types (cash/card/bank transfer) | ✅ | `WaiterInterface.tsx:926` |
| Direct vs. waiter-confirm order flow (for QR/customer self-order) | ✅ | `table_orders.order_flow`, `restaurant_settings.default_order_flow` |
| Customer-can-pay vs. waiter-only payment mode | ✅ | `table_orders.payment_mode` |

### 1.2 Table & Floor Management
| Feature | Status | Evidence |
|---|---|---|
| Interactive floor plan (drag-drop, 2D) | ✅ | `FloorPlan.tsx`, `TableManagement.tsx:212 handleMoveTable` |
| 3D floor plan view | ✅ | `FloorPlan3D.tsx`, `Table3D.tsx` (245 lines) — **ahead of both competitors**, neither documents 3D |
| Table status (available/occupied/reserved/cleaning) | ✅ | `restaurant_tables.status`, `TableManagement.tsx:218 handleStatusChange` |
| Table assigned to a waiter at order creation | 🟡 | `table_orders.waiter_id` column exists; **write-once at creation, read-only thereafter** — used only for tip/turnaround analytics (`RestaurantAnalytics.tsx:1102`), never updated |
| **Customer table transfer** (move an active order to a different table) | ❌ | No UI action or Supabase call updates `table_orders.table_id` anywhere in the codebase |
| **Waiter/staff table transfer** (reassign table ownership between staff) | ❌ | `waiter_id` is never written after order creation — confirmed via grep, no reassignment path exists |
| Table merge / split | ❌ | Not found |
| Waitlist management + guest notification | ❌ | Not found anywhere in repo |

### 1.3 Menu Management
| Feature | Status | Evidence |
|---|---|---|
| Menu categories/items, bilingual (name/name_ar, description/description_ar) | ✅ | `restaurant_menu_categories`, `restaurant_menu_items` |
| Daypart availability (breakfast/lunch/dinner/allday) | ✅ | `active_breakfast/lunch/dinner/allday` columns |
| Modifier groups (min/max selections, required flag) | ✅ | `restaurant_modifier_groups`, `restaurant_modifiers`, `MenuEditor.tsx` |
| Per-branch menu/pricing overrides | ✅ | `restaurant_branch_overrides`, migration `000044` |
| Chef's pick / featured / 86'd (out-of-stock) flags | ✅ | `restaurant_menu_items` columns |
| Menu engineering matrix (stars/dogs/plow-horses/puzzles) | ⚠️ | UI exists (`MenuEngineeringMatrix.tsx`, `useMenuEngineering.ts` → `restaurant_menu_engineering_cache`) but the `restaurant-menu-engineering` edge function that computed this was **deleted** in commit `0ba94338` — table is never written to |
| **Preset order bundles / prix-fixe multi-course packages** | ✅ *(built 2026-07-08, see Progress Tracker below — was ❌ at time of original research)* | `restaurant_bundles`/`restaurant_bundle_courses`/`restaurant_bundle_course_items`, migration `000062` |

### 1.4 Kitchen Operations
| Feature | Status | Evidence |
|---|---|---|
| Multi-station Kitchen Display System | ✅ | `KitchenDisplay.tsx` (1,084 lines), `restaurant_kds_stations`, `restaurant_item_stations` |
| Slow-ticket / delayed-item alerts | ✅ | `restaurant_slow_alerts`, `SlowServiceAlertBadge.tsx` — **matches Omega's documented KDS depth** |
| Bilingual KDS tickets | 🟡 | Menu items carry `name_ar`; not independently confirmed the KDS view itself toggles language |

### 1.5 Inventory, Recipes & Procurement
| Feature | Status | Evidence |
|---|---|---|
| Ingredient master + suppliers | ✅ | `restaurant_ingredients`, `restaurant_ingredient_suppliers` |
| Stock movements ledger | ✅ | `restaurant_ingredient_movements` |
| Recipe BOM linked to menu items (fractional deduction) | ✅ | `restaurant_recipes`, `restaurant_recipe_ingredients`, `restaurant_menu_item_recipes` |
| Waste logging | ✅ | `restaurant_waste_log` |
| Purchase orders + line items | ✅ | `restaurant_purchase_orders`, `restaurant_purchase_order_items` (migration `000049`, most recent) |
| Supplier management UI | ✅ | `SupplierManagement.tsx` |
| Stock transfers between locations | ✅ | `StockTransferManagement.tsx` |
| Auto-generated POs on low-stock threshold | ❔ | Not verified in this pass — recommend a follow-up check on `PurchaseOrderManagement.tsx` before assuming built or absent |
| Demand forecasting | ⚠️ | UI + `restaurant_demand_forecasts` table exist; `restaurant-demand-forecast` edge function **deleted** — dead pipeline |

### 1.6 Staff / HR / Shifts
| Feature | Status | Evidence |
|---|---|---|
| Shift scheduling + assignments | ✅ | `ShiftManager.tsx`, `restaurant_shifts`, `restaurant_shift_assignments` |
| Tip pooling/tracking | ✅ | `TipsManagement.tsx`, tied to `waiter_id` analytics |
| 8-role RBAC (owner/manager/cashier/viewer + admin/supervisor/accountant/stockkeeper) | ✅ | Migration `000021_roles_and_custom_roles.sql` |
| Custom roles | ✅ | `custom_roles` table |

### 1.7 CRM / Loyalty
| Feature | Status | Evidence |
|---|---|---|
| Points-based loyalty (Bronze/Silver/Gold) | ✅ | `LoyaltyModal.tsx`, `LoyaltyPanel.tsx`, `customer_points`, migration `000026_loyalty_points.sql` |
| CRM analytics | ✅ | `CRMAnalytics.tsx` |
| Marketing campaigns | ✅ | `campaigns` table, migration `000027` |
| Automated workflows (trigger-based) | ✅ | `automated_workflows` table, `trigger-workflows` edge function |
| Allergy/preference guest profiling | ❔ | Not verified this pass |

### 1.8 Multi-Branch & Analytics
| Feature | Status | Evidence |
|---|---|---|
| Branch management, cross-branch metrics | ✅ | `MultiBranchHub.tsx` (1,223 lines), `restaurant_branches`, `restaurant_branch_metrics` |
| Centralized menu/pricing push to branches | ✅ | Via `restaurant_branch_overrides` |
| Revenue/tip/turnaround analytics | ✅ | `RestaurantAnalytics.tsx` (1,861 lines) |
| Analytics command center | ✅ | `AnalyticsCommandCenter.tsx` |
| End-of-day reports | ✅ | `EODReport.tsx`, `restaurant_eod_reports` |
| Automated upsell suggestions | ⚠️ | UI + `restaurant_upsell_rules` table exist; `restaurant-upsell-compute` edge function **deleted** — dead pipeline |

### 1.9 Financial / Cash Management
| Feature | Status | Evidence |
|---|---|---|
| Cash drawer sessions + movements | ✅ | `CashDrawer.tsx`, `CashManagement.tsx`, `restaurant_cash_sessions`, `restaurant_cash_movements` |
| General expense tracking (categories, budgets, payroll) | ✅ | Migration `000028_finance.sql` (platform-wide, usable by F&B) |

### 1.10 Localization (Lebanese/MENA)
| Feature | Status | Evidence |
|---|---|---|
| Bilingual menu content (Arabic fields) | ✅ | `name_ar`/`description_ar` on menu tables |
| Multi-currency / VAT infrastructure | ✅ | Migration `000025_tax_and_currency.sql` (platform-wide) |
| Arabic RTL UI | 🟡 | Documented in `CLAUDE.md` as "partially complete" — not re-verified this pass |

### 1.11 AI / Integrations
| Feature | Status | Evidence |
|---|---|---|
| AI restaurant assistant (chat) | ✅ | `AIAssistant.tsx`, `restaurant-ai-assistant` edge function, `restaurant_ai_queries` (chat history) |
| AI content generation (descriptions, etc.) | ✅ | `AIContentGeneratorModal.tsx` → `restaurant-ai-assistant` |
| AI insights (Groq) in Hub/Analytics | ✅ | `RestaurantHub.tsx:530`, `RestaurantAnalytics.tsx:954` → `groq-proxy` (Groq, not Anthropic — per platform convention) |
| Demand forecasting, menu engineering, auto-upsell | ⚠️ | See above — all three are dead pipelines post-cleanup |
| WhatsApp receipts | ✅ | `whatsapp-receipt` edge function, called from POS post-sale |
| WhatsApp inbound CRM/reservation intake | ❌ | Not found — current WhatsApp usage is outbound receipts only |

### 1.12 Events & Reservations
| Feature | Status | Evidence |
|---|---|---|
| Events/banquet management | ✅ | `EventsManager.tsx` (806 lines), `restaurant_events` |
| Reservations (pending/confirmed/seated/completed/no_show/cancelled) | ✅ | `Reservations.tsx`, `BookReservation.tsx`, `reservations` table |
| Waitlist status + SMS/notification | ❌ | No "waitlisted" status exists; no notification pipeline found |

### 1.13 Delivery / Aggregators
| Feature | Status | Evidence |
|---|---|---|
| Config UI: enable Talabat/Toters/Zomato/Careem Food, webhook secret | ✅ (UI only) | `DeliveryIntegrations.tsx` |
| **Live webhook receiver for aggregator orders** | ⚠️ **BROKEN** | UI at `DeliveryIntegrations.tsx:117` generates and displays a live webhook URL pointing to the `delivery-webhook` edge function — **which was deleted** in commit `e4adf8bf` as an "unused stub." A restaurant that pastes this URL into Toters/Talabat today gets a 404. **This is a correctness bug, fix before anything else in this section.** |

### 1.14 Lebanon-Specific Differentiator (already built)
| Feature | Status | Evidence |
|---|---|---|
| Argile (shisha) session tracking, flavors, events | ✅ | `ArgileStation.tsx` (896 lines), `restaurant_argile_sessions/events/flavors` — neither Omega nor BIM POS documents anything like this publicly |

---

## Part 2 — Competitive Baseline: Omega & BIM POS (Verified)

Full sourced research (per-platform breakdown, citations, comparison table) is preserved at `/tmp/claude-1000/-home-casio699-KiTS-kits-business/5c3d4ca9-dfa9-4253-8b6f-9b1a76cff33b/scratchpad/lebanon-pos-gap-analysis.md`. Key points relevant to gap analysis:

- **Omega Software (O-Live)**, Jdeideh, Lebanon, ~1994. Confirmed: split billing, **customer table transfer** (direct vendor quote), real-time floor status, KDS, multi-branch, loyalty (O-Club), offline mode, reservations. **Not found/unverified**: waiter reassignment, combo/prix-fixe pricing, named Toters/Talabat integration, dual USD/LBP display, MoF/VAT compliance depth, recipe costing depth. "78% market share" is unsourced marketing copy.
- **BIM POS (Masterdine)**, Dora, Lebanon, est. 2008. Confirmed: table management (category-level only), KDS/KMS, recipe depletion, staff time/attendance + mini payroll, loyalty/complaint routing, multi-branch. **Not found**: table transfer or waiter reassignment (either sub-feature), combo pricing, multi-currency, VAT, offline mode, named aggregator integration.
- **Neither competitor publicly documents**: waiter/staff table reassignment, or combo/prix-fixe bundle pricing. This means your two example features sit in different categories — table transfer is **confirmed table-stakes** (Omega has it, we don't); waiter transfer and bundles are **unconfirmed as competitor baseline but real operational/product value** — building them is differentiation, not just catch-up.
- **"90% combined market share"**: no independent evidence found (no primary research, industry body, or press citation). Treat as an internal/anecdotal estimate needing your own sourcing if it's going to appear in anything client- or investor-facing.

---

## Part 3 — Gap Analysis & Build Priorities

### Tier 0 — Fix Immediately (bugs, not gaps)
1. **Delivery webhook receiver is dead** — `DeliveryIntegrations.tsx` shows a live URL for a deleted edge function. Either rebuild a minimal `delivery-webhook` receiver or remove/hide the webhook-URL UI until it's rebuilt, so no restaurant configures a broken integration.
2. **Three AI panels are decorative** — demand forecasting, menu engineering matrix, and auto-upsell rules all have working UI and schema but no compute pipeline (functions deleted as "unwired"). Cheapest possible wins: the scaffolding (tables, hooks, UI) is 100% intact — only the compute logic needs rebuilding (route through Groq per your existing AI convention, not Anthropic).

### Tier 1 — Market Baseline (confirmed or reasonably expected minimum)
1. **Customer table transfer** — confirmed present in Omega, absent in ours. Highest priority.
2. **Waiter/staff table transfer** — not proven as competitor baseline, but a real operational gap (shift handoffs, section swaps) you specifically flagged. `waiter_id` column already exists on `table_orders` — this is a UI + one RPC away, not a schema change.
3. **Waitlist management with guest notification** — absent from our platform; not confirmed for either named competitor but is standard in the category (Toast, Lightspeed, etc.) and expected by Lebanese diners at any table-service restaurant with a queue.
4. **Real delivery aggregator integration** (once Tier 0 fix lands) — neither competitor has a *confirmed* named Toters/Talabat integration either, but "config UI that points at a dead endpoint" is below even an unverified baseline. Build a real, working webhook receiver + order intake.

### Tier 2 — Operational Elevators (build next, clear differentiation)
1. **Preset order bundles / prix-fixe multi-course packages** — confirmed absent in our platform AND unconfirmed in both competitors' public materials. This is genuine white space matching your example exactly: a bundle of appetizer+main+dessert+drink priced as a unit, with quantity auto-multiplied by guest count entered at order time.
2. **Restore the three AI compute pipelines** (see Tier 0) — once fixed, this alone puts us ahead of both competitors, neither of which documents AI-driven demand forecasting or menu engineering.
3. **Table merge/split** — not covered by either the current build or confirmed competitor docs; common request during walk-in rushes (combining two 2-tops for a party of 4).
4. **Verify/complete auto-generated purchase orders** on low-stock threshold — infrastructure (`restaurant_purchase_orders`, `SupplierManagement.tsx`) exists; confirm the auto-trigger logic is actually wired before assuming this is done.

### Tier 3 — Disruptors (from your original brief, cross-checked against what exists)
| Idea | Status in our platform |
|---|---|
| WhatsApp CRM sync (inbound reservations/leads) | We have outbound WhatsApp receipts only (`whatsapp-receipt`). Inbound CRM pipeline not built. |
| Automated expiration markdowns (time-based discounting) | Not found in F&B; expiry *tracking* exists in the supermarket vertical (migration `000033`) but no F&B markdown automation. |
| AI smart cart / upsell prediction | Table + hook exist, pipeline dead (Tier 0 fix restores the foundation for this). |
| Fleet dispatch / COD wallet reconciliation | Not found — `DeliveryIntegrations.tsx` is config-only, no driver-routing logic. |
| RFID/biometric staff login, scale integration | No hardware integration layer found anywhere in the codebase. Low near-term priority — no Lebanese POS competitor documents this either, so it's not a market gap, purely a moonshot differentiator. |
| Digital post-payment feedback kiosks | We have `restaurant_table_feedback` / `TableFeedback.tsx` (found during audit, not in original ask) — worth confirming scope before assuming this needs to be built from scratch. |

---

## Progress Tracker (Updated 2026-07-10)

**Tier 0 — Fix Immediately: complete.**
1. Delivery webhook receiver rebuilt (`delivery-webhook` edge function) — done.
2. Three AI compute pipelines restored (`restaurant-demand-forecast`, `restaurant-menu-engineering`, `restaurant-upsell-compute`, nightly `pg_cron` automation) — done.

**Tier 1 — Market Baseline: complete.**
1. Customer table transfer — done (`fn_transfer_table_order` RPC, `TableTransferModal.tsx`).
2. Waiter/staff table transfer — done (same RPC/modal, `p_new_waiter_id`).
3. Waitlist management with guest notification — done (`restaurant_waitlist` table, `fn_seat_waitlist_party` RPC, `Waitlist.tsx`, `wa.me` deep-link notification).
4. Real delivery aggregator integration — done (`qr_place_order`-adjacent flow: `accept_delivery_order`/`reject_delivery_order`/`complete_delivery_order` RPCs, `DeliveryOrders.tsx` queue page).

**Bonus, not originally scoped — Order Item Integrity fixes: complete.**
While scoping Tier 2 work, a full audit of every order-item creation site surfaced two further defects, now fixed:
- Recipe-ingredient deduction (`deduct_recipe_ingredients` RPC, `useRecipeDeduction` hook) was fully built but never called from `KitchenDisplay.tsx` — now wired into all three "item became ready" handlers, with double-click guards.
- The customer-facing QR self-ordering feature (`QRCart.tsx`) was confirmed non-functional for real anonymous customers (RLS silently rejected every write) — replaced with a new `qr_place_order` RPC that also respects the tenant's configured Order Flow setting (previously silently ignored) and resolves all pricing server-side (closing a price-tampering vector).

**Tier 2 — Operational Elevators: partially complete.**
1. Preset order bundles — **done** (migration `20260708_000062_preset_order_bundles.sql`; spec at `docs/superpowers/specs/2026-07-08-preset-order-bundles-design.md`, plan at `docs/superpowers/plans/2026-07-08-preset-order-bundles.md`). Full staff CRUD (Bundles tab in `MenuManagement.tsx`) + staff ordering (`BundleOrderModal` in `WaiterInterface.tsx`) + QR customer self-service ordering (`QRBundleDetail.tsx`, wired into the QR cart/checkout) — QR ordering was originally scoped as a follow-up decision and was confirmed in-scope before build. Architecture: per-course guest choice (not a fixed set), one shared choice × party size (not per-guest customization), priced via a zero-priced-component + single bundle-charge-line pattern tagged with a `bundle_id`, so both bundle-level sales analytics and per-dish inventory consumption are tracked correctly. Built via subagent-driven-development (9 tasks, each independently reviewed) plus a final whole-branch review — caught and fixed one NULL-comparison auth-bypass in `add_bundle_to_order` during review (the same bug class was separately found and fixed in two unrelated, already-live functions, `fn_transfer_table_order`/`fn_seat_waitlist_party`, migration `20260709_000063`).
2. Restore AI compute pipelines — done (see Tier 0 above; original roadmap doc double-listed this under both tiers).
3. Table merge/split — **done** (2026-07-10). Merge was already covered by Tier 1.1/1.2's `fn_transfer_table_order`. Split added via `fn_split_table_order` RPC + `SplitTableModal.tsx`, wired into both `TableManagement.tsx` and `WaiterInterface.tsx`. Spec: `docs/superpowers/specs/2026-07-10-split-table-order-design.md`, plan: `docs/superpowers/plans/2026-07-10-split-table-order.md`. Built via subagent-driven-development; final whole-plan review caught a cross-task integration bug (served-status items were invisible to the split modal, silently blocking any partially-served bundle from being split) — fixed and re-verified.
4. Verify/complete auto-generated purchase orders — **done** (2026-07-10). An earlier automated investigation incorrectly concluded no generation logic existed anywhere — it missed `RecipeInventory.tsx`'s existing manual "Auto-Create PO" button, which already computed shortages but dumped them into one PO with no supplier. Added a shared SQL engine (`fn_generate_low_stock_pos_for_tenant`) that groups by supplier and excludes ingredients already on an open PO, a public RPC the manual button now calls, and a new unattended nightly `pg_cron` sweep (`nightly-low-stock-po-generation`, 05:00 UTC) across every active tenant. Spec: `docs/superpowers/specs/2026-07-10-auto-low-stock-purchase-orders-design.md`, plan: `docs/superpowers/plans/2026-07-10-auto-low-stock-purchase-orders.md`.

**Tier 2 is now fully complete.**

**Tier 3 — Disruptors: assessed 2026-07-10, still not started except where noted.** Full original list re-evaluated against current codebase state before deciding what (if anything) to build next:

| # | Item | Actual state (verified 2026-07-10) | Est. effort | Importance | Decision |
|---|---|---|---|---|---|
| 3 | AI smart cart / upsell prediction | **Done (2026-07-10).** Root cause was a live bug, not missing work: `useUpsellRules.ts` cast raw snake_case Supabase rows directly to a camelCase `UpsellRule` interface with no field mapping, so the staff-side banner in `WaiterInterface.tsx` had never once rendered in production. Fixed, and the same (now-tested, shared) selection logic extended to the QR customer cart via an `upsell_rules` addition to `get_public_menu()`. Spec: `docs/superpowers/specs/2026-07-10-qr-menu-upsell-and-feedback-design.md`, plan: `docs/superpowers/plans/2026-07-10-qr-menu-upsell-and-feedback.md`. Final review caught one cross-cutting risk — an unguarded array read that would crash the whole QR menu if the frontend ever deployed ahead of its migration (this repo deploys frontend automatically on push but applies migrations manually) — fixed and verified. | Small | High | Done |
| 6 | Digital post-payment feedback kiosk | **Done (2026-07-10), scoped to self-service discoverability.** `TableFeedback.tsx` was already a complete, working rating/comment form — the only gap was that nothing in the QR menu itself pointed to it (only a staff-shared link existed). Added a "Rate Your Visit" link to the QR menu footer. Auto-detecting bill closure to auto-transition the page (the fuller "kiosk" interpretation) was explicitly considered and deferred — would require either a new anonymous-readable RLS surface on `table_orders` or a polling RPC, disproportionate risk for a mostly-cosmetic gain. See the design spec's Non-goals for the full reasoning if this gets revisited. | Small | Low-medium | Done |
| 2 | Automated expiration markdowns (time-based discounting) | Genuinely not started for F&B. Expiry *tracking* exists in the supermarket vertical (migration `000033`) as a pattern to borrow from; no markdown-pricing automation exists for restaurant ingredients or menu items. | Medium — comparable scope to the auto-PO build above, no external blockers | Low-medium — more of a retail/bakery pattern than a core F&B gap | Deferred |
| 1 | WhatsApp inbound CRM sync (reservations/leads) | Genuinely not started. Current WhatsApp usage is outbound receipts only (`whatsapp-receipt` edge function). Would need a webhook receiver, AI-based inbound message parsing, and Meta WhatsApp Business API app review — the last one is a **calendar-time blocker outside engineering's control** (can take days to weeks), not something more agent time solves. | Large, plus an external approval wait | Medium — real differentiator, not urgent | Deferred |
| 4 | Fleet dispatch / COD wallet reconciliation | Genuinely not started. `DeliveryIntegrations.tsx` is config-only; no driver-routing, live-GPS, or cash-reconciliation logic anywhere. This is realistically its own product surface (driver app, route optimization, accounting), not an incremental add. | Very large — a separate multi-week initiative | Low near-term | Deferred |
| 5 | RFID/biometric staff login, kitchen scale integration | Not found anywhere — no hardware integration layer exists in the codebase at all. Blocked on physical hardware acquisition, not code. | N/A / blocked until hardware is sourced | Very low near-term (doc's original assessment agrees — pure moonshot, not a market gap either named competitor addresses) | Deferred, blocked |

**Why #1, #2, #4 were deferred rather than built today:** each is either a real external dependency (#1's Meta review), a large multi-week scope (#4), or simply not urgent relative to what was actually planned for this session (#2). None of them are forgotten — this table is the durable record of what's left and why, so a future session can pick any of them up without re-deriving the assessment from scratch.

**Separately identified during this work, not part of the original roadmap:** a live Supabase security/performance audit is in progress (Supabase's own Security Advisor already found 2 confirmed ERROR-level findings — cross-tenant-data-leaking `SECURITY DEFINER` views — plus several admin-privileged functions callable by fully anonymous requests that need function-body review). Findings and fixes will be tracked separately as they land.

---

## Recommendations (Who / What / By When)

1. **This sprint** — Engineering: fix the delivery-webhook 404 (Tier 0.1) and either restore or hide the three dead AI panels (Tier 0.2). These are live bugs a client could hit today.
2. **Next sprint** — Engineering: build customer table transfer (Tier 1.1) and waiter table transfer (Tier 1.2). Both extend the existing `table_orders`/`waiter_id` schema — no new tables needed, estimate as UI + RPC work only.
3. **Following sprint** — Product + Engineering: design and build preset order bundles (Tier 2.1) — this is your clearest white-space opportunity and matches neither competitor's public feature set.
4. **Before any external/investor use of competitive claims** — Whoever owns the "90% market share" narrative: either source it properly or drop the specific number and speak qualitatively ("the two most established players in the Lebanese F&B POS market").

## Next Steps
- Confirm scope on the three `❔` unverified items (auto-PO generation, allergy profiling, RTL depth) with a targeted code check before they're prioritized.
- Decide whether waitlist management and real aggregator integration get bundled into the same sprint as table transfer, given they touch adjacent table/order-flow code.
- If "BAMBOO" turns out to be a real, differently-named company you have documentation for (an invoice, a screenshot, a reseller you've dealt with), send it over and we'll fold verified specifics into this baseline.

## Sources & Caveats
- Codebase findings: direct file reads of `supabase/migrations/*.sql`, `src/pages/restaurant/*`, `src/components/restaurant/*`, `src/hooks/*`, `App.tsx` routing, and `git show --stat` on commits `0ba94338` and `e4adf8bf`.
- Competitor findings: public vendor marketing pages, third-party software directories (SoftwareSuggest, WeSuggestSoftware), and Lebanese business listings only — neither vendor publishes a full technical spec, and no demo/paid access was used. Absence of a feature in public marketing does not prove absence in the paid product; it does mean the feature isn't part of either incumbent's public differentiation story. Full citations in the research memo path noted in Part 2.
