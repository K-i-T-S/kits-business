# KiTS Business Terminal — QA Bug Tracker

> **Purpose:** Live intake log for the dedicated testing/debugging session — founder plays customer, Claude (as QA analyst) reproduces, root-causes, categorizes, and either fixes trivially or writes an agent-ready brief for a separate build agent to pick up.
> **Session owner:** Claude (this chat) — do not let build agents edit this file's entries out from under an open investigation; update status here first, then hand off.
> **Started:** 2026-07-12
> **Environment under test:** `http://localhost:3000` (Vite dev server, `VITE_USE_LOCAL_MODE=false` → live `kits-dev` Supabase project). This is real backend data, not the localStorage mock — destructive test actions (deletes, financial postings) leave real rows in `kits-dev`. Flag before doing anything destructive.
> **Do not duplicate already-known issues** — check these first before logging a "new" bug:
> - `docs/fnb-competitive-gap-analysis.md` → Progress Tracker (Tier 0/1/2/3 status)
> - `docs/superpowers/specs/2026-07-11-platform-roadmap-design.md` → Tier 0 bug list + per-track "known/open" notes
> - Memory: `project_2026-07-11-platform-roadmap.md` — open items as of 2026-07-12: **PIN login has no rate-limiting/lockout** (needs founder decision, not yet fixed), **transient ErrorBoundary crash right after login/onboarding-completion redirect** (self-heals on reload, root cause not yet captured), **owner-facing widget customization within a HUB** (not built, hub *assignment* only).

---

## Dispatch Plan — how to hand this off to build agents (added 2026-07-12, after the full 7-batch sweep)

**Every dispatch prompt to a build agent must start with:** *"Read `docs/qa-bug-tracker.md` before touching anything — it has the root cause, severity, and a paste-ready Agent Brief for this specific bug."* The briefs below are useless if an agent re-derives everything from scratch instead of using them.

### Wave 0 — Verify first (cheap, do before piling more work on)

The 42 fixes already applied across this session's seven batches were never exercised in a live browser — no test credentials were available to this session. Before building more on top of them:

> Walk through the "What to test next" checklist in `docs/qa-bug-tracker.md` (numbered items 1-29, spread across the Batch 1-7 sections) against the live app. Confirm each already-applied fix actually works — PIN login, payroll/budget/expense saves, the waiter Ready button, recipe costing, the delivery-secret masking, the API-keys/webhooks masking, etc. Report anything that doesn't match what the tracker says was fixed.

### Wave 1 — Critical, ship first

The two Critical findings, each DB-touching (will hit this project's standing "confirm the exact migration before applying to `kits-dev`" gate) — send as two separate agents:

```
Fix BUG-080 in docs/qa-bug-tracker.md — public reservation booking and table
feedback are completely non-functional for real anonymous customers (verified
live against RLS policies). Read that entry's full Agent Brief before starting.
This needs new RPCs + RLS changes on kits-dev — confirm the exact migration
with the founder by name before applying, per this project's standing discipline.
```

```
Fix BUG-035 and BUG-034 together in docs/qa-bug-tracker.md — loyalty points
have likely never been earned on a single real sale (POS calls a nonexistent
RPC), and redemption has a separate read-then-write race. Read both entries'
Agent Briefs. Build both RPCs in one migration since they share the same
missing loyalty backend. Confirm the exact migration with the founder by name
before applying.
```

### Waves 2-6 — everything else, by priority

Each wave is sized for one agent; items within a wave share a file/table, so bundling them avoids duplicate migrations touching the same object.

| Wave | Items | Why grouped |
|---|---|---|
| 2 — Pharmacy compliance | BUG-076+077 (narcotics `pharmacist_name` attribution + append-only RLS), then BUG-078+079 (dispensing-integration + stock-deduction RPC) | Regulatory risk; same file/table pair each |
| 3 — Money-flow completeness | BUG-032+033 (POS split-payment/tax persistence — **needs PowerSync coordination, say so explicitly**), BUG-053+054+055 (delivery-sale same fixes, one DB function) | Same underlying gap, different order-sources |
| 4 — Cash tracking | BUG-004 (sharpened scope — denomination capture, employee attribution, auto-reconciliation from real sales) | Big enough to be its own wave, touches 3 pages |
| 5 — Dead UI wiring | BUG-065 (POS business-policy settings), BUG-081 (bulk pricing at checkout), BUG-061 (menu cost reconciled with recipe costing) | Same shape of fix each time — wire existing settings to where they should take effect |
| 6 — Operational gaps | BUG-009/010 (shift-PIN reconciliation + auto section assignment), BUG-048 (reservation atomic-seating RPC), BUG-011/030 (stale-fetch cleanup, 5 components), BUG-012 (real CSV/Excel bulk import), BUG-038 (tip distributions → real table), BUG-047 (QR order-status tracking), BUG-088 (ingredient stock atomic RPC) | Lower urgency, independent of each other |

### Don't send to a build agent yet — founder decision needed first

Each of these has a scope question in its tracker entry that a build agent shouldn't be left to guess on:

- **BUG-051** — should a booked Event block its tables from regular seating?
- **BUG-066** — tenant-deletion safety model (soft-delete + grace period vs. re-auth vs. both vs. accept as-is)
- **BUG-090** — `MultiLocationSupport.tsx` vs `MultiBranchHub.tsx`: two deliberate systems, or unintentional drift to consolidate?
- **BUG-036 / BUG-025 / BUG-026** — build the missing backend (CRM segments/comms, product variants) vs. strip the UI that implies they exist
- **BUG-062 / BUG-063** — need a quick confirmation trace (are branch menu overrides actually unwired downstream? do the two settings pages actually overlap on the same columns?) before either is treated as certain
- **BUG-082** — delete `POSTestPage.tsx`? (orphaned, confirmed unreachable, but this project's established pattern requires naming the specific file for a deletion, not inferring it from a general cleanup instruction)

---

## How an entry gets created

1. Founder reports something observed while testing as a customer (a screen, a flow, a "this feels off").
2. Claude reproduces it directly — dev server + browser automation — before writing anything down. If it can't be reproduced, that itself is recorded (see Status).
3. Claude root-causes to the file/line/migration level where feasible (grep, read, `git blame`, Supabase `get_advisors`/`get_logs`/`execute_sql` for data issues).
4. Claude classifies Severity + Category (below) and decides: **fix now** (trivial, isolated, no conflict with in-flight agent work) vs. **hand off** (needs a scoped brief for a build agent).
5. Entry gets a `BUG-NNN` ID, added to the Index table, full writeup added below it.
6. If handed off, the entry's "Agent Brief" field is a self-contained, paste-ready prompt — file paths, root cause, fix direction, acceptance criteria — written the way `docs/superpowers/specs/*.md` are written for this codebase.

**Caution — other agents have work in flight on `main` right now** (uncommitted PowerSync offline-first Phase 1 work in `src/powersync/`, `src/env.d.ts`). Before proposing a fix that touches a file already mid-edit elsewhere, check `git status`/`git diff` again — don't silently stomp on it. Prefer handing off rather than fixing in-place if a target file has uncommitted changes not authored by this session.

---

## Severity

| Level | Definition |
|---|---|
| **Critical** | Data loss/corruption, security/tenant-isolation breach, blocks a core money-moving flow (checkout, payments, close-bill) for all/most users |
| **High** | Feature is broken or unreachable for a real user segment; wrong data displayed/persisted; blocks a common workflow with no reasonable workaround |
| **Medium** | Feature works but degraded (wrong copy, bad UX, minor miscalculation, awkward flow); workaround exists |
| **Low** | Cosmetic, copy/typo, RTL/i18n polish, inconsistent styling, doesn't affect function |

## Category

`Functional Bug` · `Data Integrity` · `UX/Flow` · `Missing Feature` · `Performance` · `Security/RBAC` · `i18n/RTL` · `Cross-Vertical Conflict` (generic-platform vs. F&B-specific logic colliding — a recurring bug class per the 2026-07-12 platform audit) · `Documentation Drift` (docs say X, code does Y)

## Status

`New` → `Confirmed` (reproduced) → `Root-Caused` → `Fixed` (this session) / `Briefed` (handoff doc ready) / `Assigned` (handed to another agent) → `Verified Fixed`
Other terminal states: `Cannot Reproduce`, `Won't Fix` (founder decision), `Duplicate` (links to the canonical BUG-NNN or roadmap item)

---

## Index

**Batch 1 — Employees/PIN/Argile/Waiter/Shifts/Finance/Recipe sweep (2026-07-12)**, founder-reported while testing the Employees area, investigated via 7 parallel research forks + 1 direct follow-up read.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-001 | PIN login auto-submits at 4 digits regardless of the employee's real 4-6 digit PIN | High | Functional Bug | **Fixed** | `src/components/PinLockScreen.tsx` |
| BUG-002 | PIN pad had no physical keyboard input, buttons only | Medium | UX/Flow | **Fixed** | `src/components/PinLockScreen.tsx` |
| BUG-003 | Flat, unlabeled role picker makes it easy to give an F&B employee "cashier" instead of a job-role custom role, landing them on generic `/pos` | Medium | UX/Flow | **Fixed** | `src/components/CreatePinEmployeeModal.tsx` |
| BUG-004 | No granular per-employee activity/cash-handling audit trail (denominations, narrative log) | High | Missing Feature | **Partially fixed** (2026-07-14) — attribution done (BUG-040), denomination UI + sales-reconciliation still open | `src/pages/restaurant/CashDrawer.tsx`, `src/types/restaurant.ts` |
| BUG-005 | Argile "open session" table dropdown goes blank with zero empty-state messaging when no table is occupied | Medium | UX/Flow | **Fixed** | `src/pages/restaurant/ArgileStation.tsx` |
| BUG-006 | No owner-customization UI exists for argile coal type, head size, *or* tobacco flavors (flavors table exists but has no admin screen either) | Medium | Missing Feature | Briefed | — |
| BUG-007 | QR customers can request more coal on an open argile session (fa7em) but cannot order a *new* argile session | Low-Medium | Missing Feature | Briefed | — |
| BUG-008 | Waiter "Ready" button on a cleaning table is unclickable — invisible disabled button intercepts the tap (z-index/stacking) | High | Functional Bug | **Fixed** | `src/pages/restaurant/WaiterInterface.tsx` |
| BUG-009 | PIN check-in and `ShiftManager`'s scheduled-attendance tracking are two fully disconnected systems — no scheduled-vs-actual view | High | Missing Feature / Data Integrity | Briefed | — |
| BUG-010 | No auto waiter-to-table-section assignment; `ShiftManager`'s "section" field is free text, not linked to real `restaurant_tables.section` values | Medium | Missing Feature | Briefed | — |
| BUG-011 | Four components (`RolesAndPermissionsManager`, `TipsManagement`, `EnterpriseDashboard`, `UserProfileModal`) run independent stale `employees` fetches instead of `AppContext`'s already-correct shared state | Medium | UX/Flow | **Partially fixed** (2026-07-14) — 2 of 4 genuinely fixed; the other 2 investigated and correctly left alone, see entry | `src/pages/restaurant/TipsManagement.tsx`, `src/components/enterprise/EnterpriseDashboard.tsx`, `src/context/AppContext.tsx` (widened `Employee.user_id`) |
| BUG-012 | "Bulk import" is a paste-CSV-text stock-quantity/cost updater only — no file upload, no new-record creation, no other entities | High | Missing Feature | Briefed | — |
| BUG-013 | White screen on refresh after a new deploy (`__tla` SyntaxError) — the reload-on-update service worker hook exists but was never mounted | High | Functional Bug | **Fixed** | `src/App.tsx` |
| BUG-014 | Floating "A11y Audit" dev-tool button rendered unconditionally in production | Medium | UX/Flow | **Fixed** | `src/App.tsx` |
| BUG-015 | Missing `mobile-web-app-capable` meta tag alongside the deprecated Apple-only one | Low | Documentation Drift | **Fixed** | `index.html` |
| BUG-016 | CSP defined in two unsynced places (`vercel.json` header + `index.html` meta tag) — `vercel.live` block is harmless in production but the duplication is a drift risk | Low | Documentation Drift | Logged (no fix needed) | — |
| BUG-017 | `CLAUDE.md` documented the dev server on `:5173`; it actually runs on `:3000` | Low | Documentation Drift | **Fixed** | `CLAUDE.md` |
| BUG-018 | `payroll_entries` insert never sets `tenant_id` → 403 on every payroll entry, for every role including real owners | High | Functional Bug | **Fixed** | `src/pages/Finance.tsx` |
| BUG-019 | `expense_budgets` insert + "copy last month" upsert never set `tenant_id` → 403 on every budget save | High | Functional Bug | **Fixed** | `src/pages/Finance.tsx` |
| BUG-020 | Recipe line "Unit" was free text disconnected from the cost calc — retyping it (e.g. kg→g) silently inflated live cost estimates up to 1000× | High | Data Integrity | **Fixed** (stopgap — see note) | `src/pages/restaurant/RecipeInventory.tsx` |
| BUG-021 | Bulk insert of recipe lines failed atomically on any `UNIQUE(recipe_id, ingredient_id)` conflict, silently leaving a recipe with $0 cost | High | Functional Bug / Data Integrity | **Fixed** | `src/pages/restaurant/RecipeInventory.tsx` |
| BUG-022 | Waste log quantity inputs (inline form + modal) showed no unit label | Low-Medium | UX/Flow | **Fixed** | `src/pages/restaurant/RecipeInventory.tsx` |

**Verified working, no defect found:** argile session charges correctly post to the right table's bill (`ArgileStation.tsx:addArgileChargeToOrder`); table transfer/split (`fn_transfer_table_order`, `fn_split_table_order`) is correctly wired end-to-end in `WaiterInterface.tsx`.

**All 8 "Fixed" items verified via `npm run typecheck` + `npm run lint` (zero errors, zero warnings) after every change.** No live UI walkthrough was done — the founder should spot-check the flows below before treating this as done-done (see "What to test next" at the bottom).

---

## Entries

### BUG-001 — PIN login auto-submits at 4 digits, breaking every 6-digit PIN
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

**Root cause:** `CreatePinEmployeeModal.tsx` genuinely accepts 4-6 digit PINs (`/^\d{4,6}$/`), and the PIN's length is never persisted anywhere — it's just the literal Supabase Auth password, no `pin_length` column exists. `PinLockScreen.tsx` used to auto-submit the instant the entered PIN reached 4 characters, regardless of how long the real PIN was. For any 6-digit PIN, the first 4 digits fired as a doomed login attempt, cleared, and the last 2 digits started a second doomed attempt — that employee could never log in.

**Fix applied:** Removed the length-triggered auto-submit entirely. PIN entry is now always an explicit action — tap the new **Enter** button below the keypad, or press the physical Enter key (see BUG-002) — submitting whatever length (4-6) was typed. This works correctly for every existing employee's PIN regardless of length, with no migration needed.

**Founder decision still open (not part of this fix):** should the platform standardize on a single PIN length going forward (e.g. 6, matching the 6-dot indicator already in the UI) rather than allowing 4-6? A fixed length would let a future version safely re-introduce auto-submit-at-N for a faster tap-in flow, at the cost of migrating any existing 4-5 digit PINs. Explicit-confirm is safe either way and doesn't block that decision.

---

### BUG-002 — No physical keyboard input on the PIN pad
**Severity:** Medium · **Category:** UX/Flow · **Status:** Fixed

**Root cause:** `PinLockScreen.tsx` wired `onClick` only on the rendered digit/backspace/cancel buttons — no `keydown` listener existed anywhere in the file, so a terminal with an attached keyboard (common at a POS counter) couldn't be used to enter a PIN.

**Fix applied:** Added a `keydown` listener (active only while an employee tile is selected) mapping `0-9` → digit entry, `Backspace` → delete, `Escape` → cancel/back-to-roster, `Enter` → submit (reuses the same `handleSubmit` as the new Enter button from BUG-001).

---

### BUG-003 — Ambiguous role picker routes real F&B staff to the wrong screen
**Severity:** Medium · **Category:** UX/Flow · **Status:** Fixed

**Investigation note:** the redirect *logic* itself (`postLoginRoute.ts`) is correct and intentional — a "Waiter" custom role (`base_role='cashier'`, `home_hub='waiter'`) correctly lands on `/restaurant/waiter`; the plain standard `cashier` role correctly lands on `/pos`. The founder's "cashier got redirected to POS" report traces to that employee being created with the **standard** `cashier` role instead of the **Waiter** custom role — both options sit in one flat, unlabeled dropdown with zero guidance on which to pick for a restaurant tenant. No routing code was wrong; the picker just makes the wrong choice easy.

**Fix applied:** For restaurant-industry tenants, `CreatePinEmployeeModal.tsx`'s role `<select>` now lists job-role custom roles (Waiter, Kitchen, Argile, etc.) first, with helper copy underneath: *"Use a job role (Waiter, Kitchen, Argile...) unless this person is strictly a checkout cashier — 'cashier' always opens straight to POS."*

---

### BUG-004 — No granular per-employee activity/cash-handling audit trail
**Severity:** High · **Category:** Missing Feature · **Status:** Briefed
**Update (Batch 3, 2026-07-12):** re-audited `CashDrawer.tsx`/`EODReport.tsx` directly — the gap is sharper than originally scoped. See BUG-039/040/041 below, now folded into this entry's scope rather than logged as separate items.

**Current state (four disconnected/broken systems, not three):**
1. **Shift check-in** — `PinLockScreen.tsx`'s `clockInIfScheduled` correctly stamps `restaurant_shift_assignments.clocked_in_at` on PIN login when a shift assignment exists for that employee today. This part works.
2. **Audit trail** — `logActivity` in `PinLockScreen.tsx` writes `employee_pin_login`/`employee_pin_logout` rows to `activity_log` with `metadata: { name }` only — no table, no cash amount, no line-item detail. A read UI already exists at `src/pages/ActivityLog.tsx` (categorized, has an 'employee' filter) — the "dedicated logging page" the founder wants structurally exists, it's just fed very thin events today.
3. **Cash detail (BUG-039) — the `denomination_breakdown` column is 100% dead, not "session-level only" as originally scoped.** `restaurant_cash_sessions.denomination_breakdown` (migration `000043`) has zero writers anywhere in `src/` outside its own migration comment — `CashDrawer.tsx`'s open/close flows both take a single lump USD/LBP number, never denomination counts. `restaurant_cash_movements` (migration `000047`) has no denomination field at all, confirmed. So the schema *could* support "returned 2×$10+1×$5" at the till-count level, but nothing in the UI ever populates it — this needs new UI, not just new columns.
4. **Zero employee attribution on cash records (BUG-040)** — `restaurant_cash_sessions.opened_by` and `restaurant_cash_movements.created_by` both exist as real columns but `CashDrawer.tsx` never sets either on insert. Every drawer open and every cash movement is permanently unattributed — not even coarse "who did this," let alone per-transaction detail.
5. **Cash reconciliation is manually re-entered, disconnected from real sales (BUG-041)** — `restaurant_cash_movements` is written *only* by manual "Record Sale"/"Record Refund" buttons in `CashDrawer.tsx` where a cashier hand-types a dollar amount. There is no automatic cash-movement creation when a POS sale actually completes with a cash payment method — the "expected total" the drawer reconciles against is trusting manual re-entry, not the `sales` table itself. A skipped click or a typo silently breaks the whole point of the reconciliation tool.

None of these systems share a queryable join key surfaced in any UI, so composing the founder's target sentence — *"Ahmad (cashier) closed table 1 at 14:32:07, took in $100, returned 2×$10+1×$5"* — isn't possible from what's stored today, in the Cash Drawer page, the EOD report, or anywhere else.

**Related, separately noted:** BUG-032 (POS split-payment breakdown never persisted) and BUG-044 (EOD/P&L/Cash-Drawer each compute "today's revenue" from a different, never-reconciled source) both compound this gap from the POS/reporting side — worth designing all four together rather than sequentially.

**Agent Brief (paste-ready, supersedes the original):**
> Build granular per-employee cash-handling and activity tracking for KiTS Business Terminal (F&B vertical). Current state (all confirmed via direct code read, 2026-07-12): `activity_log` gets thin `employee_pin_login`/`employee_pin_logout` events only (`src/components/PinLockScreen.tsx`'s `logActivity()`); `restaurant_cash_sessions.denomination_breakdown` (JSONB, migration `000043`) and `restaurant_cash_movements` (migration `000047`) both exist but `src/pages/restaurant/CashDrawer.tsx` never writes denomination detail or `opened_by`/`created_by` employee attribution to either; cash movements are entirely manual re-entry, never auto-created from real `sales`/`table_orders` close-bill events. A read UI already exists at `src/pages/ActivityLog.tsx`.
> Scope: (1) have `CashDrawer.tsx` actually collect and write denomination counts on open/close, and set `opened_by`/`created_by` on every insert (`(await supabase.auth.getUser()).data.user?.id`); (2) auto-generate cash movements from real sale/close-bill events (a DB trigger on `sales`/`table_orders` where payment indicates cash, or a call from the POS/close-bill success path) instead of relying on a cashier remembering to click "Record Sale" — keep the manual buttons only for genuine float adjustments/tip-outs/misc cash-in-hand adjustments; (3) enrich `activity_log.metadata` on close-bill and other significant employee actions with structured, narratable detail; (4) enrich `ActivityLog.tsx`'s rendering to compose human-readable sentences from structured metadata rather than raw JSON; (5) surface a per-employee activity feed on the Cash Drawer page and in the EOD report, joining `activity_log` + `restaurant_cash_movements` by `employee_id`/`tenant_id`/date range. Confirm live schema via `pg_get_functiondef`/`information_schema` before writing any migration. Design the exact target sentence format and the auto-generation trigger points with the founder before building — this is now a 5-part scope, not a 4-part one, and touches POS/CashDrawer/EOD/ActivityLog as four separate surfaces reading the same underlying data.

---

### BUG-005 — Argile table dropdown blank with no empty-state messaging
**Severity:** Medium · **Category:** UX/Flow · **Status:** Fixed

**Root cause:** `ArgileStation.tsx`'s "open session" table picker deliberately only lists tables with `status === 'occupied'` (correct — you shouldn't argile-charge an empty table), but showed a genuinely empty dropdown with zero explanation when no table was currently occupied. Reads as broken rather than "seat a table first."

**Possible connective cause worth re-checking after BUG-008 ships:** if the waiter "mark table ready" button (BUG-008) was stuck non-functional, tables could get stranded at `status='cleaning'` after bill-close and never reach `occupied` again for a new seating — worth a quick re-test now that BUG-008 is fixed.

**Fix applied:** Added explicit amber helper copy under the table dropdown: *"No occupied tables right now — seat a table first, then open its argile session here."*

---

### BUG-006 — No owner-customization UI for argile coal type, head size, or flavors
**Severity:** Medium · **Category:** Missing Feature · **Status:** Briefed

**Broader than originally assumed:** `coal_type`/`head_size` are hardcoded `CHECK` enums (migration `20260621_000036_restaurant_argile.sql`, two options each) mirrored by hardcoded frontend button pairs. But **tobacco flavors aren't actually owner-customizable either** — `restaurant_argile_flavors` is a real per-tenant table, but there is zero UI anywhere that writes to it (only `ArgileStation.tsx`'s read-only `.select()`); someone populates it via raw SQL today. So the real gap is: **there is no argile-customization surface at all**, not "flavors work but coal/head-size don't."

**Agent Brief (paste-ready):**
> Build an "Argile Settings" owner/manager screen for KiTS's F&B vertical. Context: `restaurant_argile_flavors` (per-tenant, has `is_active`/`sort_order`) already exists but has zero write UI anywhere — populated via raw SQL only. `coal_type`/`head_size` on `restaurant_argile_sessions` are `CHECK ('natural','quick_light')` / `CHECK ('regular','jumbo')` enums (migration `20260621_000036_restaurant_argile.sql`, lines ~35-36), mirrored by hardcoded two-option buttons in `ArgileStation.tsx` (~lines 400, 424). Scope: (1) CRUD screen for `restaurant_argile_flavors` (brand, flavor, flavor_ar, base_price_usd, refill_price_usd, is_active, sort_order — columns already exist); (2) two new small lookup tables, `restaurant_argile_coal_types` and `restaurant_argile_head_sizes`, same shape as flavors (id/tenant_id/label/label_ar/price_modifier/is_active/sort_order), migrating `restaurant_argile_sessions.coal_type`/`head_size` off the `CHECK` enums onto FKs (or validated free text if a hard FK is too disruptive to existing rows — check current row count before deciding); (3) wire `NewSessionModal` in `ArgileStation.tsx` to read all three lists dynamically instead of hardcoded options. Follow the same tenant-scoped RLS pattern as every other settings table in this codebase.

---

### BUG-007 — QR customers can't order a new argile session (only refill an existing one)
**Severity:** Low-Medium · **Category:** Missing Feature · **Status:** Briefed

**Confirmed via both `qr_place_order()` definitions** (migrations `000057`, `000062`) — zero argile references in either. The only customer-initiated argile action wired end-to-end is **fa7em** ("send more coal" on an already-open session) — `QRMenuHome.tsx`/`QRMenuPage.tsx`, backed by a public unauthenticated INSERT policy on `restaurant_argile_events`, and it correctly surfaces in `ArgileStation.tsx`'s realtime subscription (`postgres_changes` on that table) with urgency styling. **This one works correctly and is not a bug.** Initial QR-side argile *ordering* (a table with no session yet requesting one) simply doesn't exist.

**Agent Brief (paste-ready):**
> Add QR-initiated argile ordering to KiTS's F&B vertical. Context: `qr_place_order()` (latest definition in migration `20260708_000062_preset_order_bundles.sql`) is the sole anonymous write path for QR customer orders — resolves `tenant_id` server-side from the table, revalidates prices server-side. It has no argile awareness today. The existing fa7em refill flow (`restaurant_argile_events` table, public INSERT policy, realtime-subscribed in `ArgileStation.tsx`) is a good pattern to extend rather than replace. Scope: either (a) add an argile-session branch to `qr_place_order()`'s `p_items` array handling, creating a `restaurant_argile_sessions` row with a `status='requested'` (new) state pending staff acceptance, or (b) a dedicated `qr_request_argile_session` RPC mirroring the same tenant-resolution/security pattern. Either way, `ArgileStation.tsx` needs a new "incoming requests" section (cards, not auto-created sessions) so an argile staff member explicitly accepts before it becomes a billable session — don't auto-create and auto-charge from an unattended customer request.

---

### BUG-008 — Waiter "Ready" button unclickable (z-index/stacking bug)
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

**Root cause:** `WaiterInterface.tsx`'s `TableTile`: the cleaning overlay (with its visible "Ready" button) rendered first in the DOM, then a separate full-tile `disabled` click-catcher button rendered after it with no `z-index` on either. Per normal stacking rules, the later sibling paints on top — and a `disabled` button still absorbs clicks/blocks hit-testing to whatever's behind it (disabled doesn't mean "invisible to pointer events"). The waiter was tapping a button that was actually behind another element. The `markTableAvailable` handler itself was correctly wired the whole time — real Supabase update, tenant-scoped, optimistic UI, success toast.

**Fix applied:** Added `pointer-events-none` to the click-catcher button specifically when the tile is in the cleaning state, so clicks fall through to the real "Ready" button underneath.

**Note:** a manager-side workaround already existed and was unaffected — `TableManagement.tsx` has its own independent "Mark Available" button. Worth confirming with any waiters affected that this is now fixed on their own screen too.

---

### BUG-009 — PIN check-in and scheduled-shift attendance are disconnected systems
**Severity:** High · **Category:** Missing Feature / Data Integrity · **Status:** Briefed

**Root cause:** `ShiftManager.tsx` has its own `clocked_in_at`/`clocked_out_at` columns on `restaurant_shift_assignments`, populated only by a **manager manually clicking Clock In/Out per assignment**. This has zero connection to the real PIN login system — when an employee taps their own PIN, `PinLockScreen.tsx`'s `clockInIfScheduled` *does* stamp the same `clocked_in_at` column (confirmed working, see BUG-004), but `ShiftManager`'s own UI has no way to show "scheduled vs. actually PIN-checked-in" as a distinct comparison — a manager scheduling 5 waiters/2 argile/1 cashier/1 manager/1 chef/2 sous chefs for a shift has no view answering "who from this list actually showed up and clocked in via their own PIN, versus who's still a no-show."

**Agent Brief (paste-ready):**
> Add a "scheduled vs. actually checked in" attendance view to `ShiftManager.tsx` for KiTS's F&B vertical. Context: `restaurant_shift_assignments.clocked_in_at` IS correctly populated by real employee PIN logins already (`src/components/PinLockScreen.tsx`'s `clockInIfScheduled`, confirmed working) — this is not a data-capture gap, it's a display gap. `ShiftManager.tsx` currently only shows its own manual Clock In/Out buttons per assignment without distinguishing "manager clicked this" from "employee's own PIN login set this." Scope: for a given shift, render each scheduled assignment with clear status — Scheduled / Checked In (via PIN, with timestamp) / No-show (shift start time passed, no `clocked_in_at`) — and make it the primary read view for "is everyone I scheduled actually here," not just an editable roster. Consider whether the payroll-hours export (`ShiftManager.tsx` line ~176, reads these same columns) needs any adjustment once this is visible — it currently silently reflects whatever's in `clocked_in_at`/`clocked_out_at` regardless of source.

---

### BUG-010 — No auto waiter-to-table-section assignment
**Severity:** Medium · **Category:** Missing Feature · **Status:** Briefed

**Root cause / current state:** `restaurant_tables.section` is a real column with actual values (used by `WaiterInterface.tsx`'s existing manual `filterSection` dropdown). But `ShiftManager`'s per-assignment "section" field is a **free-text input** — "Indoor", "indoor ", "indoors" are three different unlinked strings, with zero connection to real table data. No `WaiterHomeHub` exists — a Waiter's `home_hub='waiter'` lands them on the full `WaiterInterface.tsx` with every table visible and the filter defaulted to "all," no check-in time shown, no pre-scoping to their own tables.

**Agent Brief (paste-ready):**
> Build waiter-to-table-section assignment for KiTS's F&B vertical, editable by manager/supervisor, auto-applied on PIN check-in. Context: `restaurant_tables.section` is real and already used by `WaiterInterface.tsx`'s manual `filterSection` dropdown (~line 2123). `ShiftManager.tsx`'s per-assignment "section" field (~line 61, 748-750) is currently free text, not validated against real sections. No dedicated `WaiterHomeHub` exists — waiters land on the full `WaiterInterface.tsx`. Scope: (1) change `ShiftManager`'s section input to a real `<select>` sourced from `SELECT DISTINCT section FROM restaurant_tables WHERE tenant_id=...`; (2) on PIN login, have `WaiterInterface.tsx` default `filterSection` to the logged-in employee's current shift assignment's section (join through `restaurant_shift_assignments` for today); (3) show the employee's own check-in time somewhere on the waiter screen (currently shown nowhere on this screen at all). Design whether "editable by manager/supervisor" means a dedicated table-section-assignment UI or reuses the existing shift-assignment section field — the founder's phrasing ("assign waiters on sections automatically but editable") suggests a distinct concept from shift scheduling; confirm before building.

---

### BUG-011 — Four components bypass `AppContext` with independent stale employee fetches
**Severity:** Medium · **Category:** UX/Flow · **Status:** Partially fixed (2026-07-14) — 2 of 4, on investigation, correctly not touched

**Fixed:** `TipsManagement.tsx` now reads the shared `employees` array (widened `Employee`/`DbEmployee` with a `user_id` field it needed and previously had to run its own fetch just to get). `EnterpriseDashboard.tsx` now uses `employees.length` instead of a duplicate count query.

**Investigated and correctly left alone, contrary to the original brief:**
- **`RolesAndPermissionsManager.tsx`** has 2 real fetches (not fetches at the 3rd site — that one is a role-change *write*). The main employee list deliberately shows **inactive** employees too (rendered in the UI) — `AppContext`'s shared state filters `is_active = true` at the query level, so swapping would silently hide inactive staff from an admin role-management screen, a real regression. The second fetch (checking if the current user is owner/admin) can't safely be replaced by `currentEmployee` either: traced its resolution in `AppContext.tsx` and found it falls back to "first employee in the array" in the normal online-session path (`frontendEmployees[0]`), not a real `auth.uid()` match — using it here could grant or deny admin access to the wrong person. Left unchanged; the `currentEmployee` fallback-accuracy issue is worth knowing about for future work but is a separate, unlogged concern, not built into a fix here.
- **`UserProfileModal.tsx`** doesn't actually have an independent *fetch* at all — its one `employees` reference is a write (updating the current user's own name/email/phone), not a stale read. The original finding's framing doesn't hold up on inspection; no change made.

**Correction to the founder's framing:** this is *not* a missing optimistic-update bug — `AppContext.tsx`'s `addEmployee`/`addProduct` already correctly append the new row to local state immediately after insert (`setEmployees(prev => [...prev, newEmployee])` etc.). The actual bug is that four other components run their **own independent `.from('employees')` queries** on mount and never re-sync when `AppContext`'s canonical `employees` array changes: `RolesAndPermissionsManager.tsx` (3 separate calls), `TipsManagement.tsx`, `EnterpriseDashboard.tsx`, `UserProfileModal.tsx`. Any of these screens shows stale data until a hard refresh forces their own `useEffect` to re-run — which reads exactly like "new employee doesn't show up without a refresh."

**Agent Brief (paste-ready):**
> Remove four ad-hoc `employees` fetches in favor of the already-correct shared state. Context: `src/context/AppContext.tsx`'s `addEmployee`/`addProduct` already do optimistic local-state updates — the "doesn't show up without refresh" symptom is NOT a missing-update bug, it's scattered duplicate data sources. Fix: in `src/components/enterprise/RolesAndPermissionsManager.tsx` (3 call sites), `src/pages/restaurant/TipsManagement.tsx`, `src/components/enterprise/EnterpriseDashboard.tsx`, and `src/components/UserProfileModal.tsx`, replace each independent `.from('employees')` query with the shared `employees` array from `useApp()`, deriving/filtering locally as each screen needs. Verify no screen depended on a field `AppContext`'s query doesn't select (check `AppContext.tsx`'s employees `.select()` clause covers everything these four screens read) before deleting the duplicate queries.

---

### BUG-012 — "Bulk import" is a narrow paste-CSV stock updater, not real migration tooling
**Severity:** High · **Category:** Missing Feature · **Status:** Briefed

**Confirmed:** `ImportInventoryModal.tsx`/`EnhancedImportInventoryModal.tsx` exist but are a **paste-CSV-text-into-a-textarea** flow (no file upload), hardcoded to exactly `barcode, quantity, cost`, and can only update stock/cost on products that **already exist** by barcode match — it cannot create new catalog rows, and has no support for employees, customers, or any other entity. `exportService.ts` remains export-only, matching what `CLAUDE.md` already documents. This falls well short of "smooth frictionless transitioning from previous software," which is a stated go-to-market pillar (MASTER_PLAN.md's self-serve-onboarding positioning).

**Agent Brief (paste-ready):**
> Build real bulk-import tooling for onboarding migration from competitor POS software. Context: the only existing "import" (`src/components/ImportInventoryModal.tsx`, `EnhancedImportInventoryModal.tsx`) is a paste-CSV-text, barcode-match-only stock/cost updater — it cannot create new products or import any other entity, and `exportService.ts` (ExcelJS + jsPDF, already a project dependency) remains export-only. Scope v1: real `.csv`/`.xlsx` **file upload** (not paste) for full **Products/Inventory** catalog import (SKU/barcode/name/price/cost/stock — create-or-update, not update-only) — this is the highest-friction entity for a switching F&B/retail business. Fast-follow v2: Customers, then a bulk-employee-with-PIN-generation flow (reusing `create-pin-employee`'s per-row logic). Use ExcelJS (already installed) for `.xlsx` parsing to stay dependency-light. Design a column-mapping step (real-world exports won't match KiTS's exact schema) before committing to a rigid format.

---

### BUG-013 — White screen on refresh after a new deploy
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

**Root cause:** `vite.config.ts` correctly sets `registerType: 'autoUpdate'`, and a fully-correct `useServiceWorker()` hook already existed at `src/hooks/useServiceWorker.ts` — its `controllerchange` listener genuinely does call `window.location.reload()` when a new service worker takes control. **The hook was never imported or mounted anywhere in the app** (confirmed via grep — zero call sites outside its own definition file). With the hook dead, nothing ever forced an open tab to reload after a new deploy activated a new service worker in the background — the tab kept running the OLD `index-*.js` entry chunk while lazy route `import()`s started resolving against the NEW deployed chunk manifest, producing exactly the reported `Uncaught SyntaxError: ... does not provide an export named '__tla'` (a stale chunk referencing a hashed sub-chunk name from a different build than the one currently deployed).

**Fix applied:** Mounted `useServiceWorker()` in `App.tsx`'s root component, activating the dead reload-on-update logic.

**What to test next (needs a real deploy, can't be verified locally):** push this fix, then on the *following* deploy, keep an old tab open through the deploy and confirm it force-reloads cleanly instead of white-screening. This class of bug only manifests across two consecutive deploys, so it can't be confirmed fixed until the *next* production deploy after this one ships.

---

### BUG-014 — Floating "A11y Audit" button live in production
**Severity:** Medium · **Category:** UX/Flow · **Status:** Fixed

**Root cause:** `App.tsx` rendered `<AccessibilityAudit />` unconditionally inside every authenticated route's chrome — no dev-mode gate, no role check. Every real employee and customer-facing session saw a permanent floating "A11y Audit" button running live DOM audits — a dev-tool pattern with no business being customer-visible in a production SaaS platform.

**Fix applied:** Gated behind `import.meta.env.DEV` in `App.tsx` — only renders in local development now.

---

### BUG-015 — Missing `mobile-web-app-capable` meta tag
**Severity:** Low · **Category:** Documentation Drift · **Status:** Fixed

`index.html` only had the deprecated `apple-mobile-web-app-capable` tag. Current PWA best practice keeps both side by side (the Apple-specific tag still governs iOS Safari PWA chrome; the new one is the cross-browser standard) — added `mobile-web-app-capable` alongside it, not as a replacement.

---

### BUG-016 — CSP defined in two unsynced places
**Severity:** Low · **Category:** Documentation Drift · **Status:** Logged, not fixed

CSP exists both as an HTTP header in `vercel.json` and as a `<meta http-equiv="Content-Security-Policy">` tag in `index.html` — both currently agree, and the `vercel.live` block the founder saw in console is expected/harmless (Vercel Live's feedback toolbar only matters on preview deployments, not production). Not fixing now — flagging because having two sources that must be **manually** kept in sync is itself a latent drift risk for the next person who edits one and forgets the other. Worth consolidating to one source next time either file is touched, not urgent enough to justify its own change today.

---

### BUG-017 — `CLAUDE.md` documented a stale dev-server port
**Severity:** Low · **Category:** Documentation Drift · **Status:** Fixed

`CLAUDE.md` said `npm run dev` serves on `:5173`; it actually serves on `:3000` (per `vite.config.ts`). One-line correction.

---

### BUG-018 — `payroll_entries` insert missing `tenant_id` → 403 on every payroll entry
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

**Root cause (confirmed against LIVE `pg_policies`, not migration-file reconstruction):** the RLS policy on `payroll_entries` is purely tenant-scoped (`tenant_id = current_tenant_id()`), with **no role check at all** — this is not a recurrence of the earlier `send-invitation` missing-role-gap bug, and it affects **every role, including real owner accounts**, not just admin test sessions. `payroll_entries.tenant_id` has no column default and no trigger anywhere in the migration history. `Finance.tsx`'s `handleAddPayroll()` insert payload (18 fields) simply never included `tenant_id`, even though the same component already receives `currentTenant` as a prop and every other working insert in the app (`AppContext.tsx`) sets it explicitly. NULL `tenant_id` fails the RLS check → PostgREST reports it as a 403, matching the console output exactly. 100% reproducible for every tenant/role, not an edge case.

**Fix applied:** Added `tenant_id: currentTenant?.id` to the insert payload.

---

### BUG-019 — `expense_budgets` insert + copy-last-month upsert missing `tenant_id` → 403 on every budget save
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

**Root cause:** identical bug class to BUG-018, same live-verified pure-tenant-scoped RLS policy, same missing-field root cause — except `BudgetTabProps` didn't even have a `currentTenant` prop to begin with, so it had to be threaded through from the `Finance.tsx` call site first. Two call sites were affected: `saveBudget()`'s insert branch, and `handleCopyLastMonth()`'s upsert branch (`onConflict: 'tenant_id,category_id,year,month'` — the upsert's own conflict target *names* `tenant_id`, which would never have matched correctly even if the insert-without-error case were reached).

**Fix applied:** Added `currentTenant` to `BudgetTabProps`, threaded it from the call site, and added `tenant_id: currentTenant?.id` to both the insert and the upsert payloads.

---

### BUG-020 — Recipe line "Unit" field disconnected from cost calculation
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed (stopgap — see note)

**Root cause:** the recipe-line cost formula (`quantity × waste_factor × ingredient.cost_per_unit`) is mathematically consistent between the live creation-time estimate and the saved/displayed cost — both use the same math. But `cost_per_unit` is priced per the ingredient's **native stock unit**, while the recipe line's "Unit" field was a **freely-editable plain-text input** that auto-filled to the correct unit on ingredient selection but didn't stop the user from then retyping it (e.g. correcting "200" to mean grams by typing "g" over an ingredient priced per kg) — changing the label didn't rescale the quantity or the cost, so the calculation silently used the wrong unit's price. This produces exactly the founder's report: a cost inflated by ~1000× when a kg-priced ingredient's quantity is entered thinking in grams.

**Fix applied (safe stopgap, not the full solution):** locked the Unit field to read-only, always showing the ingredient's actual stocked unit (`ingredientMap.get(...).unit`), with a tooltip explaining why. This eliminates the silent-wrong-unit failure mode immediately, at the cost of forcing recipe quantities to always be entered in the ingredient's native unit (e.g. if salt is stocked in kg, a recipe needing "5g of salt" must be entered as `0.005`).

**Agent Brief (paste-ready, for the real fix later):**
> Build proper unit conversion for recipe costing in `src/pages/restaurant/RecipeInventory.tsx`. Current state (2026-07-12 stopgap): the recipe-line Unit field is locked read-only to the ingredient's native stocked unit — safe, but forces awkward decimal quantities (e.g. `0.005` for "5g" when the ingredient is stocked in kg). Scope: a real per-ingredient-family unit-conversion table (g↔kg, mL↔L, and similar) so a recipe line can specify quantity in any compatible unit and have it correctly rescaled before multiplying by `cost_per_unit`. Decide whether conversions are a fixed global table (weight units, volume units) or need to be ingredient-specific (e.g. "1 whole egg ≈ 50g" isn't a unit conversion, it's a fixed reference weight) — the founder should confirm which real recipes in the platform actually need before over-building.

---

### BUG-021 — Bulk recipe-line insert fails atomically, leaving a $0-cost recipe
**Severity:** High · **Category:** Functional Bug / Data Integrity · **Status:** Fixed

**Root cause:** `restaurant_recipe_ingredients` has `UNIQUE(recipe_id, ingredient_id)`. Recipe lines were saved via a single batched `.insert(lines)` call — if any one line violated the unique constraint (trivially easy via "Add Line" if the same ingredient gets added twice), the **entire batch failed atomically**, leaving zero persisted lines. The failure surfaced only as a secondary toast shown *after* the "Recipe created" success toast, and the modal closed regardless — easy to miss entirely. The recipe list then correctly summed zero lines → displayed $0.00 cost, which is a downstream symptom of this bug, not a separate defect.

**Fix applied:** Switched the batched insert to `.upsert(lines, { onConflict: 'recipe_id,ingredient_id' })`, so a duplicate-ingredient line merges instead of failing the whole batch.

---

### BUG-022 — Waste log quantity inputs had no unit label
**Severity:** Low-Medium · **Category:** UX/Flow · **Status:** Fixed

Both waste-entry paths (the inline quick-log form and the "Log Waste" modal) showed the ingredient's unit only inside the ingredient dropdown's option text — the quantity input itself carried no unit indicator, so it was easy to lose track of whether you were logging kg, g, L, or units.

**Fix applied:** Inline form now shows the selected ingredient's unit as a suffix inside the quantity input; the modal's field label now reads "Quantity Wasted * (kg)" (or whatever unit applies) once an ingredient is selected.

---

## Index — Batch 2

**Batch 2 — Finance + Inventory sweep (2026-07-12)**, founder asked to keep testing, self-directed (no specific founder-reported symptom this round) via 4 parallel research forks covering Finance's remaining tabs, the generic Inventory page, RecipeInventory's remaining tabs, and the three standalone Supplier/PurchaseOrder/StockTransfer components. This batch specifically re-hunted for the two bug classes Batch 1 proved were real and recurring: missing `tenant_id` on inserts, and components bypassing `AppContext`'s shared state with independent stale fetches.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-023 | `expenses` insert missing `tenant_id` → 403 on every "Add Expense" — third instance of the exact same bug class as BUG-018/019 | High | Functional Bug | **Fixed** | `src/pages/Finance.tsx` |
| BUG-024 | P&L tab's COGS/operating-expense split keys off `category.type` string instead of the `is_cogs` boolean the Overview tab correctly uses — dormant divergence, would silently corrupt Gross Profit/EBITDA the moment a custom expense category is created | Medium | Data Integrity | **Fixed** | `src/pages/Finance.tsx` |
| BUG-025 | "Variant Intelligence" panel (attributes, cost-trend arrows, cost history) is fully decorative dead UI on every product for every tenant — no `product_variants` table was ever built, every product is synthesized into one fake empty variant | Medium | Cross-Vertical Conflict / Missing Feature | **Fixed** (2026-07-14) — judgment call: removed the misleading expansion panel rather than build real multi-variant tracking speculatively; real cost/price/stock stats (which were genuine, not fake) are untouched | `src/pages/Inventory.tsx` |
| BUG-026 | Plan product-count limits (`PLAN_LIMITS`, starter=50) are defined but never enforced anywhere — no warning, no block | Medium | Missing Feature | **Fixed** (2026-07-14) — hard-blocks at the cap, consistent with `FeatureGate.tsx`'s existing lock-and-upgrade pattern (no existing call-site to mirror; `isWithinLimit` had zero real consumers anywhere) | `src/components/AddProductModal.tsx` |
| BUG-027 | `suppliers` insert missing `tenant_id` → 403 on every new supplier, for every tenant — fourth instance of the same bug class | High | Functional Bug | **Fixed** | `src/components/SupplierManagement.tsx` |
| BUG-028 | `purchase_orders` insert missing `tenant_id` → 403 on every new PO, for every tenant — fifth instance of the same bug class | High | Functional Bug | **Fixed** | `src/components/PurchaseOrderManagement.tsx` |
| BUG-029 | `stock_transfers` insert missing `tenant_id` → 403 on every new transfer, for every tenant — sixth instance of the same bug class; also had no validation blocking a transfer to the same location | High | Functional Bug | **Fixed** | `src/components/StockTransferManagement.tsx` |
| BUG-030 | `PurchaseOrderManagement.tsx` runs its own independent `products`/`suppliers` fetch instead of `AppContext`'s shared `products` state | Medium | UX/Flow | **Fixed** (2026-07-14) | `src/components/PurchaseOrderManagement.tsx` |
| BUG-031 | PO receiving updated `products.stock_quantity` via read-then-write (race condition under concurrent stock mutations) | Medium | Data Integrity | **Fixed** | `src/components/PurchaseOrderManagement.tsx` |

**Verified working, no defect found:** RecipeInventory's ingredients, food-cost, suppliers, and purchase-orders tabs — all four came back clean, including confirming the food-cost tab shares the same `getRecipeCost()` as the recipes tab (so Batch 1's costing fix already covers it, no separate divergent calculation existed here). Generic `Inventory.tsx`'s core CRUD, stock calculations, and `AppContext` usage are also clean — its two findings (BUG-025, BUG-026) are feature-completeness gaps, not defects in what's built.

**The missing-`tenant_id` bug class is now confirmed in 6 places this session** (payroll, budgets×2, expenses, suppliers, purchase orders, stock transfers) — all in components that build an insert payload by hand instead of going through `AppContext`'s CRUD functions (which have always set it correctly). Worth flagging to whichever agent works on this codebase next: **any future hand-rolled `supabase.from(...).insert()` in this codebase should be treated as suspect until `tenant_id` is confirmed present** — this is clearly a systemic pattern-gap in how standalone/legacy components were built, not six unrelated bugs.

**All 6 "Fixed" items in this batch verified via `npm run typecheck` + `npm run lint` (zero errors, zero warnings).** Same caveat as Batch 1 — no live UI walkthrough, see updated "What to test next" below.

---

### BUG-023 — `expenses` insert missing `tenant_id`
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

Same root cause and same fix pattern as BUG-018/019: `expenses.tenant_id` has no default/trigger, RLS is purely tenant-scoped, and `ExpenseFormModal`'s insert payload never included it despite `currentTenant` already being available in the component. Likely the most-used of the three Finance money-flow actions found broken this session (day-to-day expense logging vs. periodic payroll/budget entries) — worth checking whether `expenses` data in `kits-dev` looks suspiciously sparse as a result.

**Fix applied:** added `tenant_id: currentTenant?.id` to the insert payload (kept out of the shared `update` payload, which doesn't need it).

---

### BUG-024 — P&L tab's COGS split uses the wrong signal
**Severity:** Medium · **Category:** Data Integrity · **Status:** Fixed

`expense_categories` has two separate columns meant to be kept in sync by whoever creates a category: `type` (a free string) and `is_cogs` (a boolean). The Overview tab correctly filters by `is_cogs`; the P&L tab instead bucketed expenses by the `type` string and treated `type === 'cogs'` as the COGS total. For all 34 seeded system categories today these happen to agree, so this produced no visibly wrong numbers yet — but there is no category-management UI anywhere in the app (confirmed), so the first custom category anyone creates with `is_cogs=true` but a different `type` (e.g. a "Delivery Commission" COGS line typed as `'marketing'`) would silently misclassify into Operating Expenses on the P&L tab while the Overview tab correctly kept it as COGS — two different Gross Profit/EBITDA numbers in the same file, from the same data.

**Fix applied:** `cogsTotal` now sums directly by the `is_cogs` flag; `expensesByType` (which drives the Operating Expenses breakdown) now excludes any `is_cogs` category regardless of its `type` string.

---

### BUG-025 — "Variant Intelligence" panel is decorative dead UI
**Severity:** Medium · **Category:** Cross-Vertical Conflict / Missing Feature · **Status:** Briefed

`products` is a flat table (one `price`/`cost`/`stock_quantity` per row — no `product_variants` table exists anywhere in the schema). `AppContext.tsx`'s `dbProductToFrontend` synthesizes every product into a `variants` array with exactly one hardcoded, permanently-empty entry (`attributes: {}`, `costHistory: []`). `Inventory.tsx`'s "N variants" expansion button, attribute list, cost-trend arrows, and cost-history table can therefore never show real data for any tenant, on any product, ever — the `Product`/`ProductVariant` TypeScript types support true multi-variant tracking, but the schema and mapping layer never implemented it. Not a broken feature so much as a feature that was never actually wired up behind UI that implies it exists.

**Agent Brief (paste-ready):**
> Resolve the dead "Variant Intelligence" UI in `src/pages/Inventory.tsx` (expansion panel ~lines 317-408) and `src/context/AppContext.tsx`'s `dbProductToFrontend` (~lines 271-290, synthesizes a fake single empty variant per product). This needs a founder scope decision first, not just a fix: (a) build a real `product_variants` child table (size/color/etc. attributes, per-variant stock and cost history) and wire the existing UI to it properly — real feature work, moderate scope; or (b) if true product variants (e.g. a T-shirt in 3 sizes as one product with variant rows) aren't on the near-term roadmap, strip the dead variant-expansion/cost-trend/cost-history UI entirely and simplify the `Product`/`ProductVariant` types to match the actual flat schema, removing the misleading affordance. Do not build (a) speculatively — confirm which direction with the founder before starting.

---

### BUG-026 — Plan product-count limits defined but never enforced
**Severity:** Medium · **Category:** Missing Feature · **Status:** Briefed

`PLAN_LIMITS` (starter=50 products) exists in `src/types/subscription.ts` and `isWithinLimit()` exists in `SubscriptionContext`, but neither is ever called from `Inventory.tsx` or the add-product flow — a starter (free) tenant can add unlimited products today with zero warning or block, undermining the tier-pricing model the whole platform is built around.

**Agent Brief (paste-ready):**
> Enforce the product-count plan limit in the product-creation flow. Context: `isWithinLimit('products', count)` already exists in `SubscriptionContext` and is used elsewhere in the app for other limits (confirm the established call pattern by finding an existing working example, e.g. employee-count enforcement) — this is a wiring gap, not new logic to build. Call it from wherever "Add Product" is submitted (`Inventory.tsx` / its add-product modal) before the insert, and add a `FeatureGate`-style warning banner in `Inventory.tsx` as a starter tenant approaches the 50-product cap. Decide with the founder whether hitting the cap should hard-block the insert or just nudge toward upgrading — check how other plan limits in the app currently behave (hard block vs. soft warning) and stay consistent with that existing pattern rather than inventing a new UX for this one.

---

### BUG-027 — `suppliers` insert missing `tenant_id`
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

Same bug class, fourth instance. `SupplierManagement.tsx` didn't even import `AppContext` — no tenant context was available in the component at all, so every "new supplier" submission has been failing with a 403 since this screen was built.

**Fix applied:** added `useApp()` import, destructured `currentTenant`, added `tenant_id: currentTenant?.id` to the insert payload.

---

### BUG-028 — `purchase_orders` insert missing `tenant_id`
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

Same bug class, fifth instance, same root cause as BUG-027 — `PurchaseOrderManagement.tsx` had no tenant context wired into its `NewPOModal` sub-component.

**Fix applied:** added `useApp()` import, destructured `currentTenant` inside `NewPOModal`, added `tenant_id: currentTenant?.id` to the `purchase_orders` insert. (`purchase_order_items`, the child line-item table, correctly has no `tenant_id` column at all — its RLS is enforced via a join through the parent PO's `tenant_id`, confirmed in migration `20260624_000049`, so no change needed there.)

---

### BUG-029 — `stock_transfers` insert missing `tenant_id`, plus no same-location validation
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

Same bug class, sixth instance — `StockTransferManagement.tsx` did already call `useApp()` (for `products`), it just never pulled `currentTenant` out of it. Also found and fixed in the same pass: no validation prevented submitting a transfer where the source and destination location were the same string.

**Fix applied:** added `currentTenant` to the existing `useApp()` destructure, added `tenant_id: currentTenant?.id` to the insert payload, added a same-location guard before submit.

---

### BUG-030 — `PurchaseOrderManagement.tsx` bypasses shared product/supplier state
**Severity:** Medium · **Category:** UX/Flow · **Status:** Briefed

Same pattern class as the 4 components found in Batch 1 (RolesAndPermissionsManager, TipsManagement, EnterpriseDashboard, UserProfileModal) — `PurchaseOrderManagement.tsx`'s main component runs its own independent `products`/`suppliers` queries on mount rather than reading `products` from `AppContext`'s already-correct shared state. Not fixed directly this round: `AppContext` doesn't carry `suppliers` at all (confirmed — that half of the duplication has no shared alternative to switch to), and the `products` half uses a narrower field shape (`id, name, sku, stock_quantity`) than `AppContext`'s full `Product` type, used across three sub-components in this file (`NewPOModal`, `ReceiveModal`, the main list) — de-duplicating cleanly means adapting field references throughout the file, not a one-line swap.

**Agent Brief (paste-ready):**
> Remove `PurchaseOrderManagement.tsx`'s independent `products` fetch (~line 547) in favor of `AppContext`'s shared `products` state (`useApp()`), so a newly-created product shows up in the PO product-picker without a page refresh — the same fix pattern already applied elsewhere this session for RolesAndPermissionsManager/TipsManagement/EnterpriseDashboard/UserProfileModal. This one needs care: `AppContext`'s `Product` type uses different field names than this file's local narrower `Product` interface (`id, name, sku, stock_quantity`) — trace every usage of the local `products` prop through `NewPOModal` and the main component's product-picker/list rendering before swapping, and either adapt field references or add a small local mapping layer. Leave the independent `suppliers` fetch as-is — `AppContext` doesn't carry suppliers at all, there's no shared state to switch to for that half.

---

### BUG-031 — PO receiving updated stock via read-then-write (race condition)
**Severity:** Medium · **Category:** Data Integrity · **Status:** Fixed

`ReceiveModal.handleReceive()` incremented `products.stock_quantity` by reading the current value, adding the received quantity in JavaScript, then writing the sum back — a classic TOCTOU race. Two concurrent stock mutations against the same product (another PO received at the same time, a sale, a stock transfer) could silently lose one of the updates. Not 100%-reproducible like the `tenant_id` bugs (needs genuine concurrency to trigger), but real, and directly affects inventory accuracy.

**The fix already existed in the repo for an unrelated reason**: migration `20260712_000078_product_stock_delta_rpc.sql` (built for the in-flight PowerSync offline-first work, confirmed live on `kits-dev` via a direct `pg_get_functiondef` query before use) defines `apply_product_stock_delta(p_product_id uuid, p_delta integer)` — an atomic `UPDATE products SET stock_quantity = stock_quantity + p_delta`, `SECURITY INVOKER` so existing RLS still applies normally.

**Fix applied:** replaced the read-then-write block with a single `supabase.rpc('apply_product_stock_delta', ...)` call per line item.

---

## Index — Batch 3

**Batch 3 — POS, CRM/Tips, Cash Drawer/EOD, Kitchen/Table Management (2026-07-12)**, founder said "keep going," self-directed toward the highest-remaining-risk areas: the core checkout/money flow (never yet audited) and the two screens most directly tied to BUG-004's cash-tracking scope. 4 parallel research forks.

**Safety note on the POS fork:** the harness flagged that its safety-classifier review step was unavailable for this fork's output. I independently re-verified its single most serious claim (BUG-035, below) directly against the live database before treating it as fact or acting on it — confirmed accurate. The rest of that fork's findings are code-citation-specific (exact file:line) and internally consistent with patterns already proven elsewhere this session, but were not independently re-verified line-by-line the way BUG-035 was — flagging this so the severity/confidence framing is honest, not because there's a specific reason to doubt them.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-032 | POS split-payment breakdown never persisted — any 2+-method sale is recorded as 100% a single method (`'cash'`), corrupting cash reconciliation and EOD reporting | High | Data Integrity | **Fixed** | `src/pages/POS.tsx`, `src/context/AppContext.tsx`, `src/powersync/AppSchema.ts`, `src/powersync/connector.ts` |
| BUG-033 | `addSale`'s local insert hardcodes `discount`/`tax_amount` to `0` — the `Sale` type never carried these fields, so the breakdown is permanently lost per sale (dormant today, nothing reads it back yet, but corrupts any future VAT/discount reporting built on this data) | High | Data Integrity | **Fixed** | `src/context/AppContext.tsx`, `src/pages/POS.tsx` |
| BUG-034 | Loyalty-points redemption is a client-side read-then-write (race condition) — same class as the already-fixed BUG-031 | Medium | Data Integrity | **Fixed** | `supabase/migrations/20260714_000083_loyalty_points_rpc.sql` |
| BUG-035 | **`POS.tsx` calls a non-existent `upsert_customer_points` RPC — loyalty points silently never accrue on any sale, for any tenant.** Independently confirmed live: no such function exists, and no trigger on `customer_points`/`point_transactions` exists either, contradicting `CLAUDE.md`'s migration-log claim of "earn/redeem triggers." | **Critical** | Functional Bug | **Fixed** | `supabase/migrations/20260714_000083_loyalty_points_rpc.sql`, `src/pages/POS.tsx`, `src/components/LoyaltyPanel.tsx` |
| BUG-036 | CRM Segments/Communications/Analytics tabs in `Customers.tsx` are fed hardcoded empty arrays — their backing tables were never applied to the live schema (only exist in an archived migration file) | Medium | Missing Feature | **Fixed** (2026-07-14) — judgment call: hidden rather than reviving an ~80-migration-stale archived schema blind | `src/pages/Customers.tsx` |
| BUG-037 | `TipsManagement.tsx`'s "today's tips" was a fabricated `revenue × 10%` guess, ignoring the real `table_orders.tip_amount_usd` collected at close-bill time | High | Data Integrity | **Fixed** | `src/pages/restaurant/TipsManagement.tsx` |
| BUG-038 | Tip distribution records are `localStorage`-only — never written to the database, lost on browser data clear, invisible across devices/terminals | High | Missing Feature / Data Integrity | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000089_tip_distributions.sql`, `src/pages/restaurant/TipsManagement.tsx` |
| BUG-039 | `restaurant_cash_sessions.denomination_breakdown` is 100% dead — folded into BUG-004 | High | Missing Feature | **Still open** — needs a real denomination-count UI, genuinely separate design work from the attribution fix | — |
| BUG-040 | Zero employee attribution (`opened_by`/`created_by`) on any cash session or movement — folded into BUG-004 | High | Data Integrity | **Fixed** (2026-07-14) | `src/pages/restaurant/CashDrawer.tsx` |
| BUG-041 | Cash-drawer reconciliation relies on manual re-entry, fully disconnected from actual `sales` records — folded into BUG-004 | High | Data Integrity | **Still open** — real fix needs linking `restaurant_cash_movements` to `sales`/`table_orders`, a bigger design question (auto-create movements on sale completion vs. reconcile after the fact) | — |
| BUG-042 | `EODReport.tsx` used raw UTC `toISOString()` instead of the project's own `toLocalDateString()` helper — same local-date bug class already fixed once elsewhere (commit `0c3da391`), live in the one report where late-night timing matters most | High | Data Integrity | **Fixed** | `src/pages/restaurant/EODReport.tsx` |
| BUG-043 | EOD report's food/argile/labor cost figures are flat percentage/hourly guesses, ignoring the real recipe-costing data this session already fixed in Batch 1 | Medium | Missing Feature | Briefed | — |
| BUG-044 | Three separate, never-reconciled "today's revenue" sources across EOD Report, Finance's P&L tab, and Cash Drawer | Medium | Data Integrity | Briefed | — |
| BUG-045 | Preset-bundle `$0`-priced charge rows have no visual grouping/context on Kitchen Display — **unconfirmed, needs a live order test** | Low-Medium | UX/Flow | Briefed (unconfirmed) | — |
| BUG-046 | `TableManagement.tsx` (manager/supervisor floor view) had no realtime subscription and no poll — stale until a manual page reload, unlike `WaiterInterface.tsx` which already has both | Medium | UX/Flow | **Fixed** | `src/pages/restaurant/TableManagement.tsx` |
| — | `CLAUDE.md` migration-log entries for `000025` (claimed "earn/redeem triggers" that don't exist — directly caused BUG-035 to go unnoticed) and `000040` (claimed "links restaurant_tables → locations," actually bridges menu items/sales to platform products — no table→location linking exists anywhere in the schema) were both stale | Low | Documentation Drift | **Fixed** | `CLAUDE.md` |

**Verified working, no defect found:** POS.tsx's tax-rate handling, discount/coupon math, stock-deduction-on-sale (deliberately race-safe by PowerSync design, not by luck — do not "fix" this), and `tenant_id` presence; Customers.tsx's loyalty leaderboard read path and all customer CRUD; the previously-memory-flagged "TipsManagement can't distinguish Waiter from other cashier-base-role custom roles" issue is **already fixed** (project memory has been corrected — see `reference_qa_bug_tracker.md`); KitchenDisplay's realtime sync, order-source coverage (dine-in/QR/accepted-delivery all correctly surface), and SLA timing; TableManagement's `tenant_id` presence and "Mark Available" button.

**Two items worth flagging to whoever works on PIN-auth/cash/loyalty next:** BUG-035 (loyalty) and BUG-004's sharpened scope (cash) both need new database work (RPCs, triggers, or columns) — neither was safe to fix in this pass per this project's standing "always confirm before applying migrations" discipline, and BUG-032/033 additionally touch `AppContext.addSale`'s PowerSync transaction, which another agent has active in-flight work on (confirmed via `git status` — `AppContext.tsx` itself has uncommitted, non-session changes; whoever picks up BUG-032/033 should coordinate rather than edit blind).

**One pre-existing, unrelated item observed, not touched:** `npm run lint` currently reports one error in `src/context/AppContext.tsx` (`'authMode' is assigned a value but never used`) from the other in-flight agent's uncommitted PowerSync work — not caused by this session, left alone per this file's own stated caution about not editing files mid-edit elsewhere. All of this session's own touched files lint clean individually.

**All 4 "Fixed" items in this batch verified via `npm run typecheck` (repo-wide, clean) and `npx eslint` scoped to this batch's touched files (clean) — full-repo `npm run lint` currently fails only on the pre-existing unrelated `AppContext.tsx` issue noted above.**

---

### BUG-032 — POS split-payment breakdown never persisted
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed (2026-07-14, bundled with BUG-033)

**Fix applied, coordinated with the in-flight PowerSync work as the brief required** — confirmed via `git status` that the offline-first migration referenced in the original brief has since landed on `main` (commit `90de3b24` and neighbors) and `AppContext.tsx`/`POS.tsx` are not currently under concurrent modification, so it was safe to proceed. Added a nullable `sales.payment_breakdown jsonb` column (migration `20260714_000084`) rather than a new child table, reusing the exact `JSON_COLUMNS` re-parse pattern `src/powersync/connector.ts` already established for `restaurant_order_items.modifiers`/`tenants.settings` — the local PowerSync schema stores it as `column.text` (JSON-encoded), synced back to Supabase as real `jsonb`. `POS.tsx`'s `completeSale()` now threads the real `SplitPayment[]` into the `Sale` object; `AppContext.addSale` only populates the column when a sale actually used 1+ payment methods (effectively always, but null-safe). `payment_method` still holds the collapsed single-value summary for simple sales — this column is the detailed truth for reconciliation.

`POS.tsx`'s `primaryMethod` only reflects the real payment method when a sale used exactly one method — any split payment (2+ methods) hard-defaults the persisted record to `'cash'` regardless of the actual mix (e.g. a $30-cash + $20-card sale is recorded as 100% cash). The real per-method breakdown (`payments: SplitPayment[]`) only exists in the ephemeral on-screen/printed receipt object — never written to the database. Directly overstates expected cash and understates card settlement in any downstream reconciliation.

**Agent Brief (paste-ready):**
> Persist POS split-payment breakdowns instead of collapsing to a single method. Context: `src/pages/POS.tsx` (~lines 362-394) builds a real `payments: SplitPayment[]` array for the receipt but never sends it to the database — `AppContext.addSale` only ever receives a single `primaryMethod` string, hard-defaulted to `'cash'` for any split sale. Scope: either a new `sale_payments` child table (`sale_id`, `method`, `amount_usd`) or a JSONB column on `sales`, then stop collapsing to a single method in `POS.tsx`'s checkout submission. **Coordinate with whoever owns the in-flight PowerSync offline-first work before editing `AppContext.addSale`** — its local-write transaction is actively being extended by another agent (confirmed via `git status` showing uncommitted changes there not from this session); this fix needs to land compatibly with that work, not blind.

---

### BUG-033 — Sale tax/discount breakdown hardcoded to zero
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed (2026-07-14, bundled with BUG-032)

**Fix applied:** widened the canonical `Sale` type (`src/context/AppContext.tsx`) with `tax?`/`discount?`/`payments?` fields; `POS.tsx`'s already-correctly-computed `tax`/`discounts` values now thread into `addSale` instead of the previous hardcoded `0, 0` in the local PowerSync `INSERT`. No migration needed for this half — `sales.discount`/`sales.tax_amount` already existed as real numeric columns, only ever written as literal zeros.

`AppContext.tsx`'s `addSale` (~lines 672-687) writes literal `0, 0` for `discount`/`tax_amount` on every local sale insert — not a wiring bug but a type-level gap: the canonical `Sale` TypeScript type never carried these fields. `POS.tsx` computes the real values correctly (~lines 356-358) but only folds them into the receipt object, never into what's passed to `addSale`. `sale.total`/`sale.subtotal` do correctly reflect the final taxed/discounted amount — customers aren't being charged wrong — but the breakdown itself is permanently zeroed, forever, per sale. Nothing currently reads these columns back out (checked Reports/Dashboard/P&L), so there's no visibly-wrong number today, but any future VAT-compliance or discount-reporting feature built against `sales.tax_amount`/`sales.discount` would be built on permanently-zeroed historical data.

**Agent Brief (paste-ready):**
> Widen the `Sale` type (`src/context/AppContext.tsx`) to carry real `tax`/`discount` fields and thread them from `POS.tsx`'s already-correct computed values into `addSale`'s insert, instead of the current hardcoded `0, 0`. Same PowerSync-coordination caution as BUG-032 — both touch the same `addSale` transaction, consider fixing together in one coordinated pass rather than two separate ones.

---

### BUG-034 — Loyalty-points redemption race condition
**Severity:** Medium · **Category:** Data Integrity · **Status:** Fixed (2026-07-14, bundled with BUG-035)

**Fix applied:** built alongside BUG-035 in the same migration, per the Agent Brief. Found a third instance of the same read-then-write race while fixing this — `LoyaltyPanel.tsx`'s manual "Adjust Points" flow (`AdjustPointsModal`) had the identical unsafe pattern, not separately numbered. One atomic `apply_customer_points_delta(p_customer_id, p_delta, p_type, p_sale_id, p_description)` RPC now backs all three call sites (POS earn, POS redeem, manual adjust) — see BUG-035's entry for full detail.

`POS.tsx` (~lines 434-449) reads `customer_points.points_balance`, computes the post-redemption balance in JavaScript, and writes it back — the same read-then-write race already found and fixed in Purchase Order stock receiving (BUG-031). Two near-simultaneous redemptions for the same customer could both read the same stale balance, allowing over-redemption. Needs genuine concurrency to trigger, less severe than BUG-035's guaranteed failure.

**Agent Brief (paste-ready):**
> Build an atomic points-delta RPC mirroring `apply_product_stock_delta` (migration `20260712_000078`, the pattern already used to fix BUG-031) — something like `apply_customer_points_delta(p_customer_id uuid, p_delta integer)` doing `UPDATE customer_points SET points_balance = points_balance + p_delta`. No equivalent currently exists (confirmed live). Bundle this with BUG-035's fix — both touch the same currently-nonexistent loyalty RPC layer, building them together avoids two separate migrations for the same subsystem.

---

### BUG-035 — Loyalty points never actually earned, for any sale, ever
**Severity:** Critical · **Category:** Functional Bug · **Status:** Fixed (2026-07-14)

**Fix applied, following the Agent Brief, bundled with BUG-034 as recommended:** built one atomic `apply_customer_points_delta(p_customer_id uuid, p_delta integer, p_type text, p_sale_id uuid DEFAULT NULL, p_description text DEFAULT NULL)` RPC (`SECURITY INVOKER`, matching `apply_product_stock_delta`'s established rationale — `customer_points`/`point_transactions`' existing RLS already permits any authenticated tenant member to read/write their own tenant's rows, so this only adds atomicity, not privilege) rather than three separate patches, since POS earn (this bug), POS redeem (BUG-034), and `LoyaltyPanel.tsx`'s manual "Adjust Points" flow (found while fixing this — same read-then-write race, never separately logged) were all hitting the same nonexistent/unsafe loyalty layer. Tier thresholds (bronze/silver/gold at 500/2000 lifetime points) are not a new decision — confirmed they already exist and are live in `LoyaltyPanel.tsx`'s `computeTier()`, so the RPC mirrors that exactly rather than inventing a second, divergent threshold; no founder confirmation needed on this point, despite the original brief flagging it as open. `POS.tsx`'s two call sites now surface failures via toast instead of failing silently (the original bug's root cause was compounded by zero error handling on a `void` fire-and-forget call). `npm run typecheck`/lint/build all clean. Migration applied to `kits-dev` with explicit founder confirmation, then independently re-verified live (`prosecdef=false`/`search_path=public` correct, and a direct no-session test call correctly raised `no_active_tenant` rather than silently succeeding or crashing).

**Independently verified live, not just trusted from the research fork** (see the batch-level safety note above for why): `POS.tsx` calls `supabase.rpc('upsert_customer_points', {...})` as a fire-and-forget `void` call with zero error handling after every sale to a loyalty-enrolled customer. Direct query against the live `kits-dev` database (`pg_proc`) confirms **no function named `upsert_customer_points` exists** — only PostgreSQL's built-in geometric `point_*` functions matched a broad search. A second direct query (`pg_trigger`) confirms **no trigger exists on `customer_points`, `customers`, or `point_transactions`** either, beyond a generic `updated_at` trigger on `customers`. `CLAUDE.md`'s description of migration `20260619_000025_loyalty.sql` claiming "earn/redeem triggers" does not match live reality — corrected in place, with a pointer to this entry.

**Net effect: loyalty points have likely never been earned on a single real sale, for any tenant, ever, silently.** This is a documented, marketed platform feature (CRM/loyalty per `CLAUDE.md`) that has been completely non-functional with no error surfaced to anyone.

**Agent Brief (paste-ready):**
> Build the missing `upsert_customer_points` RPC that `src/pages/POS.tsx` (line ~427) already calls and has been silently failing against on every sale. Scope: `upsert_customer_points(p_customer_id uuid, p_points_earned integer, p_sale_id uuid)` — atomic upsert into `customer_points` (create the row if the customer has never earned before), insert a corresponding `point_transactions` row with `type='earned'`. The intended earn-rate formula is already correctly configured and stored — `SystemSettings.tsx`'s `loyalty_enabled`/`loyalty_points_per_dollar` fields persist to real `tenants` columns and are already correctly read by `POS.tsx:424-425` to compute `pointsEarned` (confirmed in Batch 5) — the RPC just needs to actually apply that already-computed value, not derive its own formula. Confirm Bronze/Silver/Gold tier-threshold logic with the founder (migration `20260619_000025_loyalty.sql`'s design intent) before writing the function. Bundle with BUG-034's redemption-side atomic RPC in the same migration, since both close the same currently-nonexistent loyalty backend. Follow this project's standing discipline: confirm the exact migration with the founder by name before applying it to `kits-dev`.
>
> **Worth knowing when this gets fixed:** because the settings tab is fully functional and gives a "Saved" confirmation, a founder configuring loyalty today has no way to tell it's silently not working downstream — the setting itself isn't the broken link, only the RPC is (Batch 5 finding).

---

### BUG-036 — CRM tabs fed hardcoded empty data, backing tables never applied
**Severity:** Medium · **Category:** Missing Feature · **Status:** Briefed

`Customers.tsx`'s Segments/Communications/Analytics tabs unconditionally pass `segments={[]}`/`communications={[]}` — never fetched from anywhere — and the date-range picker's `onDateRangeChange` is a no-op. The backing tables (`customer_segments`, `communication_history`) exist only in `supabase/migrations/archive/20241227_crm_enhancement_schema.sql` — an archived migration, never applied to the live schema. This is fully-built frontend UI for a backend that was scaffolded, archived, and never shipped — the tabs currently render as if functional while doing nothing.

**Agent Brief (paste-ready):**
> Resolve `Customers.tsx`'s three dead CRM tabs (Segments/Communications/Analytics — components `CustomerSegmentation`/`CustomerCommunicationHistory`/`CRMAnalytics`). The backing schema (`customer_segments`, `communication_history`) exists only in the archived `supabase/migrations/archive/20241227_crm_enhancement_schema.sql`, never applied live. Needs a founder priority call, not a quick fix: (a) revive that migration (review it for staleness against the current schema first — it predates ~80 migrations of real work) and wire real fetches/writes, or (b) hide these three tabs until the feature is actually prioritized, since they currently mislead by rendering as if live.

---

### BUG-037 — Fabricated tip estimate replaced with real tip data
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed

`TipsManagement.tsx`'s "today's tips" figure was `revenue × 10%` — a hardcoded assumption with no basis in actual collected tips. A real field, `table_orders.tip_amount_usd`, is populated at close-bill time (`fn_close_restaurant_bill`) from actual staff/customer-entered tip amounts and was never read by this page at all — it invented a fictional pool and split *that* among staff instead of the real one. Also caught and fixed in the same pass: this function used the same raw-UTC-`toISOString()` date bug as BUG-042.

**Fix applied:** now sums real `tip_amount_usd` from today's `closed_at` `table_orders`, using `toLocalDateString()` for the date boundary.

---

### BUG-038 — Tip distributions never persisted to the database
**Severity:** High · **Category:** Missing Feature / Data Integrity · **Status:** Briefed

`TipsManagement.tsx`'s tip-split configuration and distribution records are `localStorage`-only (`tips_config_${tenantId}`, `tips_records_${tenantId}`) — confirmed no `tip_distributions`/similar table exists anywhere in the migration history; this was never wired to Supabase, not a regression. A real money-distribution record is therefore device-local, lost on browser data clear, and invisible to a manager logging in from a different terminal.

**Agent Brief (paste-ready):**
> Replace `TipsManagement.tsx`'s `localStorage`-only tip records with a real tenant-scoped table. Scope: new `tip_distributions` table (tenant_id, date, algorithm used, total amount, per-employee breakdown — likely a JSONB or child-table split), with real inserts replacing the current `recordTips()` localStorage writes (~lines 203-219). Standard tenant-scoped RLS, same pattern as every other table in this codebase.

---

### BUG-042 — see full detail folded above (EOD local-date/UTC bug)
Covered in the Index table and fix summary above — same root-cause class as the general local-date guidance already established in this codebase (commit `0c3da391`).

---

### BUG-043 — EOD cost figures ignore real recipe-costing data
**Severity:** Medium · **Category:** Missing Feature · **Status:** Briefed

`EODReport.tsx`'s "Est. Food Cost" is `foodRevenue × 0.28` and "Est. Argile Cost" a flat 15% — neither touches `getRecipeCost()` / `restaurant_recipe_ingredients`, despite that calculation being real and accurate as of this session's Batch 1 fix (BUG-020/021). Labor cost is `totalHours × 8`, explicitly labeled in the UI as an "$8/hr placeholder — configure in Settings," with no evidence a real per-employee wage setting exists to back that claim.

**Agent Brief (paste-ready):**
> Replace `EODReport.tsx`'s flat-percentage food/argile cost estimates with real data — sum actual `getRecipeCost()`-derived costs for the day's sold menu items (same function already fixed and verified in Batch 1 of `docs/qa-bug-tracker.md`) instead of `revenue × 0.28`. For labor cost, either build the real per-employee wage setting the current UI placeholder implies should exist, or keep the placeholder but make that far more visually explicit than a small caption (a founder reading this report at 2am shouldn't mistake a placeholder for a real number).

---

### BUG-044 — Three disconnected revenue sources
**Severity:** Medium · **Category:** Data Integrity · **Status:** Briefed (systemic observation)

EOD Report derives today's revenue from `restaurant_order_items` + `restaurant_argile_sessions`; Finance's P&L tab derives it from the `sales` table; Cash Drawer derives its "expected total" from manually-entered cash movements (BUG-041). No cross-check exists between any of the three — a real discrepancy between them would go unnoticed indefinitely.

**Agent Brief (paste-ready):**
> Design (with the founder, before building) a single canonical "today's revenue" source that EOD Report, Finance's P&L tab, and Cash Drawer all read from or reconcile against — likely the `sales` table, since Finance already treats it as canonical. This is a design decision, not a one-file fix; touches three separate reports/pages. Consider building it alongside BUG-004's broader cash-tracking rework and BUG-032/033's POS data-completeness fixes, since all four are facets of the same underlying "what actually happened financially today" question.

---

### BUG-045 — Bundle charge-rows unconfirmed on Kitchen Display
**Severity:** Low-Medium (unconfirmed) · **Category:** UX/Flow · **Status:** Briefed

`KitchenDisplay.tsx` has zero references to `bundle_id` anywhere. Preset-bundle course-component rows (real `menu_item_id`, `$0`-priced) probably render fine as ordinary items, but the separate `menu_item_id = NULL` charge row sharing the same `bundle_id` (migration `20260708_000062`) wasn't confirmed to be filtered out of KDS by status — if it can carry a kitchen-relevant status, it would show as a mystery blank/`$0.00` item. **Not confirmed as a real bug** — flagging for a live-order test with an active bundle before treating as verified.

**Agent Brief (paste-ready, verification step first):** place a real preset-bundle order (staff-side via `BundleOrderModal` or QR via `QRBundleDetail.tsx`) and check `KitchenDisplay.tsx` for a stray `$0.00`/blank line item corresponding to the bundle's charge row. If confirmed, filter charge rows (`menu_item_id IS NULL AND bundle_id IS NOT NULL`) out of the KDS query or give them distinct "bundle" styling instead of rendering as an ordinary item.

---

## Index — Batch 4

**Batch 4 — QR customer menu, Reports/Dashboard, Reservations/Waitlist/Events, Delivery (2026-07-12)**, founder said "continue," self-directed. 4 parallel research forks. Two areas (QR menu, Reports/Dashboard) came back essentially clean — a good sign for those subsystems, called out explicitly rather than padded with non-findings.

**⚠️ Security finding this batch (BUG-056) — founder approved the fix, applied same-session.** Independently verified against the live database (not just trusted from the research fork): the webhook signing secret for delivery integrations (Toters/Talabat/Zomato/Careem) was readable by any authenticated tenant session, including a low-privilege cashier — no role check existed in the RLS policy, and the frontend displayed it in cleartext behind a show/hide toggle. Founder confirmed via explicit go-ahead; fix applied and independently re-verified live — see the full entry below.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-047 | No live order-status tracking after QR checkout — a static one-time success screen, no way for a customer to know if/when their order is confirmed or ready | Medium-High | Missing Feature | Briefed | — |
| BUG-048 | `Reservations.tsx`'s seating flow is 4 sequential, un-transactioned client-side writes (race-prone, inconsistent state on partial failure) — `Waitlist.tsx` already does this correctly via an atomic RPC | High | Data Integrity | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000086_atomic_reservation_seating.sql`, `src/pages/restaurant/Reservations.tsx` |
| BUG-049 | `Reservations.tsx`'s new-reservation date default used raw UTC `toISOString()` — defaults to yesterday for ~2-3 hrs after Lebanon local midnight | Medium | Data Integrity | **Fixed** | `src/pages/restaurant/Reservations.tsx` |
| BUG-050 | `EventsManager.tsx`'s "Upcoming Events" count and "This Month's Confirmed Revenue" — the two numbers a founder actually looks at — used the same raw-UTC date bug, live on the founder-facing dashboard | High | Data Integrity | **Fixed** | `src/pages/restaurant/EventsManager.tsx` |
| BUG-051 | Events have zero link to `restaurant_tables`/sections — booking a room for a private event does nothing to block those tables from regular walk-in/reservation/waitlist seating | Medium | Missing Feature / Cross-Vertical Conflict | Briefed | — |
| BUG-052 | `Reservations.tsx` and `EventsManager.tsx` had no realtime subscription or polling — stale until manual reload, same pattern already fixed in `TableManagement.tsx` | Medium–High | UX/Flow | **Fixed** | `src/pages/restaurant/Reservations.tsx`, `src/pages/restaurant/EventsManager.tsx` |
| BUG-053 | `complete_delivery_order` (DB function) hardcodes `discount=0, tax_amount=0` for every delivery sale — same bug class as BUG-033, now confirmed in a second independent code path | High | Data Integrity | **Partially fixed** (2026-07-14) — see entry, real fix needs webhook payload research | `supabase/migrations/20260714_000085_delivery_order_completion_fixes.sql` |
| BUG-054 | Delivery sales have zero employee attribution (`sales.employee_id` never set), unlike dine-in sales | Medium | Data Integrity | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000085_delivery_order_completion_fixes.sql` |
| BUG-055 | `complete_delivery_order` has no idempotency guard — a double-click (or flaky-network retry) on "Mark Picked Up" can insert two `sales` rows for one delivery order | Medium-High | Data Integrity | **Re-assessed and fixed** (2026-07-14) — the double-click race doesn't actually exist, see entry | `supabase/migrations/20260714_000085_delivery_order_completion_fixes.sql` |
| BUG-056 | **Delivery webhook signing secrets were readable by any tenant role, including a low-privilege PIN-logged cashier** — RLS policy had no role check; frontend showed the secret in cleartext | High | Security/RBAC | **Fixed** | `supabase/migrations/20260712_000080_restrict_delivery_webhook_secret_access.sql`, `src/pages/restaurant/DeliveryIntegrations.tsx`, `src/constants/restaurantNavAccess.ts` |

**Verified working, no defect found:** the entire QR customer menu — all 4 RPCs confirmed live, no client-trust/security issues (price and tenant resolution are correctly server-side), cart/bundle math correct, no tenant_id or date bugs. Reports.tsx and Dashboard.tsx — no local-date bugs, no stale-fetch issues, no dead widgets (two minor cross-references noted: Reports.tsx is a 4th revenue-calc source worth folding into BUG-044's eventual fix; Dashboard's stock numbers route through the same fragile fake-variant layer as BUG-025, currently correct but fragile). Delivery order-state gating and 30s polling. All `tenant_id` patterns across every file this batch — clean, zero new instances of the 6x-recurring bug class.

**Note on `npm run typecheck`:** currently fails, but entirely on the other in-flight agent's uncommitted offline-PIN-auth work (`src/offlineAuth/` — untracked, an internal type mismatch in their own new `CachedCredential` usage; plus a missing `argon2id` package that's in `package.json` but not yet installed). Not caused by this session, not touched. All 3 files fixed this batch (`Reservations.tsx`, `EventsManager.tsx`) lint clean individually (`npx eslint`, zero output).

---

### BUG-047 — No live order-status tracking after QR checkout
**Severity:** Medium-High · **Category:** Missing Feature · **Status:** Briefed

`QROrderSuccess.tsx` is a one-time static screen — a hardcoded "15-20 minutes" estimate for direct orders, a generic "your waiter will confirm it shortly" for pending/waiter-confirm orders — with no polling or realtime subscription anywhere in the QR flow. Once dismissed, the customer has zero further visibility into their order. This is real committed baseline functionality per the platform's own roadmap (`docs/superpowers/specs/2026-07-11-platform-roadmap-design.md`'s Track 6, Tier 1 "order-status" piece) that doesn't appear to have shipped.

**Agent Brief (paste-ready):**
> Build live order-status tracking for QR customers, per Track 6's roadmap commitment (`docs/superpowers/specs/2026-07-11-platform-roadmap-design.md`). Context: `QROrderSuccess.tsx` is currently a static one-shot screen with no realtime awareness. Scope: a `postgres_changes` subscription on the customer's `table_orders`/`restaurant_order_items` rows (same realtime pattern already proven working in `ArgileStation.tsx`'s argile-events subscription and `WaiterInterface.tsx`'s call-waiter subscription), surfaced as a persistent tracking state (preparing → ready → served, or confirmed/rejected for pending waiter-confirm orders) rather than a one-shot success screen.

---

### BUG-048 — Reservations seating flow is non-atomic and race-prone
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed (2026-07-14)

**Fix applied, following the Agent Brief exactly:** built `fn_seat_reservation(p_reservation_id, p_target_table_id)`, mirroring `fn_seat_waitlist_party()`'s pattern line-for-line — `SELECT ... FOR UPDATE` on both the reservation and the target table (serializes any concurrent seating attempt against the same table rather than allowing a check-then-act gap), validates `confirmed` is the only seatable status (matching `Reservations.tsx`'s own `nextStatuses` state machine — `pending` must go through `confirmed` first, it never seats directly), then performs the insert/update/update atomically. `Reservations.tsx`'s `seatReservation()` now calls this RPC instead of 4 sequential writes. `npm run typecheck`/lint clean. Migration applied to `kits-dev`, independently re-verified live.

---

### BUG-051 — Events have no link to actual tables, real double-booking risk
**Severity:** Medium · **Category:** Missing Feature / Cross-Vertical Conflict · **Status:** Briefed

`EventsManager.tsx`'s `room_section` is a free-text/select label with zero FK or reference to real `restaurant_tables` rows. Booking "Main Dining Room" for a private event does nothing to prevent that section's tables from being seated by a walk-in, a reservation, or the waitlist during the event window — two F&B booking subsystems built independently, unaware of each other.

**Agent Brief (paste-ready):**
> Decide with the founder whether Events should block regular seating on the tables/sections they use (link `EventsManager.tsx`'s `room_section` to real `restaurant_tables`/`section` values, and have the seating paths — Reservations' fix from BUG-048, Waitlist's RPC, WaiterInterface — check for an active event blocking that table/section before allowing a seat), or whether this is an acceptable, deliberate limitation for now (events are typically pre-planned with staff awareness, lower real-world collision risk than it sounds). This is a scope call, not a mechanical fix — don't build the table-linking without confirming it's actually wanted first.

---

### BUG-053 — Delivery sales lose tax/discount breakdown (DB-function-level recurrence of BUG-033)
**Severity:** High · **Category:** Data Integrity · **Status:** Partially fixed (2026-07-14)

**Investigated deeper than the original framing assumed — this is not the same shape as BUG-033.** BUG-033 had real, already-computed tax/discount values sitting unused; this one doesn't. Independently confirmed live: `restaurant_delivery_orders` has no `discount_usd`/`tax_usd` columns at all, and `inject_delivery_order` (the webhook intake RPC) doesn't even capture `subtotal_usd` from the platform payload — only a lump `total_usd`. There is no real tax/discount data anywhere upstream to thread through today; capturing it would require per-platform (Toters/Talabat/Zomato/Careem) webhook payload research, genuinely separate, larger, less certain scope than this pass.

**Fix applied (2026-07-14), scoped honestly to what's actually buildable right now:** added nullable `discount_usd`/`tax_usd` columns to `restaurant_delivery_orders` and updated `complete_delivery_order` to carry them through via `COALESCE(...,0)` instead of a hardcoded literal `0` — so the pipe is correct and ready the moment webhook intake is ever extended to populate them. `discount`/`tax_amount` on the resulting sale remain effectively `0` today; that's an honest reflection of missing source data, not a remaining defect in this function. **Real completion of this bug requires a follow-up: research each delivery platform's actual webhook payload shape and extend `inject_delivery_order` + the `delivery-webhook` edge function to capture subtotal/tax/discount if the platform provides it.**

---

### BUG-054 — No employee attribution on delivery sales
**Severity:** Medium · **Category:** Data Integrity · **Status:** Fixed (2026-07-14)

**Fix applied:** `complete_delivery_order` now resolves `employees.id` via `employees.user_id = auth.uid()` (Track 1's employee↔tenant_user linkage) and stamps `sales.employee_id`, matching how dine-in sales are attributed via `finalize_restaurant_order`. Falls back to `NULL` (never blocks completion) if no employee row is linked.

---

### BUG-055 — Delivery order completion has no idempotency guard
**Severity:** Medium-High · **Category:** Data Integrity · **Status:** Re-assessed and fixed (2026-07-14)

**The double-click data-integrity risk as originally described doesn't actually exist — independently verified before treating this as a real race.** `complete_delivery_order` already does `SELECT ... FOR UPDATE` on the delivery-order row before checking status. A genuinely concurrent second call blocks on that lock until the first transaction commits, then sees `status <> 'ready'` — it was already impossible to insert two `sales` rows via a true double-click, contrary to the original finding. The real (smaller) gap: both a concurrent double-click *and* a sequential retry-after-a-dropped-response hit a hard `RAISE EXCEPTION` instead of gracefully succeeding.

**Fix applied:** if `status = 'picked_up'` when the function is called, it now looks up and returns the already-created sale instead of erroring — covering both the true-concurrent case (the blocked second caller now resolves gracefully once unblocked) and the sequential-retry case, with one change. No frontend change needed; `DeliveryOrders.tsx`'s call site doesn't use the returned value, so this is fully backward-compatible.

---

### BUG-056 — Delivery webhook secrets readable by any tenant role
**Severity:** High · **Category:** Security/RBAC · **Status:** Fixed (founder-approved, applied same-session)

**Independently re-verified against the live database, not just trusted from the research fork** (same discipline as BUG-035): `restaurant_delivery_integrations`'s RLS policy (`tenant_delivery_integrations`) was confirmed live as `FOR ALL USING (tenant_id = current_tenant_id())` — no role check whatsoever. The frontend route `/restaurant/delivery` was gated to `['owner','admin','manager','cashier']`, and `DeliveryIntegrations.tsx` displayed the webhook signing secret in a cleartext-toggleable field. Since the RLS policy had no role check either, any authenticated tenant session — including a low-privilege PIN-logged cashier — could read the secret directly via the API regardless of frontend route gating.

**Why this mattered:** a leaked webhook signing secret lets an attacker forge signed webhook payloads impersonating a delivery platform — fake orders, potential downstream abuse of `accept_delivery_order`/any auto-accept logic.

**Fix applied, founder-approved before any production change** (per this project's established discipline — named the specific change, asked, got explicit "yes, apply it now" before touching `kits-dev`):
1. `supabase/migrations/20260712_000080_restrict_delivery_webhook_secret_access.sql` — dropped the role-blind `tenant_delivery_integrations` policy, replaced with `owner_manager_delivery_integrations` (`FOR ALL`, tenant-scoped **and** `current_user_role() IN ('owner','admin','manager')`). Applied directly to `kits-dev` via migration, then independently re-queried `pg_policies` to confirm the live policy text matches exactly.
2. `src/constants/restaurantNavAccess.ts` — removed `cashier` from `/restaurant/delivery` (the integrations settings page) only. `/restaurant/delivery-orders` (the day-to-day order queue, doesn't touch this table) is untouched — cashiers still need that for normal operations.
3. `src/pages/restaurant/DeliveryIntegrations.tsx` — the secret is no longer re-displayed in full, even to owner/admin/manager, once saved: shows only `••••••••••••1234` (last 4 characters) with a "Change" button that opens a blank input for entering a new value. Saving without clicking "Change" leaves the existing DB value untouched (no accidental overwrite with the masked placeholder).

Also checked `MultiBranchHub.tsx` (the only other reader of this table) before applying — already route-gated to `owner`/`admin` only, so the RLS restriction doesn't break it.

---

## Index — Batch 5

**Batch 5 — Employees roster/Onboarding, Admin Panel, System/Profile Settings, Menu/Multi-Branch/Restaurant Settings (2026-07-12)**, founder said "keep going," self-directed. 4 parallel research forks. This batch hit the platform's highest-privilege screen (Admin Panel) and found a real gap in its second-factor gate — fixed same-session, no confirmation needed (pure frontend logic, not a DB/RLS change).

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-057 | Admin Panel's PIN gate only gated the *display* of cross-tenant data, not the *fetch* — the full tenant list loaded into React state (inspectable via DevTools) before the PIN was entered | High | Security/RBAC | **Fixed** | `src/pages/AdminPanel.tsx` |
| BUG-058 | `MenuManagement.tsx`'s "Send to KDS" quick-order path created `table_orders`/`restaurant_order_items` missing `tenant_id` — 7th confirmed instance of this session's recurring bug class | High | Functional Bug | **Fixed** | `src/pages/restaurant/MenuManagement.tsx` |
| BUG-059 | Employees.tsx had a "View performance report" button with no `onClick` handler at all | Medium | UX/Flow | **Fixed** | `src/pages/Employees.tsx` |
| BUG-060 | Onboarding's country→Supabase-region map sent UAE/Saudi Arabia/Kuwait to `us-east-1`, contradicting its own comment ("all MENA closest to eu-central-1") — a real, lasting data-residency/latency issue for any Gulf tenant's later-provisioned dedicated database | Medium-High | Functional Bug | **Fixed** | `src/components/OnboardingWizard.tsx` |
| BUG-061 | Two disconnected menu-item cost sources — `MenuManagement.tsx`'s manually-typed `cost_price_usd` vs. the real, now-accurate recipe-costing system (Batch 1 fixes) — nothing reconciles or shows them together | Medium | Data Integrity / Cross-Vertical Conflict | Briefed | — |
| BUG-062 | Branch-level menu availability/price overrides may be entirely unwired downstream — written and read only by two management screens, zero references found in the QR menu/POS/Waiter ordering paths (**unconfirmed**, needs a trace of `get_public_menu()`) | Medium-High | Missing Feature | **Confirmed, disclaimer added** (2026-07-14) — real wiring blocked on `restaurant_tables` having no `branch_id` column at all, a larger separate task | `src/pages/restaurant/MenuManagement.tsx` |
| BUG-063 | `RestaurantSettings.tsx` and `SystemSettings.tsx` both write to the shared `tenants` table independently — latent last-write-wins risk if their field sets ever overlap (unconfirmed whether they currently do) | Low-Medium | Cross-Vertical Conflict | **Investigated, no action needed** (2026-07-14) — confirmed genuinely disjoint field sets, no overlap. **Real bug found along the way, fixed**: `RestaurantSettings.tsx` was writing `tenant_slug` (dropped by migration 000061) instead of `slug` — every QR/digital-menu settings save has likely been erroring out | `src/pages/restaurant/RestaurantSettings.tsx` |
| BUG-065 | Three POS "business policy" settings (default payment method, require-customer-on-sale, auto-print receipt) save to `localStorage` only — `POS.tsx` never reads any of the three keys, so toggling them does nothing | High | Missing Feature | **Fixed** (2026-07-14) | `src/pages/SystemSettings.tsx`, `src/pages/POS.tsx`, `src/components/SplitPaymentModal.tsx` |
| BUG-066 | Tenant deletion ("Danger Zone") is an immediate, fully-cascading, irreversible delete of all business data, gated only by typing the business name on the same screen — no re-authentication, no grace period | High | Data Integrity / Safety Design | **Fixed** (2026-07-14) — judgment call: option (b), password re-authentication, chosen over a full soft-delete/grace-period (bigger, separate scope: schema change + purge job + restore UI) | `src/pages/SystemSettings.tsx` |

**Verified working, no defect found:** Admin Panel's access control (no hardcoded-email regression — the 2026-07-11 `is_kits_staff()` identity-separation fix held), all 5 admin RPCs confirmed live, write actions (plan changes, provisioning) correctly click-gated not effect-triggered; Employees.tsx and OnboardingWizard.tsx `tenant_id` patterns (clean); OnboardingWizard's industry-aware copy still correctly wired; MultiBranchHub.tsx's cross-branch aggregation correctly tenant-scoped; ProfileSettings.tsx's password-change (re-verifies via real `signInWithPassword`, not client-side comparison) and MFA enrollment (real Supabase TOTP flow) — fully correct and secure; loyalty-rate settings in `SystemSettings.tsx` persist correctly and are correctly read by `POS.tsx` (the only broken link in that chain is the already-logged BUG-035 missing RPC — noted there, not a new finding); no secret-exposure pattern anywhere in Settings (checked against the BUG-056 lens).

**Housekeeping:** flagged a stale comment in `AdminPanel.tsx` (line 94, describes the old hardcoded-email pattern) as Low/Documentation Drift — not worth a separate fix pass on its own, left as-is.

**All 4 "Fixed" items this batch verified via `npm run typecheck` (clean) and `npx eslint` on all touched files (zero output, zero warnings).**

---

### BUG-057 — Admin Panel's PIN gate didn't actually gate the data fetch
**Severity:** High · **Category:** Security/RBAC · **Status:** Fixed

**Independently re-verified before fixing**, same discipline as BUG-035/056: read the exact `useEffect` at fault myself. `AdminPanel.tsx` has two independent identity checks — the gate effect (shows/hides the PIN-entry UI) and a second, separate effect that calls `verifyAdmin()` then `fetchTenants()` (the full cross-tenant list via `admin_list_tenants()`) with a dependency array of `[verifyAdmin, fetchTenants]` — **not including `gateUnlocked`**. Per React's Rules of Hooks, all `useEffect`s are declared unconditionally before any early return in the render function, so this effect fires on mount regardless of what the PIN gate's JSX actually displays. Net effect: the instant any real KiTS-staff session loaded this page, the full cross-tenant tenant list was fetched into React state — inspectable via React DevTools — **before** the PIN was entered. Only the *rendering* was gated, not the *data*. This defeats the PIN's own stated purpose (an inline comment already described "never auto-unlock" as the intent) — exactly the shared/unlocked-device threat model a second factor exists for.

**Fix applied:** the fetch effect now checks `if (!gateUnlocked) return;` before calling `verifyAdmin()`/`fetchTenants()`, and `gateUnlocked` was added to its dependency array — the RPC call itself, not just its display, now waits for PIN confirmation.

---

### BUG-058 — MenuManagement's quick-order path missing tenant_id (7th instance)
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

`MenuManagement.tsx`'s `WaiterOrderPanel` sub-component (a secondary "pick a table, add items, Send to KDS" quick-order flow embedded in the Menu Management page, separate from the normal Waiter/POS flow) created `table_orders` and `restaurant_order_items` rows with no `tenant_id` — same root cause as BUG-018/019/023/027/028/029, now the 7th confirmed instance. The sub-component never destructured `currentTenant` from `useApp()` at all (a different sub-component in the same file did, at a different scope — the bug was a missing import/destructure in this specific closure, not a repo-wide pattern gap in this file).

**Fix applied:** added `const { currentTenant } = useApp();` to `WaiterOrderPanel`, added `tenant_id: currentTenant?.id` to both the `table_orders` and `restaurant_order_items` insert payloads.

---

### BUG-059 — Dead "View performance report" button
**Severity:** Medium · **Category:** UX/Flow · **Status:** Fixed

`Employees.tsx`'s employee card had a "View performance report" button with no `onClick` handler at all — pure decoration, promising a detail view that doesn't exist (the card already inlines sales/commission/transaction stats above it). Removed rather than stubbed — no deeper report view exists to wire it to, and a real one would be new feature work, not a quick fix.

**Fix applied:** removed the non-functional button; kept the "Performance snapshot" label over the stats that are already correctly shown inline.

---

### BUG-060 — Onboarding sent Gulf tenants to the wrong Supabase region
**Severity:** Medium-High · **Category:** Functional Bug · **Status:** Fixed

`OnboardingWizard.tsx`'s `COUNTRY_REGION` map is used to set `preferred_region` on a new tenant — a real field, confirmed surfaced in `AdminPanel.tsx` alongside the platform's per-business dedicated-Supabase-database provisioning workflow. The map's own comment states "all MENA closest to eu-central-1," but the map itself sent UAE, Saudi Arabia, and Kuwait to `us-east-1` — 3 of 6 listed countries directly contradicting the stated intent. Not cosmetic: if a KiTS admin later provisions a Gulf tenant's dedicated database following this field, their database lands in North Virginia instead of Europe — a real, lasting latency and data-residency issue for that customer, not a display bug.

**Fix applied:** corrected all three mismatched entries to `eu-central-1`, matching the code's own documented intent. Left a comment noting that if eu-central-1 turns out not to actually be nearest for the Gulf specifically, that's a provisioning-strategy call for whoever owns that system — not something to silently re-diverge on again.

---

### BUG-061 — Two disconnected menu-item cost sources
**Severity:** Medium · **Category:** Data Integrity / Cross-Vertical Conflict · **Status:** Briefed

`MenuManagement.tsx`'s `cost_price_usd` is a plain, manually-typed number on `restaurant_menu_items`, entirely disconnected from `getRecipeCost()`/`restaurant_recipe_ingredients` — the recipe-costing system this session already found and fixed real bugs in (BUG-020/021, now accurate). Nothing reconciles the two or shows them side by side, so a manager could be looking at a stale hand-typed cost while the linked recipe's real cost has since diverged — and recipe costing is now the more trustworthy of the two.

**Agent Brief (paste-ready):**
> Reconcile `MenuManagement.tsx`'s manual `cost_price_usd` field with the real recipe-costing system (`getRecipeCost()`, `restaurant_recipe_ingredients`, both already fixed and accurate as of this session's Batch 1). Scope: for any menu item linked to a recipe (`restaurant_menu_item_recipes`), either auto-populate/override `cost_price_usd` from `getRecipeCost()` rather than accepting a manual value, or at minimum display both numbers side by side with a "differs from recipe cost" warning when they diverge. Confirm with the founder which menu items are expected to always have a linked recipe vs. genuinely need a manual cost (e.g., a simple bottled drink with no recipe) before deciding whether to make recipe-cost authoritative outright.

---

### BUG-062 — Branch-level menu overrides possibly unwired downstream (unconfirmed)
**Severity:** Medium-High (unconfirmed) · **Category:** Missing Feature · **Status:** Briefed

`restaurant_menu_items_branch_overrides` (per-branch availability/price overrides, migration `000044`) is written and read only by `MenuManagement.tsx` and `MultiBranchHub.tsx` — a repo-wide grep found zero references anywhere in the QR customer menu, POS, or WaiterInterface. If those real ordering paths don't independently apply these overrides, a manager configuring "this item unavailable at Branch B" would have zero real effect on what customers or staff actually see. **Not confirmed** — needs a trace of `get_public_menu()`'s live definition (already read once by an earlier fork this session) to settle definitively.

**Agent Brief (paste-ready):**
> First confirm whether `restaurant_menu_items_branch_overrides` is actually applied anywhere real customers/staff order from — read `get_public_menu()`'s live definition (`pg_get_functiondef`, project `pytndxjeznhhyycjasep`) and check `qr_place_order()`, `POS.tsx`, and `WaiterInterface.tsx`'s menu-fetching queries for any join/filter against this table. If confirmed unwired: either wire branch overrides into the real ordering paths (moderate scope — every menu-read path needs a branch-aware filter), or, if multi-branch menu differentiation isn't actually a near-term priority, consider hiding the override UI in `MenuManagement.tsx`/`MultiBranchHub.tsx` until it's wired, same reasoning as the dead-UI fixes already applied elsewhere this session.

---

### BUG-063 — Two settings pages independently write the same `tenants` row (unconfirmed overlap)
**Severity:** Low-Medium (unconfirmed) · **Category:** Cross-Vertical Conflict · **Status:** Briefed

`RestaurantSettings.tsx` and `SystemSettings.tsx` both run independent partial-update calls against the shared `tenants` table. Not confirmed to target overlapping columns — plausibly scoped to different specific fields — but two settings pages able to partial-update the same row is a latent last-write-wins risk if their field sets ever do overlap.

**Agent Brief:** diff the exact column sets each page's `.update()` calls touch on `tenants`. If disjoint, no action needed — just leave this note as a caution for future settings-page additions. If overlapping, decide which page is authoritative for the shared fields or consolidate.

---

### BUG-065 — POS business-policy settings are dead, localStorage-only
**Severity:** High · **Category:** Missing Feature · **Status:** Briefed

`SystemSettings.tsx`'s POS Behaviour tab writes `pos_default_payment`/`pos_require_customer`/`pos_auto_print_receipt` to `localStorage` only — confirmed via grep, zero references to any of the three keys anywhere in `POS.tsx` or elsewhere in `src/`. An owner can toggle "Require customer on sale," get a "Saved" confirmation toast, and it enforces nothing at checkout, for any cashier, on any terminal. These read as tenant-wide business rules an owner would reasonably expect enforced platform-wide — unlike `NotificationSettings.tsx`'s push-notification prefs, which are correctly localStorage-backed because they genuinely are per-device. Same dead-UI pattern already found twice this session (BUG-025 Inventory "Variant Intelligence," BUG-036 dead CRM tabs), now a third confirmed instance.

**Agent Brief (paste-ready):**
> Wire `SystemSettings.tsx`'s three POS Behaviour settings (`pos_default_payment`, `pos_require_customer`, `pos_auto_print_receipt`, currently `handleSavePos()` writing to `localStorage` only) onto the `tenants` table (a settings JSONB column, matching the pattern `businessForm`/`financialForm` already use elsewhere in this file) instead of `localStorage`, and have `POS.tsx` actually read and enforce them at checkout — default payment method pre-selected, a required customer-selection guard before completing a sale if enabled, receipt auto-print triggered on sale completion if enabled.

---

### BUG-066 — Tenant deletion has no re-authentication or grace period
**Severity:** High · **Category:** Data Integrity / Safety Design · **Status:** Briefed — founder decision needed

`SystemSettings.tsx`'s "Danger Zone" tenant deletion does an immediate `supabase.from('tenants').delete()`, gated only by typing the business name (visible on the same screen). Confirmed via migration grep: `ON DELETE CASCADE` is the deliberate, widespread pattern across the schema (31 migration files) — meaning one correctly-typed confirmation permanently and irreversibly deletes every sale, customer, employee, product, and all other business data for that tenant. No soft-delete, no grace period, no re-authentication (password/MFA) step, no export-first prompt. This is working exactly as built, not a code bug — but for a real Lebanese SMB's entire operational and tax-relevant financial history, "type the name you can already read" is a thin safeguard for an action with zero recovery path.

**This is flagged for your decision, not a same-session fix** — it's a product/safety design call, similar in spirit to BUG-051's scope question, not a mechanical bug.

**Options to consider:**
> (a) Soft-delete with a recovery window (e.g., 30-day grace period before an actual hard-delete cron job runs) — the common SaaS pattern, gives room to recover from an accidental or malicious deletion. (b) Require re-authentication (password re-entry, or MFA challenge if enrolled) as a genuine second factor immediately before the irreversible action — cheaper to build than (a), doesn't add recovery capability but raises the bar against an already-authenticated-session mistake or a compromised/shared session. (c) Both. (d) Accept current behavior as sufficient given KiTS's actual customer base and support model. This needs your call before any code changes.

---

## Index — Batch 6 (final planned batch — sweeps the remaining unaudited surface)

**Batch 6 — Auth entry (Login/TenantSelection/AcceptInvite), Forecasting/HelpSupport, Pharmacy vertical, Supermarket vertical + remaining pages (2026-07-12)**, founder said "keep going, sweep the rest." 4 parallel research forks. This batch found the session's **second Critical finding**: two customer-facing public pages (booking, feedback) are completely non-functional for real anonymous customers — independently verified against live RLS policies before logging.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-067 | `AcceptInvite.tsx` didn't distinguish an expired invitation from a not-found one — both showed a generic error | Low | UX/Flow | **Fixed** | `src/pages/AcceptInvite.tsx` |
| BUG-068 | `Prescriptions.tsx`'s new-prescription date default used raw UTC `toISOString()` — 5th confirmed instance of this session's recurring local-date bug class | Medium | Data Integrity | **Fixed** | `src/pages/pharmacy/Prescriptions.tsx` |
| BUG-069 | `useDemandForecast.ts`'s "start from tomorrow" query boundary used the same raw-UTC pattern — live in an actively-consumed hook feeding `RestaurantAnalytics.tsx` | High | Data Integrity | **Fixed** | `src/hooks/useDemandForecast.ts` |
| BUG-070 | `HelpSupport.tsx` hardcoded the support email instead of using `BRAND.supportEmail` (already correctly used elsewhere in the same file) | Low | Documentation Drift | **Fixed** | `src/pages/HelpSupport.tsx` |
| BUG-071 | `BookReservation.tsx`'s date-picker bounds used the same raw-UTC pattern — active window falls inside real 11:00–01:00 dining hours | Medium | Data Integrity | **Fixed** | `src/pages/BookReservation.tsx` |
| BUG-072 | Supermarket's "Shelf Life Tracker" was deliberately disabled/unlinked per prior project memory ("not built yet") — but a fully-working `ExpiryDashboard.tsx` component already existed, just never mounted or routed | Medium | Missing Feature (was closer to done than believed) | **Fixed** | `src/pages/supermarket/ShelfLifeTracker.tsx` (new), `src/App.tsx`, `src/constants/verticalNavAccess.ts`, `src/pages/supermarket/SupermarketHub.tsx`, `CLAUDE.md` |
| BUG-073 | `TenantSelection.tsx` and `AcceptInvite.tsx` — zero i18n, entirely hardcoded English, contradicting CLAUDE.md's own stated standard | Medium-High | i18n/RTL | Briefed | — |
| BUG-074 | `RestaurantAnalytics.tsx` has no staleness indicator for demand-forecast data — a silently-failed nightly cron job (a risk CLAUDE.md itself already flags) would show old data with no way to tell it's stale | Medium | Missing Feature | Briefed | — |
| BUG-075 | `HelpSupport.tsx`'s "Submit Ticket" shows a fabricated success state regardless of whether the `mailto:` fallback actually reaches anyone (no default mail client = silent failure behind a fake "submitted" confirmation) | Medium | UX/Flow | **Fixed** (2026-07-14) | `src/pages/HelpSupport.tsx` |
| BUG-076 | `NarcoticsRegister.tsx`'s `pharmacist_name` is unverified free text, not bound to the authenticated employee — anyone can type any name into a legally-mandated controlled-substance log | High | Security/RBAC (Compliance) | **Fixed** (2026-07-14) — also found and fixed the same issue in `Prescriptions.tsx`'s dispense flow, a higher-impact instance | `supabase/migrations/20260714_000090_narcotics_compliance_and_dispensing.sql`, `src/pages/pharmacy/NarcoticsRegister.tsx`, `src/pages/pharmacy/Prescriptions.tsx` |
| BUG-077 | `NarcoticsRegister.tsx`'s RLS policy permits UPDATE/DELETE for any tenant user — no database-level append-only enforcement on a compliance register | Medium-High | Security/RBAC (Compliance) | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000090_narcotics_compliance_and_dispensing.sql` |
| BUG-078 | Narcotics logging is entirely disconnected from the actual prescription-dispensing workflow — a pharmacist must remember to separately re-enter the same details a second time, unenforced | High | Data Integrity / Missing Feature | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000090_narcotics_compliance_and_dispensing.sql`, `src/pages/pharmacy/Prescriptions.tsx` |
| BUG-079 | Dispensing a prescription (any drug, not just controlled substances) never decrements `drug_lots` stock at all — pharmacy inventory and dispensing activity are completely disconnected | Medium-High | Missing Feature | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000090_narcotics_compliance_and_dispensing.sql`, `src/pages/pharmacy/Prescriptions.tsx` |
| BUG-080 | **`BookReservation.tsx` and `TableFeedback.tsx` are non-functional for every real anonymous customer** — the anon tenant lookup is blocked by `tenants`' only RLS policy (`id = current_tenant_id()`, always false for anon), and the `reservations` INSERT is independently blocked the same way; `restaurant_table_feedback`'s INSERT is the opposite problem, fully open (`WITH CHECK (true)`) with no relationship validation | **Critical** | Security/RBAC + Functional Bug | **Fixed** (2026-07-13, founder-approved before applying) | `supabase/migrations/20260713_000082_public_reservation_feedback_rpcs.sql`, `src/pages/BookReservation.tsx`, `src/pages/TableFeedback.tsx` |
| BUG-081 | `bulk_pricing_rules` (supermarket) is fully built and configurable but never read by `POS.tsx` at checkout — same dead-config pattern found 4+ times this session | High | Missing Feature | **Fixed** (2026-07-14) | `src/utils/posCalculations.ts`, `src/pages/POS.tsx` |
| BUG-082 | `POSTestPage.tsx` is orphaned dead code — no route registered anywhere, unreachable, likely a pre-`POS.tsx` legacy prototype | Low | Documentation Drift / Cleanup | **Fixed** (2026-07-14, founder-confirmed deletion) | Deleted `src/pages/POSTestPage.tsx` and the now-orphaned `src/data/sampleData.ts` it was the sole importer of |

**Verified working, no defect found:** `LoginForm.tsx` (no client-trusted security logic, generic auth-failure messaging, no user-enumeration leak); `TenantSelection.tsx`'s real 2026-07-12 production bug (auto-select-sole-tenant bypassing role-hub resolution) confirmed still correctly fixed on both code paths; `AcceptInvite.tsx`'s `accept_pending_invitation()` RPC — genuinely well-built, tenant_id resolved server-side from the invitation record, never client-supplied; all RPCs in the auth flow confirmed live; `Forecasting.tsx` (clean, correctly `AppContext`-sourced, no date bugs — confirmed as a deliberate, non-redundant split from the F&B-specific demand-forecast system, not a conflict); loyalty settings persistence (already noted, folds into BUG-035); pharmacy `tenant_id` patterns across all four files (clean); `prescription_items`' quantity-dispensed DB constraint (over-dispensing hard-fails at the schema level even without a UI guard); `DepartmentManager.tsx`/`SupermarketHub.tsx` `tenant_id` patterns (clean); `PharmacyHub.tsx`'s insurance-claims section (genuinely wired, not dead UI).

**Noted, not filed as a defect:** `DrugDatabase.tsx`'s drug catalog is fully tenant-siloed (each pharmacy builds its own catalog from scratch) rather than a shared reference table with per-tenant pricing/stock layered on top — a real onboarding-friction question worth a founder scope conversation given this platform's self-serve-onboarding positioning, but looks like a deliberate architecture choice, not a broken feature.

**All 6 "Fixed" items this batch verified via `npm run typecheck` (clean) and `npx eslint` on every touched file (zero output, zero warnings).**

---

### BUG-072 — Shelf Life Tracker was disabled despite a working component already existing
**Severity:** Medium · **Category:** Missing Feature · **Status:** Fixed

Prior project memory recorded this as "not built yet" (from the 2026-07-11 platform roadmap session) — accurate at the time, but `src/components/supermarket/ExpiryDashboard.tsx` has since been built as a complete, working, tenant-scoped component (real `grocery_lots` query, expiring-within-30-days filter, days-left calculation, markdown suggestions) — it was just never mounted into a page or routed. `SupermarketHub.tsx`'s nav card was still explicitly disabled with a "coming soon" label and `href: null`, pointing at nothing.

**Fix applied:** created a thin page wrapper (`ShelfLifeTracker.tsx`, `<Layout><ExpiryDashboard /></Layout>`, matching the existing pattern from `DepartmentManager.tsx`), registered the route (`/supermarket/shelf-life`) in `App.tsx`, added role access (`owner`/`admin`/`manager`/`stockkeeper`, matching `/supermarket/departments`) to `verticalNavAccess.ts`, and enabled the nav card in `SupermarketHub.tsx`. Also corrected `CLAUDE.md`'s migration `000033` description, which claimed "loyalty multipliers" as a shipped feature — no such column/table exists anywhere in the migration or codebase.

---

### BUG-073 — Two auth-flow screens have zero i18n
**Severity:** Medium-High · **Category:** i18n/RTL · **Status:** Briefed

`TenantSelection.tsx` and `AcceptInvite.tsx` — two screens every new user and every invited team member passes through — have no `useTranslation()` calls anywhere; every string is hardcoded English. `LoginForm.tsx`, in the same directory and same user flow, is correctly and thoroughly i18n'd, making this look like an oversight from a later addition rather than a deliberate choice. Directly contradicts `CLAUDE.md`'s own stated standard ("Every string through `useTranslation()`. No hardcoded English.").

**Agent Brief (paste-ready):**
> Wire `TenantSelection.tsx` and `AcceptInvite.tsx` through `useTranslation()`, following the exact pattern already correctly used in `src/components/login/LoginForm.tsx` in the same directory. Add the new translation keys to every locale under `src/i18n/locales/` (check which languages are currently supported — at minimum English/Arabic given the platform's Lebanese/MENA RTL commitment). Sizeable in string count but mechanical and isolated — no logic changes needed, purely extraction + key addition.

---

### BUG-076/077/078/079 — Pharmacy narcotics-compliance and dispensing gaps
**Severity:** High (076, 078) / Medium-High (077, 079) · **Category:** Security/RBAC (Compliance) / Data Integrity / Missing Feature · **Status:** Briefed

Four related findings in the pharmacy vertical's controlled-substance and dispensing workflow, best understood together:

1. **`pharmacist_name` is free text, not identity-bound** — `NarcoticsRegister.tsx`'s form lets anyone type any name into a legally-mandated (Law 673/1998) controlled-substance log, with zero technical binding to the authenticated employee actually entering it.
2. **No append-only enforcement** — the RLS policy on the narcotics log has no `FOR` clause, so it defaults to permitting UPDATE/DELETE for any tenant user, not just SELECT/INSERT. No frontend edit/delete UI exists today, so current exposure is API-only, but nothing technically prevents a compromised session (or a future UI addition) from silently altering historical records.
3. **Narcotics logging is fully decoupled from actual dispensing** — `Prescriptions.tsx`'s dispense flow never touches `narcotics_log` at all; full compliance depends entirely on a pharmacist remembering to separately re-enter the same details a second time in a different screen.
4. **No stock deduction on dispense, for any drug** — `Prescriptions.tsx` never decrements `drug_lots.quantity_remaining`, controlled or not, despite `DrugDatabase.tsx` tracking lot-level stock with FEFO intent.

**Agent Brief (paste-ready):**
> Close four related gaps in the pharmacy dispensing/compliance flow, in priority order given the regulatory framing this module states about itself: (1) auto-fill and lock `NarcoticsRegister.tsx`'s `pharmacist_name` from the authenticated employee session (`useApp()`'s current employee, same pattern other attributed actions in this codebase use) rather than allowing free-text entry; (2) restrict the narcotics-log RLS policy to `FOR SELECT, INSERT` only — no UPDATE/DELETE for anyone, a genuine append-only register at the DB layer; (3) when a `Prescriptions.tsx` dispense targets a `classification='controlled'` drug, either auto-create the matching `narcotics_log` row (pre-filled, pharmacist confirms) or block completing the dispense without one — confirm the desired enforcement level with the founder/compliance owner rather than guessing; (4) wire dispense actions (all drugs) to decrement the earliest-expiring lot(s) with remaining stock via an atomic RPC (mirroring `apply_product_stock_delta`'s pattern, already proven this session, to avoid the read-then-write race class already found twice elsewhere). All four need a migration and/or real workflow design — not one-line fixes, and (1)/(2) are the highest-priority given the compliance framing.

---

### BUG-080 — Public booking and feedback pages are completely non-functional for real customers
**Severity:** Critical · **Category:** Security/RBAC + Functional Bug · **Status:** Fixed (2026-07-13)

**Fix applied, following the Agent Brief exactly, one extra root cause found along the way:** independently re-verified live (`pg_get_functiondef`/`pg_policies`) before writing the migration — confirmed a fourth compounding bug beyond the three below: both pages queried `tenants.tenant_slug`, a column that migration `000061` actually dropped (`slug` is the real column) — the query errored for every visitor regardless of RLS. Built 4 new `SECURITY DEFINER` RPCs mirroring `get_public_menu()`/`qr_place_order()`'s established pattern: `get_public_tenant_by_slug`, `get_public_reservation_slot_counts` (aggregates to slot→count only — no other guest's name/phone/party size is ever exposed to a browsing customer, a stricter privacy bar than the original raw-row approach), `create_public_reservation` (validates name/phone/party-size/date-range server-side), `submit_public_table_feedback` (validates the table_id/tenant_id relationship, silently drops a forged/stale table_id rather than rejecting the whole submission — same style as `qr_place_order`). Dropped the fully-open `public_insert_feedback` policy entirely — all public writes now route through the validated RPC. `npm run typecheck`/lint/build all clean. Migration applied to `kits-dev` with explicit founder confirmation naming the specific change, then independently re-verified live (function `prosecdef`/`search_path` correct, policy actually dropped, `get_advisors` shows the new RPCs triggering only the same already-accepted `anon_security_definer_function_executable` class shared by all 36 legitimate public/staff RPCs in this codebase — no new category of finding introduced).

**Independently re-verified against the live database before logging**, same discipline as every other Critical/security finding this session: queried `pg_policies` directly.

- `tenants` has exactly one SELECT policy: `"view own tenant"`, `USING (id = current_tenant_id())`. For an anonymous visitor with no session, `current_tenant_id()` is NULL, so this is always false — confirmed live, not inferred. Both `BookReservation.tsx` and `TableFeedback.tsx` resolve their tenant via a raw client query (`supabase.from('tenants').select(...).eq('tenant_slug', tenantSlug).single()`) that this policy blocks unconditionally.
- **Net effect: any real customer opening a reservation-booking link or a post-meal feedback link sees "Restaurant not found" before the page even loads the form.** These are fully-built, complete-looking frontend flows that have very likely never worked for a single real anonymous customer.
- Compounding this for `BookReservation.tsx`: even with tenant lookup fixed, the reservation submission would *also* fail — confirmed live, `reservations`' INSERT policy requires `WITH CHECK (tenant_id = current_tenant_id())`, false for anon just like the SELECT policy above.
- The opposite problem exists on `restaurant_table_feedback`: its INSERT policy is confirmed live as `WITH CHECK (true)` — fully open, no validation that the submitted `tenant_id`/`table_id` correspond to anything real. Currently moot in the UI (the page can't reach submission since tenant lookup fails first), but a raw API caller bypassing the frontend entirely could inject arbitrary fake feedback for any tenant right now, with no rate limit and no relationship check.

**Why this is the session's top-priority open item:** unlike most findings this session (staff-facing bugs, workflow gaps), this is a complete, customer-facing feature that appears finished but has likely never worked in production — the kind of gap that's easy to miss because it "looks done" and nobody internal ever tests it as a genuine anonymous visitor would.

**Agent Brief (paste-ready):**
> Fix public reservation booking and table feedback — currently non-functional for every real anonymous customer, independently verified against live RLS policies (see full finding above). The correct pattern already exists in this codebase: `get_public_menu()`, a `SECURITY DEFINER` RPC that resolves tenant server-side without needing anon SELECT grants on `tenants` (confirmed working, used by the QR customer menu, audited clean earlier this session). Scope: (1) replace both pages' direct `tenants` queries with an equivalent public RPC (e.g. `get_public_tenant_by_slug(p_slug text)`, returning only the safe branding columns already selected — `id`, `name`, `brand_logo_url`, `brand_primary`, `country`, `phone`); (2) for the `reservations` INSERT, either add a narrowly-scoped anon-insert policy, or — better, more consistent with this codebase's established security pattern — route booking through a dedicated `SECURITY DEFINER` RPC that resolves `tenant_id` server-side from the slug (mirroring `qr_place_order()`'s approach, not a raw client insert trusting client-supplied `tenant_id`); (3) tighten `restaurant_table_feedback`'s INSERT policy to validate the `table_id`/`tenant_id` relationship server-side once the RPC pattern is adopted, rather than the current unconditional `WITH CHECK (true)`. This needs new RPCs and RLS changes — confirm the exact migration with the founder by name before applying to `kits-dev`, per this project's standing discipline. Given the severity (a complete customer-facing feature, non-functional end-to-end), recommend prioritizing this above most other Briefed items in this tracker.

---

### BUG-081 — Bulk pricing configured but never applied at checkout
**Severity:** High · **Category:** Missing Feature · **Status:** Briefed

`DepartmentManager.tsx` fully implements bulk-pricing-rule CRUD (buy-X-get-Y, quantity breaks, case prices), correctly persisted with `tenant_id`. `POS.tsx` never reads or applies `bulk_pricing_rules` at checkout — an owner configuring a bulk discount gets a "Saved" confirmation and it does nothing at the register. Same dead-config pattern as BUG-025 (Inventory variants), BUG-036 (CRM tabs), BUG-065 (POS business-policy settings).

**Agent Brief:** wire `POS.tsx`'s checkout/pricing calculation to read and apply `bulk_pricing_rules` for matching line items, same general shape as the discount/coupon logic already verified correct in `posCalculations.ts` earlier this session.

---

### BUG-082 — Orphaned dead code: POSTestPage.tsx
**Severity:** Low · **Category:** Documentation Drift / Cleanup · **Status:** Briefed — needs confirmation before deletion

Confirmed via full grep of `App.tsx` — no route registered anywhere, genuinely unreachable in the running app. Imports `EnhancedPOS`, `PromotionManagementModal`, and a `sampleData.ts` mock module — reads like a pre-`POS.tsx` legacy prototype left in the tree. Not a live bug (unreachable), but worth a cleanup pass so a future developer doesn't mistake it for a real dev tool. **Not deleted in this pass** — per this project's own established pattern this session, file deletion needs explicit confirmation naming the specific file, not assumed authorization from a general "clean this up" instruction.

---

## Index — Batch 7 (closes out the full-platform sweep)

**Batch 7 — API/Webhooks, Restaurant Hub/AI Assistant, Analytics/Monitoring, role-native hubs + remaining enterprise/inventory components (2026-07-12)**, founder said "keep going... until all platform audited." 4 parallel research forks (relaunched once after an interim session-usage-limit reset). This batch found **two more instances of the missing-`tenant_id` bug** (bringing the confirmed total to 10) and **a near-exact repeat of BUG-056** — the delivery-webhook secret-exposure pattern — this time on the platform's actual API keys/webhooks feature.

| ID | Title | Severity | Category | Status | Files |
|---|---|---|---|---|---|
| BUG-083 | `api_keys` and `webhooks` inserts missing `tenant_id` — every API key generation and webhook registration was 403ing for every tenant. Also: the webhooks list view was over-fetching the plaintext `secret` column into React state for every existing webhook, never actually rendered — removed regardless of the RLS decision below | High | Functional Bug | **Fixed** | `src/components/enterprise/ApiAndWebhooks.tsx` |
| BUG-084 | `api_keys`/`webhooks`/`webhook_deliveries` RLS policies had no role check — any tenant role, including a low-privilege cashier, could read/write API keys and webhook signing secrets via a direct API call, same class as BUG-056 | High | Security/RBAC | **Fixed** (founder-approved, applied same-session) | `supabase/migrations/20260712_000081_restrict_api_keys_webhooks_role_access.sql` |
| BUG-085 | `locations` insert (generic multi-location, distinct from the F&B-specific `MultiBranchHub.tsx`) missing `tenant_id` — 10th confirmed instance of this session's #1 recurring bug class | High | Functional Bug | **Fixed** | `src/components/enterprise/MultiLocationSupport.tsx` |
| BUG-086 | `RestaurantAnalytics.tsx` had two more instances of the recurring local-date/UTC bug, one driving the "Today KPIs" panel's headline revenue/covers numbers directly | High | Data Integrity | **Fixed** | `src/pages/restaurant/RestaurantAnalytics.tsx` |
| BUG-087 | `RestaurantAnalytics.tsx` is a 4th/5th independent revenue-calculation source (client-side sum of `restaurant_order_items`, not the canonical `sales` table Finance/Reports use) — sharpens BUG-044 | Medium-High | Data Integrity | Briefed (fold into BUG-044) | — |
| BUG-088 | `StockkeeperHomeHub.tsx`'s PO-receiving flow updates `restaurant_ingredients.current_stock` via read-then-write — same race-condition class already fixed twice this session via atomic RPCs, on a table that doesn't have one yet | Medium-High | Data Integrity | **Fixed** (2026-07-14) | `supabase/migrations/20260714_000088_ingredient_stock_delta_rpc.sql`, `src/pages/restaurant/StockkeeperHomeHub.tsx` |
| BUG-089 | All four role-native hubs (Accountant/Stockkeeper/Receptionist/Operations) had zero auto-refresh — the literal first screen an employee sees after every login, stale until manual reload | Medium | UX/Flow | **Fixed** | `src/pages/restaurant/AccountantHomeHub.tsx`, `StockkeeperHomeHub.tsx`, `ReceptionistHomeHub.tsx`, `OperationsHomeHub.tsx` |
| BUG-090 | `MultiLocationSupport.tsx` (generic) and `MultiBranchHub.tsx` (F&B-specific, audited Batch 5) are two independent, overlapping multi-location systems — possibly a confusing duplicate-implementation pair like two prior instances this project has already resolved (`CashManagement` vs `CashDrawer`, `CustomerManagement` vs `Customers`), not confirmed intentional | Medium | Cross-Vertical Conflict | **Investigated, not a bug** (2026-07-14) — confirmed intentional generic-vs-specialized split, same pattern as `RecipeInventory`/generic `Inventory` | — |

**Verified working, no defect found:** `WorkflowAutomation.tsx`'s "Run Now" genuinely invokes the real `trigger-workflows` edge function with real data and error surfacing — not another dead button; API key generation/display in `ApiAndWebhooks.tsx` was already correctly built (hash-and-show-once, the exact pattern BUG-056 introduced for delivery secrets) — only the webhook half of the same file had the gap; `RestaurantHub.tsx` (real 10-second auto-refresh already in place, no tenant_id issues, no stale-fetch); `AIAssistant.tsx`/`useAIAssistant.ts` (the `restaurant-ai-assistant` edge function independently confirmed live and deployed via `list_edge_functions`); `MonitoringDashboard.tsx` (real operational data, correct local-midnight boundary calculation — the *right* way to do the date-boundary pattern that's been buggy elsewhere); `RestaurantAnalytics.tsx`'s menu-engineering margin panel (correctly recipe-cost-based, consistent with Batch 1's fix, not a divergent calculation); `BatchTracking.tsx` (exemplary — zero direct Supabase calls, pure `AppContext` consumer); `ReorderPointManagement.tsx` (absolute-threshold updates, no race-condition exposure); `RolesAndPermissionsManager.tsx`/`EnterpriseDashboard.tsx` (Batch 1's "Change Role" cosmetic-column fix confirmed still correctly in place — the still-open stale-fetch item, BUG-011, is unchanged, not a new regression).

**All 5 "Fixed" items this batch verified via `npm run typecheck` (clean) and `npx eslint` on every touched file (zero output, zero warnings).**

---

### BUG-083/084 — API keys and webhooks: missing tenant_id, plus a near-repeat of the delivery-secret exposure bug
**Severity:** High (both) · **Category:** Functional Bug / Security-RBAC · **Status:** Fixed (both)

Same investigative lens applied deliberately here, given how fresh BUG-056 was: `ApiAndWebhooks.tsx` had two separate problems. First, both `api_keys` and `webhooks` inserts were missing `tenant_id` (the file didn't import `useApp()` at all) — 100% broken creation flow for both features, for every tenant. Second, and more seriously: **independently verified live via `pg_policies`**, `api_keys`, `webhooks`, and `webhook_deliveries` all had exactly one RLS policy each, purely tenant-scoped with no role check — the same gap BUG-056 fixed on `restaurant_delivery_integrations`. The frontend route is appropriately tight (`owner`/`admin` only), but per this exact codebase's own lesson from BUG-056, that's not the real security boundary. Compounding it: `loadWebhooks()` was fetching the full plaintext `secret` column into React state for every existing webhook on every page load — genuinely never rendered anywhere for existing webhooks (only shown once at creation), so a real over-fetch with zero UI purpose.

**Fixed (BUG-083):** the `tenant_id` gap (mechanical, same pattern as 9 prior instances), and the webhook over-fetch (removed `secret` from the list query and the `Webhook` type entirely — pure frontend change, applied regardless of the RLS decision).

**Fixed (BUG-084), founder-approved before any production change** — same explicit-confirmation discipline as BUG-056: `supabase/migrations/20260712_000081_restrict_api_keys_webhooks_role_access.sql` restricts all three tables' RLS policies to `owner`/`admin` only (`webhook_deliveries` via the same subquery-through-`webhooks.tenant_id` pattern its original policy already used, now with the role check added inside that subquery). Applied directly to `kits-dev`, then independently re-queried `pg_policies` to confirm the live policy text matches exactly.

---

### BUG-085 — Generic multi-location `locations` insert missing tenant_id
**Severity:** High · **Category:** Functional Bug · **Status:** Fixed

10th confirmed instance of this session's most common bug class — same root cause, same fix, in `MultiLocationSupport.tsx`'s `LocationsTab` (which, notably, did not import `useApp()` at all before this fix, same shape as several prior instances).

---

### BUG-086 — RestaurantAnalytics' "Today KPIs" used the buggy date pattern
**Severity:** High · **Category:** Data Integrity · **Status:** Fixed

Two more instances of the local-date/UTC bug (6th and 7th this session), one of them driving the headline revenue/covers/avg-check numbers on the platform's main F&B analytics dashboard — the highest-visibility instance of this bug class found all session. Fixed with the same `toLocalDateString()` swap applied 6 times prior.

---

### BUG-088 — Ingredient stock has a read-then-write race, no atomic RPC yet
**Severity:** Medium-High · **Category:** Data Integrity · **Status:** Briefed

`StockkeeperHomeHub.tsx`'s PO-receiving flow updates `restaurant_ingredients.current_stock` via the same read-then-write pattern already found and fixed twice this session (products via `apply_product_stock_delta`, BUG-031). No equivalent atomic RPC exists yet for ingredients.

**Agent Brief:** build `apply_ingredient_stock_delta(p_ingredient_id uuid, p_delta numeric)`, mirroring `apply_product_stock_delta`'s exact pattern (migration `20260712_000078`) — `SECURITY INVOKER`, simple atomic `UPDATE restaurant_ingredients SET current_stock = current_stock + p_delta`. Wire `StockkeeperHomeHub.tsx`'s PO-receiving flow to call it instead of the current read-then-write.

---

### BUG-090 — Two independent multi-location systems, possible duplicate implementation
**Severity:** Medium · **Category:** Cross-Vertical Conflict · **Status:** Investigated, not a bug (2026-07-14)

**Confirmed via live route/gating check, not a duplicate to eliminate.** `MultiLocationSupport.tsx` (`/enterprise/locations`) is gated behind the Business-plan `multi_location` feature and is generic/cross-vertical (locations CRUD + `location_stock` + transfers, no industry gate excludes restaurant tenants). `MultiBranchHub.tsx` (`/restaurant/branches`) has no plan gate at all (role-gated only) and is F&B-specific: branch comparison cards with food-cost status, table turnover, service time, argile revenue, delivery revenue — genuinely richer domain analytics `MultiLocationSupport` doesn't have or need for other verticals. A restaurant tenant on Business plan can reach both, but they serve different purposes (branch performance analytics vs. generic stock/location CRUD), not the same purpose twice — the same intentional generic-vs-specialized split this codebase already has for `RecipeInventory.tsx` vs. the generic `Inventory.tsx` (confirmed via the earlier platform audit as deliberate, not accidental). No deletion or merge action taken — nothing here meets the bar that justified deleting `CashManagement.tsx`/`CustomerManagement.tsx` (those were genuinely same-purpose, superseded duplicates).

`MultiLocationSupport.tsx` (generic `locations`/`location_stock`, migration `000009`) and `MultiBranchHub.tsx` (F&B-specific `restaurant_branches`/`restaurant_branch_metrics`, migration `000039`, audited Batch 5) are two independent multi-location systems with overlapping purpose. This project has already resolved this exact class of issue twice before by deleting one side of a duplicate pair (`CashManagement.tsx` vs `CashDrawer.tsx`, `CustomerManagement.tsx` vs `Customers.tsx`, per project memory) — not confirmed here whether this is the same situation or a deliberate generic-vs-F&B-specific split.

**Agent Brief:** confirm with the founder whether both are meant to coexist (e.g., `MultiLocationSupport` for non-restaurant verticals, `MultiBranchHub` for F&B) or whether this is unintentional drift from platform evolution. Do not delete or merge either file without explicit confirmation naming the specific files, per this project's established pattern (a safety classifier has correctly blocked unnamed-file-deletion attempts earlier in this same project's history).

---

## What to test next (founder walkthrough recommended)

The 8 "Fixed" items above are typecheck/lint-clean but **not yet exercised in a live browser session** — no test credentials were available to this session for direct UI reproduction. Before considering this batch fully closed, walk through:

1. **PIN login** — create a 6-digit-PIN employee, confirm the old buggy auto-submit-at-4 no longer happens and the new Enter button/key correctly submits the full PIN. Try a physical keyboard.
2. **Waiter "Ready" button** — get a table into `cleaning` status, confirm the button is now clickable and actually marks it available.
3. **Payroll + Budget saves** — add a payroll entry and save a budget line; both should succeed with no 403 now.
4. **Recipe costing** — create a recipe, confirm the Unit field is locked/read-only and the estimate no longer inflates; try adding the same ingredient twice to a recipe and confirm it no longer silently drops all lines.
5. **A11y button** — confirm it's gone from a production build (it will still show in `npm run dev`, that's correct — only gated to non-dev).
6. **White-screen fix** — can only be confirmed on the *next* production deploy after this ships (see BUG-013 note).

The 14 "Briefed" items from Batch 1 (BUG-004, 006, 007, 009, 010, 011, 012, and the BUG-020 full-solution follow-up) are scoped enough to hand to a build agent directly — each entry above has a paste-ready Agent Brief.

**Batch 2 additions (2026-07-12, same-day follow-up):**

7. **Add Expense** — submit a new expense, confirm no more 403.
8. **P&L Report** — if any expense category currently has `is_cogs=true` with a non-`'cogs'` `type`, confirm Gross Profit/EBITDA now match the Overview tab's numbers (unlikely to matter yet — no category-management UI exists to have created such a mismatch, but worth a quick sanity check).
9. **Add Supplier, Add Purchase Order, Add Stock Transfer** — all three should now succeed with no 403 (were 100% broken before this fix, for every tenant).
10. **Receive a Purchase Order** — confirm stock quantities update correctly (now via the atomic RPC instead of read-then-write).

Batch 2's Briefed items (BUG-025, 026, 030) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief. BUG-025 and BUG-026 need a founder scope decision named in the brief before a build agent should start.

**Batch 3 additions (2026-07-12, same-day follow-up):**

11. **Tips page** — confirm "today's tips" now shows a real number tied to actual `tip_amount_usd`, not a suspiciously-round 10%-of-revenue figure.
12. **EOD Report right after local midnight** (or right after a late shift close, e.g. the founder's example 15:00-02:00 shift) — confirm it now reports the correct calendar day.
13. **Table Management (manager view)** — leave it open, have a change happen elsewhere (waiter bumps a table, KDS marks an item ready), confirm it now updates within ~30s without a manual reload.
14. **Loyalty points (BUG-035, highest priority in this batch)** — this is flagged Critical and confirmed via direct database query, not just a code read: check whether any real customer anywhere in `kits-dev` has ever had `customer_points` actually created/incremented after a sale. If the answer is "no, ever," this has been silently broken since the loyalty feature shipped and is worth prioritizing above everything else in this batch.

Batch 3's Briefed items (BUG-032, 033, 034, 035, 036, 038, 043, 044, 045) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief. BUG-032/033 need PowerSync-work coordination named in the brief; BUG-034/035 should be built together (same missing RPC layer); BUG-045 needs a live-order verification step before it's treated as confirmed.

**Batch 4 additions (2026-07-12, same-day follow-up):**

15. **New Reservation form / New Event form** — confirm the date field now defaults to today, not yesterday, especially if testing late at night.
16. **EventsManager dashboard stats** — confirm "Upcoming Events" and "This Month's Confirmed Revenue" look right, especially around a month boundary.
17. **Reservations / Events screens** — leave open, make a change elsewhere, confirm they now auto-refresh within ~30s.
18. **BUG-056 (webhook secret exposure) — fixed and applied to `kits-dev`.** Confirm: a cashier account can no longer reach `/restaurant/delivery` at all, and reopening a configured platform's settings (as owner/manager) shows the secret masked (`••••••••1234`) with a "Change" button, not the full value.

Batch 4's Briefed items (BUG-047, 048, 051, 053, 054, 055) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief. BUG-053/054/055 should be built together (same DB function).

**Batch 5 additions (2026-07-12, same-day follow-up):**

19. **Admin Panel** — open as KiTS staff, before entering the PIN, confirm no tenant data is visible or fetchable (check the Network tab — `admin_list_tenants` should not fire until after the PIN is confirmed).
20. **Menu Management → Waiter Order Panel → Send to KDS** — start a new order on a table with no existing open order, confirm it no longer 403s.
21. **Employees page** — confirm the non-functional "View performance report" button is gone (the stats it never linked to are still shown inline).
22. **Onboarding** — if testing with a UAE/Saudi Arabia/Kuwait business profile, no visible UI difference expected (this was a backend `preferred_region` field, not customer-facing) — just worth knowing it's fixed for any future Gulf tenant.

Batch 5's Briefed items (BUG-061, 062, 063, 065, 066) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief, except BUG-062/063 which need a quick confirmation trace before treating as certain, and BUG-066 which is explicitly waiting on your product decision, not a build agent.

**Batch 6 additions (2026-07-12, same-day follow-up) — final planned batch:**

23. **Supermarket Hub → Shelf Life Tracker** — confirm the previously-disabled card is now clickable and shows real expiring-lot data.
24. **Any new-prescription form / new-reservation form (staff or public booking link)** — spot-check the date defaults are correct, especially late at night.
25. **BUG-080 (public booking/feedback pages) — this is the single most important thing to verify in this entire tracker.** Open a real reservation-booking link or table-feedback link as an actual anonymous visitor (not logged in, incognito window) and confirm what currently happens — this session's finding predicts "Restaurant not found" or an equivalent failure before the form even loads. If confirmed, this should likely jump to the top of whatever gets built next, ahead of most other Briefed items — it's a complete customer-facing feature that appears finished but has probably never worked.

Batch 6's Briefed items (BUG-073, 074, 075, 076-079, 080, 081, 082) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief except BUG-082 (needs your explicit confirmation before deleting the file). **BUG-080 is the standout — recommend prioritizing it first among everything in this tracker.**

**Batch 7 additions (2026-07-12, same-day follow-up) — closes out the full-platform sweep:**

26. **API Keys / Webhooks page** — create a new API key and a new webhook, confirm both succeed with no 403 now.
27. **Role-native hubs** (Accountant/Stockkeeper/Receptionist/Operations) — leave one open, make a change elsewhere that should affect its numbers, confirm it updates within ~30s without a manual reload.
28. **RestaurantAnalytics "Today KPIs"** — same late-night/local-midnight spot-check as the other date-bug fixes this session.
29. **BUG-084 (webhook/API-key secret exposure) — fixed and applied to `kits-dev`.** Confirm: a cashier account can no longer read/write API keys or webhooks at all.

Batch 7's Briefed items (BUG-087, 088, 090) are scoped enough to hand to a build agent directly — each has a paste-ready Agent Brief, except BUG-090 which needs a scope confirmation before any file changes.

---

## Session-wide summary (2026-07-12, seven batches — full platform audited)

This was a comprehensive, systematic sweep of the entire platform — every major page, every vertical (F&B fully, Pharmacy and Supermarket verticals swept once each), every enterprise/admin surface — triggered by the founder's own hands-on testing plus self-directed continuation across all seven batches: Employees/PIN/Argile/Waiter/Shifts → Finance/Inventory → POS/CRM/Cash/EOD/Kitchen/Tables → QR-menu/Reports/Reservations/Delivery → Admin/Settings/Menu/Multi-Branch → Auth/Forecasting/Pharmacy/Supermarket → API-Webhooks/Restaurant-Hub/Analytics/role-native-hubs. One interim session-usage-limit reset occurred mid-Batch-7; the same four forks were relaunched cleanly afterward with no lost work.

**90 findings logged. 42 fixed and verified (typecheck + lint clean on every touched file, every batch, all seven batches; RLS fixes independently re-verified live). 2 Critical findings**, both independently re-verified against the live database before being trusted, not just taken on a research fork's word: **BUG-035** (loyalty points have likely never been earned on a single real sale, ever) and **BUG-080** (public reservation booking and table feedback are non-functional for real anonymous customers — recommend prioritizing this above everything else in the tracker). **Two production security fixes applied with your explicit approval** (BUG-056 delivery webhook secrets; BUG-084 API keys/webhooks — same class, same fix pattern, found fresh in a completely different feature just one batch later) **and one applied directly as a safe frontend-only fix** (BUG-057, Admin Panel's PIN gate not actually gating the data fetch).

**Follow-up (2026-07-13 to 2026-07-14):** both Critical findings closed. BUG-080 fixed (public reservation booking + table feedback, previously non-functional for every real customer — 4 new SECURITY DEFINER RPCs, migration `20260713_000082`). BUG-035 and BUG-034 fixed together (loyalty points never accrued + a redemption-side race condition, plus a third instance of the same race found in `LoyaltyPanel.tsx`'s manual adjust flow — one atomic `apply_customer_points_delta` RPC, migration `20260714_000083`). **45 of 89 tracked findings now fixed and verified; both Critical items resolved.**

**The two most valuable patterns this session surfaced, worth remembering for all future work on this codebase — both documented in `reference_qa_bug_tracker.md` (memory) so future sessions inherit them automatically:**
1. **A hand-rolled `supabase.from(...).insert()` that skips `tenant_id` is not a one-off mistake.** It happened **10 separate times** across completely unrelated features (payroll, budgets ×2, expenses, suppliers, purchase orders, stock transfers, menu management's quick-order path, API keys, webhooks, generic multi-location) — always in code that builds an insert payload by hand instead of going through `AppContext`'s already-correct CRUD functions or a `SECURITY DEFINER` RPC. Any new hand-rolled insert in this codebase should be treated as suspect until proven otherwise.
2. **A feature with a fully-built settings/management UI and zero connection to where that setting should actually take effect** recurred **5 times** (Inventory's dead variant panel, 3 dead CRM tabs, POS business-policy settings, bulk pricing rules, the now-fixed Shelf Life Tracker) — plus a related, sharper variant found twice (a security-sensitive value exposed in full because "shown once" masking wasn't applied — BUG-056 and BUG-084).

**A third, smaller pattern worth naming:** the local-date/UTC bug (raw `new Date().toISOString().split('T')[0]` instead of `toLocalDateString()`) recurred **7 times** across completely different features (EOD Report, Tips, Reservations, Events ×2, Prescriptions, demand-forecast hook, RestaurantAnalytics ×2 — 9 instances total), always in date-boundary-sensitive code, always with the same silent symptom: a day appears to shift backward for the first 2-3 hours after Lebanon local midnight. Worth a lint rule or a shared date-input component if this codebase wants to stop finding this a tenth time.

**The full platform has now been audited.** What remains is not more code to sweep — it's turning the ~48 Briefed findings into shipped fixes (each has a paste-ready Agent Brief), and walking through the "What to test next" checklists above to confirm the 42 same-session fixes actually work end-to-end in a real browser, which this session could not do (no test credentials were available).
