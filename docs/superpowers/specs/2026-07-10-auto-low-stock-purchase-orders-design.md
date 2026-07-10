# Automatic Low-Stock Purchase Order Generation — Design Spec

**Date:** 2026-07-10
**Status:** Approved for planning

## Problem

The F&B competitive gap analysis lists "auto-generated purchase orders on low-stock threshold" as a Tier 2 roadmap item, described as "a verification task against existing infrastructure, not a build from scratch." An earlier investigation incorrectly concluded no generation logic existed anywhere in the codebase — it missed `RecipeInventory.tsx`, which already has a fully-working manual "Auto-Create PO" button (`handleAutoCreatePO`) that computes shortage quantities (`par_level - current_stock`) for every ingredient below par and creates a single draft `restaurant_purchase_orders` row.

Two real gaps remain in that existing feature:
1. **No unattended generation.** A staff member has to be looking at this exact tab and click the button — there's no scheduled/automatic path, so shortages that occur when no one is on this screen go unnoticed until someone happens to check.
2. **No supplier grouping.** The existing button dumps every shortage into one PO with `supplier_id: null`, even though `restaurant_ingredients.supplier_id` links exist — the resulting PO can't actually be sent to any one supplier without manual splitting first.

## Goals

- A nightly, unattended job creates draft POs for every tenant's low-stock ingredients, with no staff action required.
- Both the new automatic path and the existing manual button produce POs correctly grouped by supplier — one draft PO per supplier, ingredients with no assigned supplier fall into a single "unassigned" PO.
- No duplicate re-ordering: an ingredient already on an open (`draft` or `ordered`) PO is excluded from a new auto-generated PO for the same shortage.
- Exactly one place contains the grouping/generation logic — not duplicated between client-side JS and SQL.

## Non-goals

- Sending the auto-generated PO to the supplier (email/WhatsApp/etc.) — it lands as a `draft` for staff to review and mark `ordered` manually, same as any other PO today.
- A dedicated "review auto-drafted POs" UI surface — auto-generated POs appear in the existing PO list (already sortable/filterable by status) with the existing `'Auto-generated from low stock alert'` notes text as the distinguishing signal. No new column or badge.
- Retail (non-restaurant) `products.min_stock_level` — this item is scoped to the restaurant ingredient/PO system (`restaurant_ingredients`, `restaurant_purchase_orders`), matching where the roadmap item originated and where the existing manual button already lives. Retail's separate `PurchaseOrderManagement.tsx`/`ReorderPointManagement.tsx` are untouched.
- Partial-quantity or multi-day reorder scheduling — each run's shortage snapshot is `par_level - current_stock` at the moment it runs, same math the existing button already uses.

## Design

### 1. Internal engine: `fn_generate_low_stock_pos_for_tenant(p_tenant_id UUID) RETURNS INT`

```sql
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
```

Notes carried verbatim into the implementation plan:
- The "already on an open PO" exclusion subquery is repeated three times (the outer `DISTINCT supplier_id` scan, the PO-header aggregate insert, and the items insert) rather than computed once into a temp table — this keeps the function a single statement-sequence with no intermediate state to get out of sync between the header and its items, at the cost of the subquery running three times per tenant. Ingredient counts per tenant are small (tens, not thousands), so this is not a performance concern.
- `ri.supplier_id IS NOT DISTINCT FROM v_supplier.supplier_id` (not `=`) so the `NULL` (unassigned) supplier group matches correctly — plain `=` never matches `NULL = NULL`.
- `GREATEST(ri.par_level - ri.current_stock, 0)` guards against a negative quantity in the pathological case where `current_stock` briefly exceeds `par_level` between the outer filter and this scan (should not happen in practice within one transaction, but costs nothing to guard).
- `REVOKE ... FROM PUBLIC, anon, authenticated` — this function is only ever called by the two wrappers below, from a `SECURITY DEFINER` context; it must never be directly callable with an arbitrary `p_tenant_id`.

### 2. Public RPC: `generate_low_stock_purchase_orders() RETURNS INT`

```sql
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
```

This is what `RecipeInventory.tsx`'s "Auto-Create PO" button calls (`supabase.rpc('generate_low_stock_purchase_orders')`, no arguments) — replacing that handler's current client-side row-building logic entirely, so the grouping fix applies to the manual path too, from the same single source of truth.

### 3. Cron wrapper: `fn_generate_low_stock_pos_all_tenants() RETURNS void`

```sql
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

Runs at 05:00 UTC, after the three existing analytics jobs (23:00–23:30 UTC) and well clear of any dinner-service write load. Unlike those three jobs, this one calls the SQL function directly rather than routing through `pg_net`/an edge function — there's no external API involved, so a direct call is simpler and (per the existing `pg_net` fire-and-forget caveat already documented in `CLAUDE.md`'s Edge Functions section) gives an honest success/failure signal in `cron.job_run_details` instead of always showing "succeeded" regardless of what happened inside.

### 4. Frontend change

`RecipeInventory.tsx`'s `handleAutoCreatePO` (currently ~lines 885–932) is replaced with a call to the new RPC:

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

The button's `onClick={() => { void handleAutoCreatePO(lowStockIngredients); }}` (line ~1662) drops the now-unused `lowStockIngredients` argument — the RPC recomputes shortages server-side from live data, not from whatever the client happened to have loaded. `lowStockIngredients` (the `useMemo` at line ~946) stays as-is; it still drives the tab badge count and the "N ingredients below par level" banner text shown next to the button.

## Data Flow

| Scenario | Flow |
|---|---|
| Nightly sweep, tenant with 2 suppliers' worth of shortages | Cron fires at 05:00 UTC → loops all tenants → this tenant gets 2 draft POs, one per supplier, correctly itemized |
| Staff clicks "Auto-Create PO" mid-day | Same RPC, same grouping — button becomes a manual on-demand trigger for the identical logic the nightly job runs automatically |
| An ingredient is already on a draft PO from yesterday's run | Excluded from today's run (and from a manual click) — no duplicate order for the same shortage until that PO is received or cancelled |
| Tenant has zero low-stock ingredients | Engine's loop runs zero iterations, returns 0 — manual button shows "No new purchase orders needed"; cron sweep silently does nothing for that tenant |

## Testing

- No pgTAP in this repo — manual reasoning-based verification, matching every migration this session: confirm the supplier-grouping loop produces one PO per distinct `supplier_id` (including the `NULL` group via `IS NOT DISTINCT FROM`), confirm the already-open-PO exclusion actually prevents a re-add across two consecutive calls, confirm `REVOKE` is correct on both the internal engine and the cron wrapper (neither should ever be directly callable by `authenticated`/`anon`).
- Frontend: button click with no low-stock ingredients shows the "no new POs needed" message; button click with shortages across 2 suppliers shows "Auto-generated 2 purchase orders"; RPC error shows a toast without crashing the page.
