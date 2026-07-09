# Split Table Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff move a subset of a table's order items to a different, currently-available table, creating two independent orders — the "split" half of the roadmap's Tier 2.3 "table merge/split" item (merge is already covered by `fn_transfer_table_order`).

**Architecture:** A new `fn_split_table_order` RPC validates and re-parents selected `restaurant_order_items` rows onto a newly created `table_orders` row at the target table. A new `SplitTableModal.tsx` component (mirroring `TableTransferModal.tsx`'s structure) presents the item checklist and target-table picker, wired into both `TableManagement.tsx` and `WaiterInterface.tsx` next to the existing Transfer action.

**Tech Stack:** PostgreSQL/Supabase (SQL migration, PL/pgSQL, RLS), React/TypeScript frontend, Vitest.

## Global Constraints

- TypeScript strict, no `any` — use `unknown` and narrow.
- Dark theme palette: `bg-slate-900`/`bg-slate-950`/`bg-white/5`/`bg-white/10`, `text-white` variants, `border-white/10`/`border-white/20`, primary button `bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl`.
- `useTranslation()`'s `t(key, defaultValue)` pattern for all new UI copy, matching every existing restaurant component including `TableTransferModal.tsx`.
- The RPC must use `IS DISTINCT FROM` for its tenant-ownership check, not `<>` — this platform's established fix for the NULL-comparison auth-bypass class (`20260709_000063`).
- A bundle's `restaurant_order_items` rows (grouped by `bundle_id`) may never be split across the two orders — enforced server-side in the RPC, not just in the UI.
- No pgTAP or automated SQL-migration test framework in this repo — the RPC's correctness is verified by careful manual review against this plan's exact quoted SQL, matching the convention used for every migration this session (`000058`–`000064`).
- Full design reference: `docs/superpowers/specs/2026-07-10-split-table-order-design.md`.

---

### Task 1: Database migration — fn_split_table_order RPC

**Files:**
- Create: `supabase/migrations/20260710_000065_split_table_order.sql`
- Modify: `CLAUDE.md` (append new migration list entry after the current final entry)

**Interfaces:**
- Produces: `fn_split_table_order(p_source_order_id UUID, p_target_table_id UUID, p_item_ids UUID[]) RETURNS UUID` — the new order's id. Raises `permission_denied` (wrong/no tenant), `bundle_split_not_allowed` (partial bundle selection), `split_would_empty_source_order` (selecting every item), `target_table_occupied` (target not available or not found for this tenant), or a plain "not found"/"not splittable" message for a missing/non-transferable source order.
- Consumes: nothing from other tasks — self-contained, must land first (Task 2's modal calls this RPC).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260710_000065_split_table_order.sql`:

```sql
-- ============================================================
-- Migration: Split Table Order
--
-- Adds the "split" half of the Tier 2.3 roadmap item "table
-- merge/split" — the merge case is already covered by
-- fn_transfer_table_order (20260706_000054). This adds the ability
-- to divide one table's order into two: staff select a subset of the
-- current order's items and a currently-available target table; the
-- selected items move to a brand-new order at that table, and the
-- source order keeps the rest.
--
-- Full design: docs/superpowers/specs/2026-07-10-split-table-order-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION fn_split_table_order(
  p_source_order_id UUID,
  p_target_table_id UUID,
  p_item_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id        UUID;
  v_source_table_id  UUID;
  v_source_status    TEXT;
  v_waiter_id        UUID;
  v_new_order_id     UUID;
  v_total_item_count INT;
  v_selected_count   INT;
BEGIN
  -- Validate and lock the source order
  SELECT tenant_id, table_id, status, waiter_id
    INTO v_tenant_id, v_source_table_id, v_source_status, v_waiter_id
    FROM table_orders
    WHERE id = p_source_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_source_order_id;
  END IF;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_source_status NOT IN ('open', 'sent', 'served') THEN
    RAISE EXCEPTION 'Order % is not splittable (status = %)', p_source_order_id, v_source_status;
  END IF;

  IF array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No items selected to split';
  END IF;

  -- All selected items must belong to this order and this tenant
  SELECT count(*) INTO v_selected_count
    FROM restaurant_order_items
    WHERE id = ANY(p_item_ids) AND order_id = p_source_order_id AND tenant_id = v_tenant_id;

  IF v_selected_count IS DISTINCT FROM array_length(p_item_ids, 1) THEN
    RAISE EXCEPTION 'One or more selected items do not belong to this order';
  END IF;

  -- Bundle guard: no bundle may be split across the two orders
  IF EXISTS (
    SELECT 1 FROM restaurant_order_items roi
    WHERE roi.order_id = p_source_order_id
      AND roi.bundle_id IS NOT NULL
      AND roi.bundle_id IN (
        SELECT bundle_id FROM restaurant_order_items
        WHERE id = ANY(p_item_ids) AND bundle_id IS NOT NULL
      )
      AND roi.id != ALL(p_item_ids)
  ) THEN
    RAISE EXCEPTION 'bundle_split_not_allowed';
  END IF;

  -- Non-empty-remainder guard
  SELECT count(*) INTO v_total_item_count
    FROM restaurant_order_items WHERE order_id = p_source_order_id;

  IF v_selected_count = v_total_item_count THEN
    RAISE EXCEPTION 'split_would_empty_source_order';
  END IF;

  -- Target table must be same tenant and currently available
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_tables
    WHERE id = p_target_table_id AND tenant_id = v_tenant_id AND status = 'available'
  ) THEN
    RAISE EXCEPTION 'target_table_occupied';
  END IF;

  -- Create the new order at the target table
  INSERT INTO table_orders (tenant_id, table_id, status, current_course, waiter_id)
  VALUES (v_tenant_id, p_target_table_id, v_source_status, 'mains', v_waiter_id)
  RETURNING id INTO v_new_order_id;

  -- Move the selected items
  UPDATE restaurant_order_items
    SET order_id = v_new_order_id
    WHERE id = ANY(p_item_ids) AND tenant_id = v_tenant_id;

  UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

  RETURN v_new_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_split_table_order(uuid, uuid, uuid[]) FROM anon;
```

- [ ] **Step 2: Manual verification pass**

Read the file with fresh eyes and confirm:
1. `SET search_path = 'public'` is present on the function.
2. The tenant-ownership check uses `IS DISTINCT FROM`, not `<>`.
3. The bundle guard correctly compares "rows in the source order sharing a bundle_id with the selection" against "the selection itself" (`roi.id != ALL(p_item_ids)`) — trace through a concrete example: order has bundle rows A, B, C (same `bundle_id`) plus a regular item D; selecting `[A, B]` (not C) must raise `bundle_split_not_allowed`; selecting `[A, B, C]` must NOT raise it.
4. The non-empty-remainder check correctly compares `v_selected_count` against the TOTAL item count on the source order (not some other count).
5. `REVOKE EXECUTE ... FROM anon` is present.

- [ ] **Step 3: Update CLAUDE.md's migration list**

Add a new entry immediately after the current final entry, matching the established one-paragraph style (see any recent entry for the format). Content:

```
`20260710_000065_split_table_order.sql` — adds `fn_split_table_order(p_source_order_id, p_target_table_id, p_item_ids)` RPC (Tier 2.3, the split half of "table merge/split" — merge was already covered by `fn_transfer_table_order`). Moves a staff-selected subset of a table's order items to a new order at a currently-available target table. Guards: a preset-order-bundle's component rows (shared `bundle_id`) can never be split across the two orders; selecting every item on the source order is rejected in favor of the existing Transfer flow; target table must have no open order.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_000065_split_table_order.sql CLAUDE.md
git commit -m "feat(restaurant): add fn_split_table_order RPC (Tier 2.3)

Lets staff divide one table's order into two — move a selected subset
of items to a new order at an available table, keeping the rest on the
source order. Bundle rows can never be split across the two orders."
```

---

### Task 2: SplitTableModal.tsx component

**Files:**
- Create: `src/components/restaurant/SplitTableModal.tsx`
- Test: `src/components/restaurant/SplitTableModal.test.tsx`

**Interfaces:**
- Consumes: `fn_split_table_order(p_source_order_id, p_target_table_id, p_item_ids)` RPC from Task 1.
- Produces: `SplitTableModal` React component with props:
  ```ts
  interface SplitTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenantId: string;
    sourceTable: RestaurantTable;
    sourceOrder: TableOrder;
    sourceOrderItems: RestaurantOrderItem[];
    tables: RestaurantTable[];
  }
  ```
  (Task 3 wires this into both `TableManagement.tsx` and `WaiterInterface.tsx`, using each file's already-computed `selectedOrderItems`/`items` array for `sourceOrderItems` and `tables`/`allTables` for `tables`.)

- [ ] **Step 1: Write the failing test**

Create `src/components/restaurant/SplitTableModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

import SplitTableModal from './SplitTableModal';
import type { RestaurantTable, TableOrder, RestaurantOrderItem } from '@/types/restaurant';

const sourceTable: RestaurantTable = {
  id: 'table-1', tenant_id: 't1', number: 1, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};
const availableTable: RestaurantTable = {
  id: 'table-2', tenant_id: 't1', number: 2, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'available',
};
const occupiedTable: RestaurantTable = {
  id: 'table-3', tenant_id: 't1', number: 3, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

const sourceOrder: TableOrder = {
  id: 'order-1', tenant_id: 't1', table_id: 'table-1', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-10T10:00:00Z', closed_at: null,
};

function makeItem(overrides: Partial<RestaurantOrderItem>): RestaurantOrderItem {
  return {
    id: 'item-1', tenant_id: 't1', order_id: 'order-1', menu_item_id: null,
    product_name: 'Burger', quantity: 1, unit_price: 10, modifiers: [], course: 'mains',
    status: 'pending', bundle_id: null, notes: null, sent_at: null, ready_at: null,
    ...overrides,
  };
}

const itemA = makeItem({ id: 'item-a', product_name: 'Burger' });
const itemB = makeItem({ id: 'item-b', product_name: 'Fries' });
const bundleItem1 = makeItem({ id: 'bundle-1', product_name: 'Prix Fixe — Starter', bundle_id: 'bundle-x' });
const bundleItem2 = makeItem({ id: 'bundle-2', product_name: 'Prix Fixe — Main', bundle_id: 'bundle-x' });

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 't1',
  sourceTable,
  sourceOrder,
  sourceOrderItems: [itemA, itemB],
  tables: [sourceTable, availableTable, occupiedTable],
};

describe('SplitTableModal', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'new-order-1', error: null });
    baseProps.onClose = vi.fn();
    baseProps.onSuccess = vi.fn();
  });

  it('lists target tables limited to those with status available', () => {
    render(<SplitTableModal {...baseProps} />);
    expect(screen.getByText(/Table 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Table 3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();
  });

  it('keeps submit disabled until an item and a target table are both selected', () => {
    render(<SplitTableModal {...baseProps} />);
    const submitButton = screen.getByRole('button', { name: /split/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Burger/i));
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('disables selecting every item (would empty the source order)', () => {
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.click(screen.getByLabelText(/Fries/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    expect(screen.getByRole('button', { name: /split/i })).toBeDisabled();
  });

  it('calls fn_split_table_order with the selected item ids and target table', async () => {
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_split_table_order', {
        p_source_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_item_ids: ['item-a'],
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('groups bundle rows as one unit — selecting one selects all of that bundle, and they cannot be individually deselected from each other', () => {
    render(
      <SplitTableModal
        {...baseProps}
        sourceOrderItems={[itemA, bundleItem1, bundleItem2]}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Prix Fixe — Starter/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    return waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_split_table_order', {
        p_source_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_item_ids: expect.arrayContaining(['bundle-1', 'bundle-2']),
      });
    });
  });

  it('maps bundle_split_not_allowed to a friendly message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'bundle_split_not_allowed' } });
    const { toast } = await import('sonner');
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SplitTableModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/restaurant/SplitTableModal.test.tsx`
Expected: FAIL — `SplitTableModal` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `SplitTableModal.tsx`**

Read `src/components/restaurant/TableTransferModal.tsx` first — mirror its structure (imports, dark-theme styling, `useTranslation()` usage, modal shell) closely. Implement:

- Group `sourceOrderItems` by `bundle_id` (nullable): items with the same non-null `bundle_id` render as ONE checkbox row (label shows the first item's `product_name`, e.g. via `bundleItem1.product_name`, so the test's `/Prix Fixe — Starter/i` label match works), checking it selects every item id in that bundle group at once; items with `bundle_id === null` render as independent checkboxes.
- Track selected item ids in state (`Set<string>` or `string[]`).
- Target-table `<select>` (`aria-label="Target table"` to match the test's `getByLabelText(/target table/i)`) listing only `tables.filter(t => t.status === 'available')`.
- Submit button labeled to match `/split/i` (e.g. "Split Table" / "Confirm Split") — disabled when: no items selected, OR no target table selected, OR the selection covers every item in `sourceOrderItems` (client-side mirror of the server's empty-remainder guard, for immediate feedback).
- On submit: `supabase.rpc('fn_split_table_order', { p_source_order_id: sourceOrder.id, p_target_table_id: targetTableId, p_item_ids: selectedItemIds })`.
- Error mapping (mirroring `QRCart.tsx`'s `mapPlaceOrderError` pattern, scaled to 3 codes): `bundle_split_not_allowed` → "Bundle items must move together." / `split_would_empty_source_order` → "Select fewer items — at least one must stay on this table." / `target_table_occupied` → "That table is no longer available." / anything else → generic "Failed to split table" message. Show via `toast.error(...)`, do NOT close the modal on error.
- On success: `toast.success(...)`, call `onSuccess()`, call `onClose()`.
- `isOpen === false` → render `null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/restaurant/SplitTableModal.test.tsx`
Expected: PASS (7/7)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/restaurant/SplitTableModal.tsx src/components/restaurant/SplitTableModal.test.tsx
git commit -m "feat(restaurant): add SplitTableModal component

Standalone component for Tier 2.3 table splitting — not yet wired into
any page (Task 3). Groups preset-order-bundle rows as one non-separable
selection unit; limits the target-table picker to available tables."
```

---

### Task 3: Wire SplitTableModal into TableManagement.tsx and WaiterInterface.tsx

**Files:**
- Modify: `src/pages/restaurant/TableManagement.tsx`
- Modify: `src/pages/restaurant/WaiterInterface.tsx`

**Interfaces:**
- Consumes: `SplitTableModal` from Task 2, with the exact prop shape defined there.

Both files already have a `TableTransferModal` wired in with a "Transfer" button next to it — this task adds a parallel "Split" button and modal render, following the exact same state/prop pattern already present for Transfer in each file.

- [ ] **Step 1: `TableManagement.tsx` — add state and import**

Near the existing `const [showTransferModal, setShowTransferModal] = useState(false);` (around line 109), add:

```ts
const [showSplitModal, setShowSplitModal] = useState(false);
```

Add the import alongside the existing `TableTransferModal` import:

```ts
import SplitTableModal from '@/components/restaurant/SplitTableModal';
```

- [ ] **Step 2: `TableManagement.tsx` — add the Split button**

In the Active Order header's button row (around lines 621-630, right after the existing `RoleGate action="make_sales"` block that renders the Transfer button), add a second `RoleGate`-wrapped button, shown only when there are at least 2 items to split from:

```tsx
{selectedOrderItems.length >= 2 && (
  <RoleGate action="make_sales">
    <button
      onClick={() => setShowSplitModal(true)}
      className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-2.5 py-1.5 text-xs font-semibold text-violet-400 hover:bg-violet-500/30 transition-all"
    >
      <Split className="h-3 w-3" />
      {t('restaurant.split', 'Split')}
    </button>
  </RoleGate>
)}
```

Add `Split` to the existing `lucide-react` import at the top of the file (alongside whatever icons — e.g. `ArrowLeftRight` — are already imported there). Note: `SplitSquareHorizontal` does NOT exist in this repo's lucide-react version — use `Split`.

- [ ] **Step 3: `TableManagement.tsx` — render the modal**

Immediately after the existing `{showTransferModal && selectedTable && selectedOrder && (...)}` block (around line 944, right before the closing `</Layout>`), add:

```tsx
{showSplitModal && selectedTable && selectedOrder && (
  <SplitTableModal
    isOpen={showSplitModal}
    onClose={() => setShowSplitModal(false)}
    onSuccess={() => { void loadData(); }}
    tenantId={tenantId ?? ''}
    sourceTable={selectedTable}
    sourceOrder={selectedOrder}
    sourceOrderItems={selectedOrderItems}
    tables={tables}
  />
)}
```

- [ ] **Step 4: `WaiterInterface.tsx` — add state, import, button, and modal**

Same four changes, mirroring the Transfer wiring already present in this file:

State (near the existing `showTransferModal` state):
```ts
const [showSplitModal, setShowSplitModal] = useState(false);
```

Import:
```ts
import SplitTableModal from '@/components/restaurant/SplitTableModal';
```

Button — immediately after the existing Transfer button's `</RoleGate>` (around line 1392), before the closing `</>` / `)}`:

```tsx
{items.length >= 2 && (
  <RoleGate action="make_sales">
    <button
      onClick={() => setShowSplitModal(true)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 py-3 text-sm font-semibold text-violet-400 transition-all hover:bg-violet-500/20"
    >
      <Split className="h-4 w-4" />
      {t('restaurant.split', 'Split Table')}
    </button>
  </RoleGate>
)}
```

Add `Split` to this file's existing `lucide-react` import too (`SplitSquareHorizontal` does NOT exist in this repo's lucide-react version).

Modal render — immediately after the existing `{showTransferModal && order && (...)}` block (around line 1679). Despite its name, `onOrderClosed` is this file's established generic "refresh the parent's table/order state" callback — it's already called for non-closing actions too (e.g. opening a brand-new order, line 1233), always paired with `onClose()` (which returns the waiter from this `TableDetail` overlay to the floor plan). Follow that exact existing pattern, matching Transfer's own `onSuccess` handler verbatim:

```tsx
{showSplitModal && order && (
  <SplitTableModal
    isOpen={showSplitModal}
    onClose={() => setShowSplitModal(false)}
    onSuccess={() => { setShowSplitModal(false); onClose(); onOrderClosed(); }}
    tenantId={tenantId ?? ''}
    sourceTable={table}
    sourceOrder={order}
    sourceOrderItems={items}
    tables={allTables}
  />
)}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Manual smoke check**

Run: `npx vitest run` (full suite)
Expected: all existing tests still pass — this task doesn't change either file's existing logic, only adds new state/UI, so zero regressions are expected. If anything in `TableManagement.test.tsx` or a `WaiterInterface` test file breaks, investigate before committing.

- [ ] **Step 7: Commit**

```bash
git add src/pages/restaurant/TableManagement.tsx src/pages/restaurant/WaiterInterface.tsx
git commit -m "feat(restaurant): wire Split Table action into staff order views

Adds a Split button next to the existing Transfer action in both
TableManagement.tsx and WaiterInterface.tsx, gated to orders with 2+
items (can't split 1 item into two non-empty orders)."
```
