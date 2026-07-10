# Automatic Low-Stock Purchase Order Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last Tier 2 roadmap item — unattended nightly generation of supplier-grouped draft purchase orders for low-stock ingredients, plus fixing the existing manual "Auto-Create PO" button to use the same corrected (supplier-grouped, duplicate-safe) logic instead of its current single-PO-no-supplier behavior.

**Architecture:** One internal SQL engine function (`fn_generate_low_stock_pos_for_tenant`) does the actual grouping/generation work for a given tenant. Two thin wrappers call into it: `generate_low_stock_purchase_orders()` (public RPC, resolves the caller's own tenant, used by the frontend button) and `fn_generate_low_stock_pos_all_tenants()` (cron-only, loops every tenant, registered directly with `pg_cron` — no edge function needed since there's no external API call involved).

**Tech Stack:** PostgreSQL/Supabase (SQL migration, PL/pgSQL, RLS, pg_cron), React/TypeScript frontend.

## Global Constraints

- `SET search_path = 'public'` on every new function.
- The internal engine function must be `REVOKE`d from `PUBLIC, anon, authenticated` — it takes an explicit `p_tenant_id` and must never be directly callable by a client.
- The public RPC resolves tenant via `current_tenant_id()`, never a client-supplied value; raises `permission_denied` if the caller has no active tenant.
- No pgTAP in this repo — verification is by careful manual reading, matching the convention used for every migration this session.
- Full design reference: `docs/superpowers/specs/2026-07-10-auto-low-stock-purchase-orders-design.md`. All SQL and TypeScript below is copied verbatim from that approved spec — do not re-derive it.

---

### Task 1: Database migration — low-stock PO generation functions + cron job

**Files:**
- Create: `supabase/migrations/20260710_000066_auto_low_stock_purchase_orders.sql`
- Modify: `CLAUDE.md` (append new migration list entry)

**Interfaces:**
- Produces: `generate_low_stock_purchase_orders() RETURNS INT` — the RPC Task 2's frontend change calls, with zero arguments, returning the count of purchase orders created in this call.
- Produces (internal only, not consumed by Task 2 or any frontend code): `fn_generate_low_stock_pos_for_tenant(p_tenant_id UUID) RETURNS INT`, `fn_generate_low_stock_pos_all_tenants() RETURNS void`.
- Consumes: nothing from other tasks — self-contained, must land first (Task 2 calls this RPC).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260710_000066_auto_low_stock_purchase_orders.sql`:

```sql
-- ============================================================
-- Migration: Automatic Low-Stock Purchase Order Generation
--
-- Closes the last Tier 2 roadmap item. RecipeInventory.tsx already had
-- a manual "Auto-Create PO" button, but it dumped every shortage into
-- one PO with no supplier and required a staff member to be looking at
-- this exact screen. This adds: (1) supplier-grouped generation shared
-- by both the manual button and a new nightly unattended sweep, and
-- (2) duplicate-safe exclusion of ingredients already on an open PO.
--
-- Full design: docs/superpowers/specs/2026-07-10-auto-low-stock-purchase-orders-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generate_low_stock_pos_for_tenant(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_supplier RECORD;
  v_po_id UUID;
  v_po_count INT := 0;
  v_seq INT := 0;
BEGIN
  FOR v_supplier IN
    SELECT DISTINCT supplier_id
    FROM restaurant_ingredients
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND par_level > 0
      AND current_stock < par_level
      AND id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      )
  LOOP
    v_seq := v_seq + 1;

    INSERT INTO restaurant_purchase_orders (tenant_id, supplier_id, order_number, status, notes, total_estimated)
    SELECT
      p_tenant_id,
      v_supplier.supplier_id,
      'PO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || lpad((extract(milliseconds FROM clock_timestamp())::int + v_seq)::text, 4, '0'),
      'draft',
      'Auto-generated from low stock alert',
      COALESCE(SUM(GREATEST(ri.par_level - ri.current_stock, 0) * ri.cost_per_unit), 0)
    FROM restaurant_ingredients ri
    WHERE ri.tenant_id = p_tenant_id
      AND ri.is_active = true
      AND ri.par_level > 0
      AND ri.current_stock < ri.par_level
      AND ri.supplier_id IS NOT DISTINCT FROM v_supplier.supplier_id
      AND ri.id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      )
    RETURNING id INTO v_po_id;

    INSERT INTO restaurant_purchase_order_items (purchase_order_id, ingredient_id, quantity_ordered, quantity_received, unit_cost)
    SELECT
      v_po_id,
      ri.id,
      GREATEST(ri.par_level - ri.current_stock, 0),
      0,
      ri.cost_per_unit
    FROM restaurant_ingredients ri
    WHERE ri.tenant_id = p_tenant_id
      AND ri.is_active = true
      AND ri.par_level > 0
      AND ri.current_stock < ri.par_level
      AND ri.supplier_id IS NOT DISTINCT FROM v_supplier.supplier_id
      AND ri.id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      );

    v_po_count := v_po_count + 1;
  END LOOP;

  RETURN v_po_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generate_low_stock_pos_for_tenant(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION generate_low_stock_purchase_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id UUID := current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN fn_generate_low_stock_pos_for_tenant(v_tenant_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_low_stock_purchase_orders() FROM anon;

CREATE OR REPLACE FUNCTION fn_generate_low_stock_pos_all_tenants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN SELECT id FROM tenants LOOP
    PERFORM fn_generate_low_stock_pos_for_tenant(v_tenant.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generate_low_stock_pos_all_tenants() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'nightly-low-stock-po-generation',
  '0 5 * * *',
  $$SELECT fn_generate_low_stock_pos_all_tenants()$$
);
```

- [ ] **Step 2: Manual verification pass**

Read the file with fresh eyes and confirm:
1. `SET search_path = 'public'` is present on all three functions.
2. `fn_generate_low_stock_pos_for_tenant` is `REVOKE`d from `PUBLIC, anon, authenticated` — trace that neither `anon` nor `authenticated` could call it directly with an arbitrary `p_tenant_id`.
3. `generate_low_stock_purchase_orders()` resolves `current_tenant_id()` and raises `permission_denied` on `NULL` before ever calling the engine — a caller with no active tenant gets rejected, not routed to some default.
4. Trace the supplier-grouping logic through a concrete example: tenant has 3 low-stock ingredients — two with `supplier_id = 'sup-A'`, one with `supplier_id = NULL`. Confirm the outer `FOR v_supplier IN SELECT DISTINCT supplier_id ...` loop produces exactly 2 iterations (`'sup-A'` and `NULL`), and that the `IS NOT DISTINCT FROM` comparison in both INSERT statements correctly matches the `NULL` group (a plain `=` comparison would never match `NULL = NULL` and would silently drop that ingredient from any PO).
5. Trace the duplicate-exclusion logic: if ingredient X is already itemized on a PO with `status = 'draft'`, confirm the `NOT IN (...)` subquery excludes it from being pulled into both the outer supplier-loop query AND the two per-supplier INSERT queries (all three copies of the subquery must agree — if a future edit changes one copy without the others, header/items could disagree about which ingredients are in this run).
6. `fn_generate_low_stock_pos_all_tenants()` is `REVOKE`d the same way as the engine — it must never be callable by a client either, only by `cron.schedule`'s internal invocation.
7. The `cron.schedule` call uses `'0 5 * * *'` (05:00 UTC) — confirm this doesn't collide with the three existing analytics jobs at 23:00–23:30 UTC (`supabase/migrations/20260705_000051_fnb_analytics_cron.sql`).

- [ ] **Step 3: Update CLAUDE.md's migration list**

Add a new entry immediately after the current final entry, matching the established one-paragraph style:

```
`20260710_000066_auto_low_stock_purchase_orders.sql` — closes the last Tier 2 roadmap item. `RecipeInventory.tsx` already had a manual "Auto-Create PO" button, but it dumped every shortage into one PO with no supplier and required a staff member to be on that exact screen. Adds `fn_generate_low_stock_pos_for_tenant(p_tenant_id)` (supplier-grouped generation, excludes ingredients already on an open draft/ordered PO), a public `generate_low_stock_purchase_orders()` RPC the frontend button now calls instead of building rows client-side, and a `nightly-low-stock-po-generation` pg_cron job (05:00 UTC, calls the SQL function directly — no edge function needed since there's no external API call, unlike the three existing analytics jobs).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_000066_auto_low_stock_purchase_orders.sql CLAUDE.md
git commit -m "feat(restaurant): add automatic low-stock purchase order generation

Closes the last Tier 2 roadmap item. Adds supplier-grouped, duplicate-
safe draft PO generation shared by a new nightly cron sweep and the
existing manual Auto-Create PO button (which previously dumped every
shortage into one PO with no supplier)."
```

---

### Task 2: Frontend — use the new RPC in RecipeInventory.tsx's Auto-Create PO button

**Files:**
- Modify: `src/pages/restaurant/RecipeInventory.tsx`

**Interfaces:**
- Consumes: `generate_low_stock_purchase_orders()` RPC from Task 1 (zero arguments, returns `INT`).

- [ ] **Step 1: Read the current implementation**

Read `src/pages/restaurant/RecipeInventory.tsx` in full around the current `handleAutoCreatePO` function (currently ~lines 885–932) and its call site (currently ~line 1662, `onClick={() => { void handleAutoCreatePO(lowStockIngredients); }}`) to confirm exact current line numbers and surrounding context before editing — this file has been touched by no other task today, but line numbers in this plan are approximate locators, not guaranteed exact.

- [ ] **Step 2: Replace `handleAutoCreatePO`**

Replace the entire current function body with:

```ts
async function handleAutoCreatePO() {
  setPOSubmitting(true);
  try {
    const { data, error } = await supabase.rpc('generate_low_stock_purchase_orders');
    if (error) { toast.error(error.message); return; }
    const count = (data as number) ?? 0;
    if (count === 0) {
      toast.info('No new purchase orders needed — all low-stock ingredients are already on an open PO.');
    } else {
      toast.success(`Auto-generated ${count} purchase order${count !== 1 ? 's' : ''} (grouped by supplier)`);
    }
    setActiveTab('purchase-orders');
    void loadData();
  } finally {
    setPOSubmitting(false);
  }
}
```

Keep the function name `handleAutoCreatePO` (call sites and any test mocks referencing it by name stay valid). `toast.info(...)` is an established pattern in this codebase (e.g. `src/context/AppContext.tsx:659`, `src/pages/restaurant/TableManagement.tsx:179,314`) — use it as written above.

- [ ] **Step 3: Update the call site**

Change the button's handler from `onClick={() => { void handleAutoCreatePO(lowStockIngredients); }}` to `onClick={() => { void handleAutoCreatePO(); }}` — the function no longer takes an argument since the RPC recomputes shortages server-side from live data.

Leave the `lowStockIngredients` `useMemo` (currently ~line 946: `ingredients.filter((i) => i.is_active && i.par_level > 0 && i.current_stock < i.par_level)`) completely unchanged — it still drives the "Purchase Orders" tab badge count and the "N ingredients below par level" banner text next to the button, which are both still accurate client-side hints even though the actual generation now happens server-side.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Full suite regression check**

Run: `npx vitest run`
Expected: no regressions. This file's existing behavior for every other handler is untouched — only `handleAutoCreatePO` and its call site changed. If `RecipeInventory.tsx` has no existing test file, no new test is required for this task (the change swaps client-side row-building for one RPC call with a toast on each branch — there is no existing test-file convention to extend here, and adding one is disproportionate to a two-branch toast-selection change); if a test file already exists for this component and covers `handleAutoCreatePO`, update it to match the new RPC-call shape instead of asserting on the old client-side insert calls.

- [ ] **Step 6: Commit**

```bash
git add src/pages/restaurant/RecipeInventory.tsx
git commit -m "feat(restaurant): wire Auto-Create PO button to the new supplier-grouped RPC

Replaces the button's client-side single-PO-no-supplier logic with a
call to generate_low_stock_purchase_orders(), matching what the new
nightly cron sweep does — one source of truth for the grouping and
duplicate-exclusion logic instead of two."
```
