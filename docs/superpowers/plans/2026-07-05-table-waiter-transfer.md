# Table & Waiter Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff move an open dine-in order to a different table (optionally merging it into another table's existing order to combine bills) and independently reassign which waiter owns an order.

**Architecture:** One new Postgres RPC (`fn_transfer_table_order`) handles the table-move/merge case atomically in a single transaction; a plain direct `.update()` handles waiter-only reassignment (no cascading effects, no RPC needed). One new shared React modal (`TableTransferModal`) is wired into both `TableManagement.tsx` (floor plan) and `WaiterInterface.tsx` (waiter's active-order screen).

**Tech Stack:** React 18 + TypeScript (strict), Supabase Postgres (plpgsql RPC), Vitest + Testing Library, Tailwind, react-i18next, sonner (toasts), lucide-react (icons).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-05-table-waiter-transfer-design.md` — read it before starting; every task below implements a section of it.
- No new tables. Only `table_orders` gets a new nullable column (`merged_into_order_id`) and a new valid `status` value (`'merged'` — no CHECK constraint exists on this column, confirmed in `supabase/migrations/20260620_000031_restaurant_schema.sql`, so this needs no constraint migration).
- Migrations in this repo are delivered as files and applied manually via the Supabase Dashboard SQL Editor — do NOT apply the new migration directly to the live project (`pytndxjeznhhyycjasep`) unless the human explicitly authorizes it for this specific migration.
- Deviation from the design spec, found during planning: the spec mentioned writing to `activity_log` from the RPC. Verified this is NOT an established pattern — no existing RPC in this codebase writes to `activity_log` (confirmed via repo-wide grep), including the closest analogous RPC, `fn_close_restaurant_bill` (a money-adjacent action that also doesn't audit-log). Dropped from this plan to match existing precedent — do not add it back without checking with the human first.
- RBAC: any staff role except `viewer` can perform a transfer. The `RoleGate`/`canPerform` mechanism actually wired up (`src/context/SubscriptionContext.tsx`) uses the **legacy** 4-role `UserRole`/`ROLE_ACTIONS` system (not the newer 8-role `ROLE_PERMISSIONS` used by `CustomRolesManager`). Reuse the existing `'make_sales'` action for `RoleGate` — it already means "cashier and up, not viewer" under the legacy system, exactly matching the approved design decision. Do not add a new `RoleAction`.
- TypeScript strict mode + `noUncheckedIndexedAccess`. No `any`. Run `npm run typecheck` after every task.
- `@/` path alias for all cross-directory imports (this repo's established convention for anything outside very old legacy components).

---

### Task 1: Migration — schema change + `fn_transfer_table_order` RPC

**Files:**
- Create: `supabase/migrations/20260706_000054_table_waiter_transfer.sql`
- Modify: `CLAUDE.md` (Database Migrations numbered list, entry 54)

**Interfaces:**
- Produces: RPC `fn_transfer_table_order(p_order_id uuid, p_target_table_id uuid, p_new_waiter_id uuid default null) returns uuid` — callable via `supabase.rpc('fn_transfer_table_order', { p_order_id, p_target_table_id, p_new_waiter_id })`. Returns the UUID of the order that now represents the party (the target order in a merge, the moved order otherwise). Raises a Postgres exception (surfaced as `error` on the JS client) for: source order not found/not transferable, target table not found, or target table same as source table.
- Produces: `table_orders.merged_into_order_id` column (nullable UUID, FK to `table_orders.id`) and the `'merged'` status value convention — consumed by Task 2's modal logic (a target table is "occupied" only when it has an order with `status IN ('open','sent','served')`; `'merged'` orders are excluded from that check automatically since they're no longer in that set).
- Consumes: existing tables `table_orders`, `restaurant_tables`, `restaurant_order_items`, `restaurant_argile_sessions` — no schema changes to any of these beyond the one new column noted above.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260706_000054_table_waiter_transfer.sql
-- Table & Waiter Transfer (Tier 1.1 + 1.2, docs/fnb-competitive-gap-analysis.md).
-- See docs/superpowers/specs/2026-07-05-table-waiter-transfer-design.md for full design.
--
-- No CHECK constraint exists on table_orders.status (confirmed in
-- 20260620_000031_restaurant_schema.sql), so the new 'merged' status value needs no
-- schema change of its own — only this comment documenting the convention:
-- table_orders.status now also accepts 'merged', meaning this order's items were
-- folded into another order (see merged_into_order_id) rather than closed/cancelled.

ALTER TABLE table_orders
  ADD COLUMN IF NOT EXISTS merged_into_order_id UUID REFERENCES table_orders(id);

CREATE OR REPLACE FUNCTION fn_transfer_table_order(
  p_order_id UUID,
  p_target_table_id UUID,
  p_new_waiter_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_source_table_id UUID;
  v_source_status TEXT;
  v_target_order_id UUID;
  v_resulting_order_id UUID;
BEGIN
  -- 1. Validate and lock the source order
  SELECT tenant_id, table_id, status
    INTO v_tenant_id, v_source_table_id, v_source_status
    FROM table_orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_source_status NOT IN ('open', 'sent', 'served') THEN
    RAISE EXCEPTION 'Order % is not transferable (status = %)', p_order_id, v_source_status;
  END IF;

  -- 2. Validate the target table belongs to the same tenant and isn't the source table
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_tables WHERE id = p_target_table_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Target table % not found for this tenant', p_target_table_id;
  END IF;

  IF p_target_table_id = v_source_table_id THEN
    RAISE EXCEPTION 'Target table is the same as the source table';
  END IF;

  -- 3. Find and lock the target table's open order, if any
  SELECT id INTO v_target_order_id
    FROM table_orders
    WHERE table_id = p_target_table_id
      AND tenant_id = v_tenant_id
      AND status IN ('open', 'sent', 'served')
    FOR UPDATE;

  IF v_target_order_id IS NULL THEN
    -- Simple move: no order at the target table
    UPDATE table_orders SET table_id = p_target_table_id WHERE id = p_order_id;
    UPDATE restaurant_tables SET status = 'available' WHERE id = v_source_table_id;
    UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;
    v_resulting_order_id := p_order_id;
  ELSE
    -- Merge: target table already has an open order — combine into one bill
    UPDATE restaurant_order_items
      SET order_id = v_target_order_id
      WHERE order_id = p_order_id AND tenant_id = v_tenant_id;

    UPDATE restaurant_argile_sessions
      SET table_order_id = v_target_order_id
      WHERE table_order_id = p_order_id AND tenant_id = v_tenant_id AND status = 'active';

    UPDATE table_orders
      SET status = 'merged', merged_into_order_id = v_target_order_id, closed_at = now()
      WHERE id = p_order_id;

    UPDATE restaurant_tables SET status = 'available' WHERE id = v_source_table_id;
    -- Target table's status is already 'occupied' — no change needed.
    v_resulting_order_id := v_target_order_id;
  END IF;

  -- 4. Optional waiter reassignment, applied to whichever order now represents the party
  IF p_new_waiter_id IS NOT NULL THEN
    UPDATE table_orders SET waiter_id = p_new_waiter_id WHERE id = v_resulting_order_id;
  END IF;

  RETURN v_resulting_order_id;
END;
$$;
```

- [ ] **Step 2: Static sanity check (no live database needed)**

Run:
```bash
grep -c "CREATE OR REPLACE FUNCTION fn_transfer_table_order" supabase/migrations/20260706_000054_table_waiter_transfer.sql
grep -c "ALTER TABLE table_orders" supabase/migrations/20260706_000054_table_waiter_transfer.sql
```
Expected: `1` and `1`.

Also verify every `BEGIN`/`END` and `$$` pair is balanced by eye — the file should have exactly two `$$` markers (opening and closing the function body).

- [ ] **Step 3: Add the migration to CLAUDE.md's numbered Database Migrations list**

Read `CLAUDE.md`, find the numbered list under `## Database Migrations`, and append this line after the last entry (currently ending at 53):

```markdown
54. `20260706_000054_table_waiter_transfer.sql` — adds table_orders.merged_into_order_id + fn_transfer_table_order() RPC for table/waiter transfer (Tier 1.1 + 1.2); introduces 'merged' as a valid table_orders.status value (no CHECK constraint exists on that column)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260706_000054_table_waiter_transfer.sql CLAUDE.md
git commit -m "feat(f&b): add table & waiter transfer RPC (Tier 1.1 + 1.2)

New fn_transfer_table_order() RPC handles both a simple table move and
a merge-into-occupied-table case atomically in one transaction. Table
merge repoints restaurant_order_items and active restaurant_argile_sessions
to the target order, and marks the source order 'merged' rather than
deleting it (audit trail via merged_into_order_id). Not yet applied to
the live database — file delivered per this project's migration
convention; apply manually via Supabase Dashboard SQL Editor."
```

**Note for the human operator (not an implementer step — just documentation):** once this migration is applied, a manual smoke test in the SQL Editor looks like:
```sql
-- Simple move: pick any two tables for a real tenant, one with an open order, one without
select fn_transfer_table_order('<open-order-id>', '<empty-table-id>');
-- Merge: pick a target table that already has its own open order
select fn_transfer_table_order('<open-order-id>', '<occupied-table-id>');
-- Then inspect: select * from table_orders where id in ('<open-order-id>');
```

---

### Task 2: `TableTransferModal` component (TDD)

**Files:**
- Create: `src/components/restaurant/TableTransferModal.tsx`
- Test: `src/components/restaurant/TableTransferModal.test.tsx`

**Interfaces:**
- Consumes: `RestaurantTable`, `TableOrder` from `@/types/restaurant` (unchanged); `Employee` from `@/context/AppContext` (unchanged); `supabase` from `@/utils/supabaseClient` (unchanged) — calls either `supabase.rpc('fn_transfer_table_order', { p_order_id, p_target_table_id, p_new_waiter_id })` (Task 1's RPC) or `supabase.from('table_orders').update({ waiter_id }).eq('id', ...).eq('tenant_id', ...)`.
- Produces: default export `TableTransferModal(props: TableTransferModalProps)`, a React component. Props:
  ```ts
  interface TableTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenantId: string;
    sourceTable: RestaurantTable;
    sourceOrder: TableOrder;
    sourceOrderItemCount: number;
    currentWaiterId: string | null;
    tables: RestaurantTable[];
    orders: TableOrder[];
    employees: Employee[];
  }
  ```
  Consumed by Task 3 (`TableManagement.tsx`) and Task 4 (`WaiterInterface.tsx`) with these exact prop names.

- [ ] **Step 1: Write the failing tests**

Create `src/components/restaurant/TableTransferModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: () => ({ eq: (...eqArgs: unknown[]) => mockEq2(...eqArgs) }) };
      },
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import TableTransferModal from './TableTransferModal';
import type { RestaurantTable, TableOrder } from '@/types/restaurant';
import type { Employee } from '@/context/AppContext';

const sourceTable: RestaurantTable = {
  id: 'table-1', tenant_id: 't1', number: 1, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};
const emptyTable: RestaurantTable = {
  id: 'table-2', tenant_id: 't1', number: 2, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'available',
};
const occupiedTable: RestaurantTable = {
  id: 'table-3', tenant_id: 't1', number: 3, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

const sourceOrder: TableOrder = {
  id: 'order-1', tenant_id: 't1', table_id: 'table-1', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-06T10:00:00Z', closed_at: null,
};
const targetOccupiedOrder: TableOrder = {
  id: 'order-2', tenant_id: 't1', table_id: 'table-3', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-06T09:00:00Z', closed_at: null,
};

const employees: Employee[] = [
  { id: 'emp-1', name: 'Ahmad', email: 'a@x.com', role: 'cashier', commission: 0, totalSales: 0, shifts: [] },
];

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 't1',
  sourceTable,
  sourceOrder,
  sourceOrderItemCount: 3,
  currentWaiterId: null,
  tables: [sourceTable, emptyTable, occupiedTable],
  orders: [sourceOrder, targetOccupiedOrder],
  employees,
};

describe('TableTransferModal', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'order-1', error: null });
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    baseProps.onClose = vi.fn();
    baseProps.onSuccess = vi.fn();
  });

  it('lists target tables excluding the source table, flagging occupied ones', () => {
    render(<TableTransferModal {...baseProps} />);
    expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Table 2/)).toBeInTheDocument();
    expect(screen.getByText(/Table 3.*will merge/i)).toBeInTheDocument();
  });

  it('calls the RPC directly for a simple move (target table has no open order)', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_new_waiter_id: null,
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('requires an extra confirmation step before merging into an occupied table', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-3' } });
    fireEvent.click(screen.getByRole('button', { name: /review merge/i }));

    expect(screen.getByText(/combine 3 items from table 1 into table 3/i)).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /combine bills/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-3',
        p_new_waiter_id: null,
      });
    });
  });

  it('uses a direct update (not the RPC) for a waiter-only reassignment', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/waiter/i), { target: { value: 'emp-1' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ waiter_id: 'emp-1' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(baseProps.onSuccess).toHaveBeenCalled();
  });

  it('shows an error toast and does not close on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<TableTransferModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/restaurant/TableTransferModal.test.tsx`
Expected: FAIL — `Cannot find module './TableTransferModal'` (file doesn't exist yet).

- [ ] **Step 3: Write the component**

Create `src/components/restaurant/TableTransferModal.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, ArrowLeftRight, AlertTriangle } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import type { RestaurantTable, TableOrder } from '@/types/restaurant';
import type { Employee } from '@/context/AppContext';

const OPEN_STATUSES = ['open', 'sent', 'served'];

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  sourceTable: RestaurantTable;
  sourceOrder: TableOrder;
  sourceOrderItemCount: number;
  currentWaiterId: string | null;
  tables: RestaurantTable[];
  orders: TableOrder[];
  employees: Employee[];
}

export default function TableTransferModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  sourceTable,
  sourceOrder,
  sourceOrderItemCount,
  currentWaiterId,
  tables,
  orders,
  employees,
}: TableTransferModalProps) {
  const { t } = useTranslation();
  const [targetTableId, setTargetTableId] = useState('');
  const [waiterId, setWaiterId] = useState(currentWaiterId ?? '');
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const candidateTables = tables.filter((tbl) => tbl.id !== sourceTable.id);
  const isTableMove = targetTableId !== '';
  const targetOrder = isTableMove
    ? orders.find((o) => o.table_id === targetTableId && OPEN_STATUSES.includes(o.status))
    : undefined;
  const isMerge = Boolean(targetOrder);
  const noChangeSelected = !isTableMove && waiterId === (currentWaiterId ?? '');
  const targetTableNumber = tables.find((tbl) => tbl.id === targetTableId)?.number ?? '';

  const performTransfer = async () => {
    setSubmitting(true);
    try {
      if (isTableMove) {
        const { error } = await supabase.rpc('fn_transfer_table_order', {
          p_order_id: sourceOrder.id,
          p_target_table_id: targetTableId,
          p_new_waiter_id: waiterId || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('table_orders')
          .update({ waiter_id: waiterId || null })
          .eq('id', sourceOrder.id)
          .eq('tenant_id', tenantId);
        if (error) throw error;
      }
      toast.success(t('restaurant.transferSuccess', 'Order transferred'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[TableTransferModal] transfer error:', err);
      toast.error(t('restaurant.transferError', 'Failed to transfer order'));
    } finally {
      setSubmitting(false);
      setConfirmingMerge(false);
    }
  };

  const handleSubmit = () => {
    if (isMerge && !confirmingMerge) {
      setConfirmingMerge(true);
      return;
    }
    void performTransfer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ArrowLeftRight className="h-5 w-5 text-indigo-400" />
            {t('restaurant.transferOrder', 'Transfer Order')}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmingMerge ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
              <span>
                {t(
                  'restaurant.mergeWarning',
                  `This will combine ${sourceOrderItemCount} item${sourceOrderItemCount === 1 ? '' : 's'} from Table ${sourceTable.number} into Table ${targetTableNumber}'s bill. This cannot be undone.`,
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingMerge(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => { void performTransfer(); }}
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {t('restaurant.combineBills', 'Combine Bills')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="transfer-target-table" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
                {t('restaurant.targetTable', 'Move to table')}
              </label>
              <select
                id="transfer-target-table"
                aria-label="Move to table"
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2"
              >
                <option value="">{t('restaurant.keepCurrentTable', 'Keep current table (waiter only)')}</option>
                {candidateTables.map((tbl) => {
                  const occupied = orders.some(
                    (o) => o.table_id === tbl.id && OPEN_STATUSES.includes(o.status),
                  );
                  return (
                    <option key={tbl.id} value={tbl.id}>
                      {t('restaurant.tableNum', 'Table')} {tbl.number}
                      {occupied ? ` (${t('restaurant.willMerge', 'will merge orders')})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="transfer-waiter" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
                {t('restaurant.reassignWaiter', 'Waiter')}
              </label>
              <select
                id="transfer-waiter"
                aria-label="Waiter"
                value={waiterId}
                onChange={(e) => setWaiterId(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2"
              >
                <option value="">{t('restaurant.noWaiterChange', 'No change')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || noChangeSelected}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isMerge
                ? t('restaurant.reviewMerge', 'Review Merge')
                : t('restaurant.confirmTransfer', 'Confirm Transfer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/restaurant/TableTransferModal.test.tsx`
Expected: PASS — 6 tests.

If the `@/utils/supabaseClient` mock in Step 1 doesn't resolve (a alias-vs-relative-path mismatch), change the `vi.mock('@/utils/supabaseClient', ...)` line to a relative path (`vi.mock('../../utils/supabaseClient', ...)`) and re-run — both should work given this repo's `vitest.config.ts` alias config, but fix whichever the actual error points at.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/restaurant/TableTransferModal.tsx src/components/restaurant/TableTransferModal.test.tsx
git commit -m "feat(f&b): add TableTransferModal component

Shared modal for both TableManagement and WaiterInterface: moves an
open order to another table, or merges it into an already-occupied
table's bill (with an explicit second confirmation step), and/or
reassigns the order's waiter independent of any table change."
```

---

### Task 3: Wire into `TableManagement.tsx`

**Files:**
- Modify: `src/pages/restaurant/TableManagement.tsx`

**Interfaces:**
- Consumes: `TableTransferModal` from Task 2 (exact prop names above), `RoleGate` (existing, `action="make_sales"`), existing local state `tables`, `orders`, `selectedTable`, `selectedOrder`, `selectedOrderItems`, `tenantId`, and `loadData` (all already defined in this file — confirmed at `TableManagement.tsx:103-145`).
- Consumes: `employees` from `useApp()` (`@/context/AppContext`) — not currently destructured in this file, needs adding.

- [ ] **Step 1: Add the new import and modal-open state**

In `src/pages/restaurant/TableManagement.tsx`, add `ArrowLeftRight` to the existing lucide-react import (line 2):

```tsx
import {
  Plus, X, Receipt, Send, Users, ChevronRight, Trash2, Utensils, SplitSquareVertical, Calculator,
  Settings2, Check, Sparkles, CalendarClock, Copy, Link, ArrowLeftRight,
} from 'lucide-react';
```

Add the modal component import near the other component imports (after the `FloorPlan` import):

```tsx
import TableTransferModal from '@/components/restaurant/TableTransferModal';
```

Find the line that destructures `useApp()` (search for `useApp()` in this file) and add `employees` to it if not already present.

Add new state near `selectedTableId` (line 106):

```tsx
  const [showTransferModal, setShowTransferModal] = useState(false);
```

- [ ] **Step 2: Add the "Transfer" button next to "Send KDS" / "Bill"**

In the Active Order header button group (`TableManagement.tsx:612-627`), add a third button:

```tsx
                          <div className="flex gap-1.5">
                            <RoleGate action="make_sales">
                              <button
                                onClick={() => setShowTransferModal(true)}
                                className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/30 transition-all"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                {t('restaurant.transfer', 'Transfer')}
                              </button>
                            </RoleGate>
                            <button
                              onClick={() => { void handleSendToKDS(); }}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-all"
                            >
                              <Send className="h-3 w-3" />
                              {t('restaurant.sendKDS', 'Send KDS')}
                            </button>
                            <button
                              onClick={() => setShowBill(!showBill)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-all"
                            >
                              <Receipt className="h-3 w-3" />
                              {t('restaurant.bill', 'Bill')}
                            </button>
                          </div>
```

- [ ] **Step 3: Render the modal**

Near the end of the component's JSX (alongside any other modals already rendered conditionally — search for how `showBill` or similar flags are used further down, and place this at the same nesting level, just before the component's closing return), add:

```tsx
      {showTransferModal && selectedTable && selectedOrder && (
        <TableTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => { void loadData(); }}
          tenantId={tenantId ?? ''}
          sourceTable={selectedTable}
          sourceOrder={selectedOrder}
          sourceOrderItemCount={selectedOrderItems.length}
          currentWaiterId={(selectedOrder as { waiter_id?: string | null }).waiter_id ?? null}
          tables={tables}
          orders={orders}
          employees={employees}
        />
      )}
```

Note: `selectedOrder` is typed as `TableOrder` (base type, no `waiter_id`), but the underlying `select('*')` query already fetches every column including `waiter_id` — this matches the existing cast pattern already used in `WaiterInterface.tsx` for the same reason (e.g. `(order as TableOrderExtended).service_charge_pct`). Use an inline cast here rather than importing `TableOrderExtended` for one field, since this file doesn't otherwise use that type.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors or warnings (zero-warning lint budget — this file must not introduce any).

- [ ] **Step 5: Manual verification (dev server)**

Run: `npm run dev`, open the Table Management page, select an occupied table, confirm the "Transfer" button appears in the Active Order header and opens the modal. (Full RPC round-trip can't be exercised until Task 1's migration is applied to a real database — verify the modal opens/closes and the button is gated behind `RoleGate` correctly; that's sufficient for this task's scope.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/restaurant/TableManagement.tsx
git commit -m "feat(f&b): wire table transfer into TableManagement floor plan"
```

---

### Task 4: Wire into `WaiterInterface.tsx`

**Files:**
- Modify: `src/pages/restaurant/WaiterInterface.tsx`

**Interfaces:**
- Consumes: `TableTransferModal` from Task 2 (same prop names as Task 3).
- Consumes: outer `WaiterInterface` component's existing state `tables`, `orders` (`WaiterInterface.tsx:1706-1707`) and `useApp()`'s `employees` (not currently destructured at `WaiterInterface.tsx:1701` — needs adding) — threaded down to `TableDetail` as three new props.
- Modifies `TableDetailProps` (`WaiterInterface.tsx:835-843`) to add `allTables: RestaurantTable[]`, `allOrders: TableOrder[]`, `employees: Employee[]`.

- [ ] **Step 1: Add the new import**

Add `ArrowLeftRight` to `WaiterInterface.tsx`'s existing lucide-react import block (the multi-line import starting at line 12):

```tsx
  ArrowLeft,
  X,
  ChevronRight,
  Flame,
  Plus,
  ClipboardList,
  Receipt,
  StickyNote,
  AlertTriangle,
  Check,
  RefreshCw,
  Clock,
  Users,
  Search,
  Minus,
  UtensilsCrossed,
  ShoppingCart,
  ArrowLeftRight,
```

(Insert `ArrowLeftRight,` as the last entry before the closing `} from 'lucide-react';` — check the exact current last entry in the file first, since this list may have more items not shown above; add it as one more line, don't reorder existing ones.)

Add the modal import near the top-level imports (after the `useRestaurantOrder` import or similar):

```tsx
import TableTransferModal from '@/components/restaurant/TableTransferModal';
```

Add the `Employee` type import (not currently imported in this file — confirmed via `grep -n "import.*Employee" src/pages/restaurant/WaiterInterface.tsx` returning nothing):

```tsx
import type { Employee } from '@/context/AppContext';
```

- [ ] **Step 2: Extend `TableDetailProps` and thread new props through**

In `TableDetailProps` (`WaiterInterface.tsx:835-843`), add three fields:

```tsx
interface TableDetailProps {
  tableData: TableWithOrder;
  settings: RestaurantSettings | null;
  menuCategories: RestaurantMenuCategory[];
  menuItems: RestaurantMenuItem[];
  onClose: () => void;
  onOrderClosed: () => void;
  isOnline: boolean;
  allTables: RestaurantTable[];
  allOrders: TableOrder[];
  employees: Employee[];
}
```

Update the `TableDetail` function signature (line 845) to destructure the three new props:

```tsx
function TableDetail({ tableData, settings, menuCategories, menuItems, onClose, onOrderClosed, isOnline, allTables, allOrders, employees }: TableDetailProps) {
```

At the `<TableDetail ...>` call site (`WaiterInterface.tsx:2458-2466`), pass the three new props from the outer component's own state:

```tsx
        <TableDetail
          tableData={selectedTableData}
          settings={settings}
          menuCategories={menuCategories}
          menuItems={menuItems}
          onClose={() => setSelectedTableId(null)}
          onOrderClosed={() => { void loadData(); }}
          isOnline={isOnline}
          allTables={tables}
          allOrders={orders}
          employees={employees}
        />
```

In the outer `WaiterInterface` component (line 1701), add `employees` to the existing `useApp()` destructure:

```tsx
  const { currentTenant, currentEmployee, employees } = useApp();
```

- [ ] **Step 3: Add transfer-modal state inside `TableDetail`**

Inside `TableDetail` (near the other `useState` calls, e.g. after `splitBillOpen` around line 927), add:

```tsx
  const [showTransferModal, setShowTransferModal] = useState(false);
```

- [ ] **Step 4: Add the "Transfer" button**

In `TableDetail`'s JSX, directly after the "Send to Kitchen" button block (`WaiterInterface.tsx:1284-1315`, ending with the closing `)}` for `{unsentItems.length > 0 && (...)}`), add a new always-visible button (not gated on `unsentItems`, since a transfer can happen regardless of unsent items):

```tsx
                {/* Table & waiter transfer */}
                <RoleGate action="make_sales">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 py-3 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/20"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {t('restaurant.transfer', 'Transfer Table / Waiter')}
                  </button>
                </RoleGate>
```

Add the `RoleGate` import near the top of the file if not already present:

```tsx
import RoleGate from '@/components/RoleGate';
```

(Check first — `WaiterInterface.tsx` may not currently import it; `grep -n "RoleGate" src/pages/restaurant/WaiterInterface.tsx` to confirm before adding, to avoid a duplicate import.)

- [ ] **Step 5: Render the modal**

Near the end of `TableDetail`'s JSX (alongside other conditionally-rendered modals in this component, e.g. wherever `splitBillOpen` or `showCloseBillModal` render their own modal — place this at the same level), add:

```tsx
      {showTransferModal && order && (
        <TableTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => { setShowTransferModal(false); onClose(); onOrderClosed(); }}
          tenantId={tenantId ?? ''}
          sourceTable={table}
          sourceOrder={order}
          sourceOrderItemCount={items.length}
          currentWaiterId={(order as { waiter_id?: string | null }).waiter_id ?? hookOrder?.waiter_id ?? null}
          tables={allTables}
          orders={allOrders}
          employees={employees}
        />
      )}
```

Note: after a successful transfer, this table's own order may have moved away (or merged away) — `onSuccess` here calls `onClose()` (closing the detail panel back to the floor plan, since what it was showing may no longer be at this table) in addition to `onOrderClosed()` (the existing callback that refreshes the outer component's `tables`/`orders` lists, already wired to `loadData()` at the call site from Task 4 Step 2). This mirrors how this file already handles bill-closing (`WaiterInterface.tsx:1044`, `:1167` both call `onOrderClosed()` after an order concludes).

`hookOrder` (from `useRestaurantOrder`, already destructured at the top of `TableDetail`) is `TableOrderExtended` and does carry `waiter_id` directly — prefer it over `order` when available; the fallback to `order` (base `TableOrder`, cast) covers the brief window before `hookOrder` loads.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors or warnings.

- [ ] **Step 7: Manual verification (dev server)**

Run: `npm run dev`, open the Waiter Interface, select an occupied table, confirm the "Transfer Table / Waiter" button appears and opens the modal, and that closing the modal or the detail panel behaves correctly (no crash, no stale state).

- [ ] **Step 8: Commit**

```bash
git add src/pages/restaurant/WaiterInterface.tsx
git commit -m "feat(f&b): wire table transfer into WaiterInterface active-order screen"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Data Model → Task 1. Backend (RPC + waiter-only update) → Task 1 (RPC) and Task 2 (the modal calls the direct update). Frontend (shared modal, both entry points) → Tasks 2-4. Error handling table → all five rows are either enforced by the RPC itself (Task 1) or by the modal's UI structure (Task 2: source table structurally excluded from the picker, so the "same table" case can't occur; merge confirmation step implemented). Testing section → Task 2's six Vitest cases plus the documented manual SQL smoke test for the human. Implementation Notes (migration numbering, file-only delivery) → Task 1.
- **Deviation from spec, corrected during planning:** dropped the `activity_log` write from the RPC (see Global Constraints) — the spec assumed this without verifying it against actual codebase convention; verified during plan-writing that no existing RPC does this, including the closest analogous one.
- **Placeholder scan:** no TBD/TODO; every step has complete, concrete code.
- **Type consistency:** `TableTransferModalProps` is identical across its definition (Task 2) and both call sites (Task 3, Task 4) — `isOpen`, `onClose`, `onSuccess`, `tenantId`, `sourceTable`, `sourceOrder`, `sourceOrderItemCount`, `currentWaiterId`, `tables`, `orders`, `employees`, in that order, same types throughout.
