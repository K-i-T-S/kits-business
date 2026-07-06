# Delivery Order Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the delivery-aggregator webhook pipeline (restored in Tier 0) actually functional end-to-end — kitchen sees real order items, staff can accept/reject/progress orders, and completed orders record revenue.

**Architecture:** Simplify the existing `inject_delivery_order` RPC to only record the inbound order; three new small RPCs (`accept_delivery_order`, `reject_delivery_order`, `complete_delivery_order`) own the lifecycle transitions, moving kitchen-visible `table_orders`/`restaurant_order_items` creation from webhook-receipt time to acceptance time. A new `DeliveryOrders.tsx` page gives staff a kanban queue to drive that lifecycle. The already-deployed `delivery-webhook` edge function is updated to call the new acceptance RPC for auto-accept integrations.

**Tech Stack:** Supabase Postgres (plpgsql RPCs), Deno Edge Function, React 18 + TypeScript (strict), Vitest + Testing Library, Tailwind, react-i18next, sonner, lucide-react.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-06-delivery-order-intake-design.md` — read it before starting; every task below implements a section of it.
- No new tables. Only `sales.source`'s CHECK constraint changes (adds `'delivery'`).
- Migrations are delivered as files and applied manually via the Supabase Dashboard SQL Editor — do NOT apply the new migration directly to the live project (`pytndxjeznhhyycjasep`) unless explicitly authorized for this specific migration.
- Redeploying `delivery-webhook` (already live from Tier 0) requires explicit human confirmation before applying — do not deploy without asking.
- Out of scope, do not build: outbound platform notification on reject, cancellation of an already-accepted order, a history/archive view for completed orders. These are documented spec boundaries, not omissions to fix.
- All new RPCs must include the `current_tenant_id()` tenant-ownership check from the first draft — this was a Critical finding on the table-transfer feature's first RPC; do not repeat that omission here.
- TypeScript strict mode + `noUncheckedIndexedAccess`. No `any`. ESLint zero-warnings budget. `@/` path alias for cross-directory imports.
- RBAC: reuse the existing `RoleGate action="make_sales"` — do not add a new `RoleAction`.

---

### Task 1: Migration — simplify injection, add lifecycle RPCs, extend `sales.source`

**Files:**
- Create: `supabase/migrations/20260706_000055_delivery_order_intake.sql`
- Modify: `CLAUDE.md` (Database Migrations numbered list, entry 55)

**Interfaces:**
- Produces: `inject_delivery_order(p_tenant_id uuid, p_branch_id uuid, p_platform text, p_external_order_id text, p_customer_name text, p_items jsonb, p_total_usd numeric, p_notes text default null) returns uuid` — same signature as today, simplified body. Returns the new `restaurant_delivery_orders.id`, or `NULL` on duplicate (unchanged contract — consumed by Task 2's edge function update).
- Produces: `accept_delivery_order(p_delivery_order_id uuid) returns uuid` — returns the new `table_orders.id`. Consumed by Task 2 (edge function, auto-accept path) and Task 3 (frontend "Accept" button).
- Produces: `reject_delivery_order(p_delivery_order_id uuid) returns void`. Consumed by Task 3 (frontend "Reject" button).
- Produces: `complete_delivery_order(p_delivery_order_id uuid) returns uuid` — returns the new `sales.id`. Consumed by Task 3 (frontend "Mark Picked Up" button).
- Produces: `finalize_restaurant_order(p_order_id uuid, p_source text default 'restaurant') returns uuid` — existing RPC, new optional parameter, default preserves current dine-in behavior exactly. Called internally by `complete_delivery_order` with `p_source => 'delivery'`.
- Consumes: existing tables `restaurant_delivery_orders`, `table_orders`, `restaurant_order_items`, `restaurant_tables`, `sales` — no schema changes to any of these except the one CHECK-constraint change noted above.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260706_000055_delivery_order_intake.sql
-- Delivery Order Intake (Tier 1.4, docs/fnb-competitive-gap-analysis.md).
-- See docs/superpowers/specs/2026-07-06-delivery-order-intake-design.md for full design.
--
-- Two real gaps in the Tier 0-restored delivery-webhook pipeline, fixed here:
-- 1. inject_delivery_order created a kitchen-visible table_orders shell but never
--    inserted restaurant_order_items — kitchen staff saw an order card with zero
--    items to prepare.
-- 2. restaurant_delivery_orders was never read by any frontend code — no way to
--    see, accept/reject, or progress an incoming delivery order, and no way for
--    one to ever be "completed" (stayed open forever, no revenue recorded).
--
-- Behavior change: table_orders/restaurant_order_items are now created at
-- ACCEPTANCE time (accept_delivery_order), not at webhook-receipt time
-- (inject_delivery_order). Kitchen should never see an order as active before
-- someone (human, or the auto_accept setting) has committed to fulfilling it.

-- 1. Allow 'delivery' as a sales source, alongside the existing 'pos'/'restaurant'.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE sales ADD CONSTRAINT sales_source_check CHECK (source IN ('pos', 'restaurant', 'delivery'));

-- 2. Simplify inject_delivery_order: only records the inbound order now.
--    (Signature unchanged; only removes the table_orders-shell creation that used
--    to happen unconditionally regardless of auto_accept.)
CREATE OR REPLACE FUNCTION inject_delivery_order(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_platform TEXT,
  p_external_order_id TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_total_usd NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO restaurant_delivery_orders (
    tenant_id, branch_id, platform, external_order_id, customer_name, items, total_usd, notes, status
  ) VALUES (
    p_tenant_id, p_branch_id, p_platform, p_external_order_id, p_customer_name, p_items, p_total_usd, p_notes, 'new'
  ) ON CONFLICT (tenant_id, platform, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- 3. accept_delivery_order — creates the KDS-visible shell + real order items.
CREATE OR REPLACE FUNCTION accept_delivery_order(p_delivery_order_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_platform TEXT;
  v_external_order_id TEXT;
  v_items JSONB;
  v_status TEXT;
  v_table_order_id UUID;
BEGIN
  SELECT tenant_id, platform, external_order_id, items, status
    INTO v_tenant_id, v_platform, v_external_order_id, v_items, v_status
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'new' THEN
    RAISE EXCEPTION 'Delivery order % is not acceptable (status = %)', p_delivery_order_id, v_status;
  END IF;

  INSERT INTO table_orders (tenant_id, status, notes, current_course)
  VALUES (v_tenant_id, 'open', 'DELIVERY: ' || v_platform || ' #' || v_external_order_id, 'mains')
  RETURNING id INTO v_table_order_id;

  INSERT INTO restaurant_order_items (tenant_id, order_id, product_name, quantity, unit_price, modifiers, notes, course, status)
  SELECT
    v_tenant_id,
    v_table_order_id,
    item->>'name',
    (item->>'quantity')::INTEGER,
    (item->>'unit_price')::NUMERIC,
    COALESCE(item->'modifiers', '[]'::jsonb),
    item->>'notes',
    'mains',
    'pending'
  FROM jsonb_array_elements(v_items) AS item;

  UPDATE restaurant_delivery_orders
    SET status = 'accepted', accepted_at = now(), table_order_id = v_table_order_id
    WHERE id = p_delivery_order_id;

  RETURN v_table_order_id;
END;
$$;

-- 4. reject_delivery_order — only valid from 'new' (no shell exists yet to clean up).
CREATE OR REPLACE FUNCTION reject_delivery_order(p_delivery_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant_id, v_status
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'new' THEN
    RAISE EXCEPTION 'Delivery order % is not rejectable (status = %)', p_delivery_order_id, v_status;
  END IF;

  UPDATE restaurant_delivery_orders SET status = 'cancelled' WHERE id = p_delivery_order_id;
END;
$$;

-- 5. finalize_restaurant_order — add optional source parameter (default preserves
--    existing dine-in behavior exactly).
CREATE OR REPLACE FUNCTION finalize_restaurant_order(p_order_id UUID, p_source TEXT DEFAULT 'restaurant')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order     table_orders%ROWTYPE;
  v_subtotal  NUMERIC(12,2);
  v_discount  NUMERIC(12,2);
  v_service   NUMERIC(12,2);
  v_tax       NUMERIC(12,2);
  v_tip       NUMERIC(12,2);
  v_total     NUMERIC(12,2);
  v_sale_id   UUID;
BEGIN
  SELECT * INTO v_order FROM table_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id;
  END IF;
  IF v_order.tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT id INTO v_sale_id FROM sales WHERE table_order_id = p_order_id LIMIT 1;
  IF FOUND THEN RETURN v_sale_id; END IF;

  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_subtotal FROM restaurant_order_items WHERE order_id = p_order_id;

  v_discount := v_subtotal * COALESCE(v_order.discount_pct, 0) / 100.0;
  v_service  := (v_subtotal - v_discount) * COALESCE(v_order.service_charge_pct, 10) / 100.0;
  v_tax      := (v_subtotal - v_discount + v_service) * COALESCE(v_order.vat_pct, 11) / 100.0;
  v_tip      := COALESCE(v_order.tip_amount_usd, 0);
  v_total    := v_subtotal - v_discount + v_service + v_tax + v_tip;

  INSERT INTO sales (
    tenant_id, employee_id, subtotal, discount, tax_amount, total_amount,
    payment_method, payment_status, notes, sale_date, table_order_id, source
  ) VALUES (
    v_order.tenant_id,
    v_order.waiter_id,
    v_subtotal, v_discount, v_service + v_tax, v_total,
    COALESCE(v_order.payment_method, 'cash'),
    'completed',
    'Table ' || COALESCE(
      (SELECT number::TEXT FROM restaurant_tables WHERE id = v_order.table_id), '?'
    ),
    COALESCE(v_order.paid_at, now()),
    p_order_id, p_source
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

-- 6. complete_delivery_order — the "mark picked up" action.
CREATE OR REPLACE FUNCTION complete_delivery_order(p_delivery_order_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
  v_table_order_id UUID;
  v_sale_id UUID;
BEGIN
  SELECT tenant_id, status, table_order_id
    INTO v_tenant_id, v_status, v_table_order_id
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'Delivery order % is not completable (status = %)', p_delivery_order_id, v_status;
  END IF;

  UPDATE restaurant_delivery_orders SET status = 'picked_up' WHERE id = p_delivery_order_id;
  UPDATE table_orders SET status = 'paid', closed_at = now() WHERE id = v_table_order_id;

  v_sale_id := finalize_restaurant_order(v_table_order_id, 'delivery');

  RETURN v_sale_id;
END;
$$;
```

- [ ] **Step 2: Static sanity check (no live database needed)**

Run:
```bash
grep -c "CREATE OR REPLACE FUNCTION" supabase/migrations/20260706_000055_delivery_order_intake.sql
```
Expected: `5` (inject_delivery_order, accept_delivery_order, reject_delivery_order, finalize_restaurant_order, complete_delivery_order — five functions total, in that order in the file).

Also verify the file has exactly 5 `$$ ... $$` function bodies (10 `$$` markers total) by eye.

- [ ] **Step 3: Add the migration to CLAUDE.md's numbered Database Migrations list**

Read `CLAUDE.md`, find the numbered list under `## Database Migrations`, and append this line after entry 54:

```markdown
55. `20260706_000055_delivery_order_intake.sql` — simplifies inject_delivery_order (no longer creates a table_orders shell at webhook-receipt time), adds accept_delivery_order/reject_delivery_order/complete_delivery_order RPCs, parameterizes finalize_restaurant_order with an optional source, and extends sales.source to allow 'delivery' (Tier 1.4)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260706_000055_delivery_order_intake.sql CLAUDE.md
git commit -m "feat(f&b): add delivery order lifecycle RPCs (Tier 1.4)

Simplifies inject_delivery_order to only record the inbound order;
adds accept_delivery_order (creates the KDS-visible shell + real
order items, fixing the 'kitchen sees zero items' bug),
reject_delivery_order, and complete_delivery_order (closes the shell
+ records a sales row via a newly-parameterized finalize_restaurant_order).
Not yet applied to the live database — file delivered per this
project's migration convention; apply manually via Supabase Dashboard
SQL Editor."
```

**Note for the human operator (not an implementer step):** once applied, a manual smoke test in the SQL Editor:
```sql
-- Simulate injection (use a real tenant_id/platform from your data)
select inject_delivery_order('<tenant-id>', null, 'toters', 'TEST-001', 'Test Customer',
  '[{"name":"Chicken Shawarma","quantity":2,"unit_price":8.5,"notes":"","modifiers":[]}]'::jsonb,
  17.0, null);
-- Accept it (use the id returned above)
select accept_delivery_order('<delivery-order-id>');
-- Verify items landed:
select * from restaurant_order_items where order_id = (select table_order_id from restaurant_delivery_orders where id = '<delivery-order-id>');
-- Progress and complete:
update restaurant_delivery_orders set status = 'preparing' where id = '<delivery-order-id>';
update restaurant_delivery_orders set status = 'ready' where id = '<delivery-order-id>';
select complete_delivery_order('<delivery-order-id>');
-- Verify a sale was recorded:
select * from sales where source = 'delivery' order by sale_date desc limit 1;
```

---

### Task 2: Update `delivery-webhook` edge function for auto-accept

**Files:**
- Modify: `supabase/functions/delivery-webhook/index.ts`

**Interfaces:**
- Consumes: `accept_delivery_order(p_delivery_order_id uuid) returns uuid` from Task 1.
- No change to the function's own HTTP contract (request/response shapes unchanged) — this is an internal-logic-only change.

- [ ] **Step 1: Replace the auto-accept branch**

In `supabase/functions/delivery-webhook/index.ts`, find this block (currently near the end of the handler, right after the `inject_delivery_order` RPC call and its duplicate-check):

```typescript
    // ── If auto_accept, mark the delivery order as accepted immediately ─────
    if (autoAccept) {
      await supabase
        .from('restaurant_delivery_orders')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', deliveryOrderId as string)
        .eq('tenant_id', tenantId);
    }
```

Replace it with:

```typescript
    // ── If auto_accept, call accept_delivery_order to create the KDS shell +
    // real order items immediately (previously this only flipped the delivery
    // order's own status column, without ever creating the kitchen-visible
    // table_orders/restaurant_order_items rows).
    if (autoAccept) {
      const { error: acceptErr } = await supabase.rpc('accept_delivery_order', {
        p_delivery_order_id: deliveryOrderId as string,
      });
      if (acceptErr) throw acceptErr;
    }
```

- [ ] **Step 2: Verify the file still has valid TypeScript by inspection**

Run:
```bash
grep -c "accept_delivery_order" supabase/functions/delivery-webhook/index.ts
```
Expected: `1`.

Run:
```bash
grep -n "restaurant_delivery_orders.*update\|update.*restaurant_delivery_orders" supabase/functions/delivery-webhook/index.ts
```
Expected: no output — confirms the old raw `.update()` call for auto-accept is fully gone (the function no longer writes `restaurant_delivery_orders` directly for this path; `accept_delivery_order` does that internally now).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delivery-webhook/index.ts
git commit -m "fix(f&b): call accept_delivery_order for auto-accept delivery integrations

Previously auto_accept only flipped the delivery order's own status
column, without ever creating the kitchen-visible table_orders shell
or its order items (accept_delivery_order, added in the prior commit,
now owns that). Auto-accept tenants get the same acceptance path as
a manual accept, just triggered automatically."
```

**Note for the human operator (not an implementer step):** this is a live, already-deployed function. Redeploying requires explicit confirmation — do not run `npx supabase functions deploy delivery-webhook --project-ref pytndxjeznhhyycjasep` without asking first, and only after Task 1's migration has actually been applied to the live project (the new function call will fail with "function does not exist" otherwise).

---

### Task 3: `DeliveryOrders.tsx` page (TDD)

**Files:**
- Create: `src/pages/restaurant/DeliveryOrders.tsx`
- Test: `src/pages/restaurant/DeliveryOrders.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/utils/supabaseClient`; `useApp()` from `@/context/AppContext` (for `currentTenant`); `Layout` from `@/components/Layout`; `RoleGate` from `@/components/RoleGate` (`action="make_sales"`); `FeatureGate` from `@/components/FeatureGate` (`feature="enterprise_dashboard"`, matching `DeliveryIntegrations.tsx`'s existing gate on the sibling settings page).
- Calls `supabase.rpc('accept_delivery_order', { p_delivery_order_id })`, `supabase.rpc('reject_delivery_order', { p_delivery_order_id })`, `supabase.rpc('complete_delivery_order', { p_delivery_order_id })` (all from Task 1) and plain `supabase.from('restaurant_delivery_orders').update({ status: 'preparing' | 'ready' }).eq('id', ...).eq('tenant_id', ...)` for the two non-RPC transitions.
- Produces: default export `DeliveryOrders()`, a page component. Consumed by Task 4's routing.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/restaurant/DeliveryOrders.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();
const mockSelectResult = { data: [] as unknown[], error: null };

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(mockSelectResult),
        }),
      }),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/RoleGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/FeatureGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DeliveryOrders from './DeliveryOrders';

const newOrder = {
  id: 'do-1', tenant_id: 't1', branch_id: null, platform: 'toters', external_order_id: 'TO-100',
  customer_name: 'Karim', customer_phone: '+96181290662', delivery_address: 'Hamra St.',
  items: [{ name: 'Chicken Shawarma', quantity: 2, unit_price: 8.5, notes: '', modifiers: [] }],
  subtotal_usd: 17, delivery_fee_usd: 2, total_usd: 19,
  status: 'new', estimated_pickup_at: null, table_order_id: null, notes: null,
  received_at: '2026-07-06T10:00:00Z', accepted_at: null, ready_at: null,
};
const acceptedOrder = { ...newOrder, id: 'do-2', status: 'accepted', table_order_id: 'ord-1' };
const preparingOrder = { ...newOrder, id: 'do-3', status: 'preparing', table_order_id: 'ord-2' };
const readyOrder = { ...newOrder, id: 'do-4', status: 'ready', table_order_id: 'ord-3' };

describe('DeliveryOrders', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'result-id', error: null });
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    mockSelectResult.data = [newOrder, acceptedOrder, preparingOrder, readyOrder];
  });

  it('groups orders into the correct status columns', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getByText('TO-100')).toBeInTheDocument(); });
    expect(screen.getAllByText('TO-100')).toHaveLength(4);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('calls accept_delivery_order when Accept is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /accept/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /accept/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('accept_delivery_order', { p_delivery_order_id: 'do-1' });
    });
  });

  it('calls reject_delivery_order when Reject is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /reject/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /reject/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('reject_delivery_order', { p_delivery_order_id: 'do-1' });
    });
  });

  it('uses a direct update (not an RPC) for Start Prep', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /start prep/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /start prep/i })[0]!);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'preparing' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('uses a direct update (not an RPC) for Mark Ready', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /mark ready/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /mark ready/i })[0]!);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'ready' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls complete_delivery_order when Mark Picked Up is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /mark picked up/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /mark picked up/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('complete_delivery_order', { p_delivery_order_id: 'do-4' });
    });
  });

  it('shows an error toast when an RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /accept/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /accept/i })[0]!);
    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/restaurant/DeliveryOrders.test.tsx`
Expected: FAIL — `Cannot find module './DeliveryOrders'` (file doesn't exist yet).

- [ ] **Step 3: Write the component**

Create `src/pages/restaurant/DeliveryOrders.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

import FeatureGate from '@/components/FeatureGate';
import Layout from '@/components/Layout';
import RoleGate from '@/components/RoleGate';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

type DeliveryOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';

interface DeliveryOrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  modifiers?: Array<{ name: string; price_delta: number }>;
}

interface DeliveryOrder {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  platform: 'toters' | 'zomato' | 'talabat' | 'careem_food';
  external_order_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: DeliveryOrderItem[];
  subtotal_usd: number;
  delivery_fee_usd: number;
  total_usd: number;
  status: DeliveryOrderStatus;
  received_at: string;
}

const PLATFORM_BADGES: Record<DeliveryOrder['platform'], { label: string; bg: string }> = {
  talabat: { label: 'Talabat', bg: 'bg-orange-600' },
  toters: { label: 'Toters', bg: 'bg-green-600' },
  zomato: { label: 'Zomato', bg: 'bg-red-600' },
  careem_food: { label: 'Careem Food', bg: 'bg-emerald-600' },
};

const ACTIVE_STATUSES: DeliveryOrderStatus[] = ['new', 'accepted', 'preparing', 'ready'];
const POLL_INTERVAL_MS = 30_000;

interface OrderCardProps {
  order: DeliveryOrder;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onStartPrep: (id: string) => void;
  onMarkReady: (id: string) => void;
  onMarkPickedUp: (id: string) => void;
}

function OrderCard({ order, onAccept, onReject, onStartPrep, onMarkReady, onMarkPickedUp }: OrderCardProps) {
  const { t } = useTranslation();
  const badge = PLATFORM_BADGES[order.platform];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${badge.bg}`}>
          {badge.label}
        </span>
        <span className="text-xs text-white/40">{order.external_order_id}</span>
      </div>
      <p className="text-sm text-white">{order.customer_name ?? t('deliveryOrders.noName', 'Guest')}</p>
      <p className="text-xs text-white/50">{order.customer_phone}</p>
      <p className="text-xs text-white/50">{order.delivery_address}</p>
      <ul className="text-xs text-white/70 space-y-0.5">
        {order.items.map((item, idx) => (
          <li key={idx}>{item.quantity}× {item.name}</li>
        ))}
      </ul>
      <p className="text-sm font-semibold text-white">${order.total_usd.toFixed(2)}</p>
      <div className="flex gap-2 pt-1">
        {order.status === 'new' && (
          <>
            <button onClick={() => onAccept(order.id)} className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
              {t('deliveryOrders.accept', 'Accept')}
            </button>
            <button onClick={() => onReject(order.id)} className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              {t('deliveryOrders.reject', 'Reject')}
            </button>
          </>
        )}
        {order.status === 'accepted' && (
          <button onClick={() => onStartPrep(order.id)} className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
            {t('deliveryOrders.startPrep', 'Start Prep')}
          </button>
        )}
        {order.status === 'preparing' && (
          <button onClick={() => onMarkReady(order.id)} className="flex-1 rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
            {t('deliveryOrders.markReady', 'Mark Ready')}
          </button>
        )}
        {order.status === 'ready' && (
          <button onClick={() => onMarkPickedUp(order.id)} className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
            {t('deliveryOrders.markPickedUp', 'Mark Picked Up')}
          </button>
        )}
      </div>
    </div>
  );
}

const COLUMNS: Array<{ status: DeliveryOrderStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
];

export default function DeliveryOrders() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);

  const loadOrders = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('restaurant_delivery_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('received_at');
    if (data) setOrders((data as DeliveryOrder[]).filter((o) => ACTIVE_STATUSES.includes(o.status)));
  }, [tenantId]);

  useEffect(() => {
    void loadOrders();
    const interval = setInterval(() => { void loadOrders(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleAccept = async (id: string) => {
    const { error } = await supabase.rpc('accept_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.acceptError', 'Failed to accept order')); return; }
    toast.success(t('deliveryOrders.accepted', 'Order accepted'));
    void loadOrders();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.rpc('reject_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.rejectError', 'Failed to reject order')); return; }
    toast.success(t('deliveryOrders.rejected', 'Order rejected'));
    void loadOrders();
  };

  const handleStartPrep = async (id: string) => {
    const { error } = await supabase.from('restaurant_delivery_orders').update({ status: 'preparing' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('deliveryOrders.updateError', 'Failed to update order')); return; }
    void loadOrders();
  };

  const handleMarkReady = async (id: string) => {
    const { error } = await supabase.from('restaurant_delivery_orders').update({ status: 'ready' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('deliveryOrders.updateError', 'Failed to update order')); return; }
    void loadOrders();
  };

  const handleMarkPickedUp = async (id: string) => {
    const { error } = await supabase.rpc('complete_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.completeError', 'Failed to complete order')); return; }
    toast.success(t('deliveryOrders.completed', 'Order completed'));
    void loadOrders();
  };

  return (
    <Layout>
      <FeatureGate feature="enterprise_dashboard">
        <RoleGate action="make_sales">
          <div className="p-6">
            <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
              <Truck className="h-5 w-5" />
              {t('deliveryOrders.title', 'Delivery Orders')}
            </h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {COLUMNS.map((col) => (
                <div key={col.status}>
                  <h2 className="mb-2 text-sm font-semibold text-white/60">{t(`deliveryOrders.status.${col.status}`, col.label)}</h2>
                  <div className="space-y-3">
                    {orders.filter((o) => o.status === col.status).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        onStartPrep={handleStartPrep}
                        onMarkReady={handleMarkReady}
                        onMarkPickedUp={handleMarkPickedUp}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RoleGate>
      </FeatureGate>
    </Layout>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/restaurant/DeliveryOrders.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/pages/restaurant/DeliveryOrders.tsx src/pages/restaurant/DeliveryOrders.test.tsx
git commit -m "feat(f&b): add DeliveryOrders queue page

Kanban board over restaurant_delivery_orders by status. Accept/Reject
call the new RPCs; Start Prep/Mark Ready are plain status updates
(single-column, no cascading effects); Mark Picked Up calls
complete_delivery_order. Polls every 30s since orders arrive via
webhook at any time, not just from in-app actions."
```

---

### Task 4: Wire routing + navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `DeliveryOrders` default export from Task 3, lazy-loaded the same way every other restaurant page in this file already is.

- [ ] **Step 1: Add the lazy import and route in `App.tsx`**

Find the existing line (search for it — it's among the other `const Restaurant... = lazy(...)` declarations):
```tsx
const RestaurantDelivery = lazy(() => import('./pages/restaurant/DeliveryIntegrations'));
```
Add immediately after it:
```tsx
const RestaurantDeliveryOrders = lazy(() => import('./pages/restaurant/DeliveryOrders'));
```

Find the existing route (search for `/restaurant/delivery`):
```tsx
<Route path="/restaurant/delivery" element={isAuthenticated ? <RestaurantDelivery /> : <Navigate to="/login" replace />} />
```
Add immediately after it:
```tsx
<Route path="/restaurant/delivery-orders" element={isAuthenticated ? <RestaurantDeliveryOrders /> : <Navigate to="/login" replace />} />
```

- [ ] **Step 2: Add the nav entry in `Layout.tsx`**

Find the `'Back of House'` nav group (search for `label: 'Back of House'`):
```tsx
{
  label: 'Back of House',
  items: [
    { name: t('nav.vertical.kds', 'Kitchen Display'), icon: Cpu, href: '/restaurant/kds' },
    { name: t('nav.vertical.argile', 'Argile Station'), icon: Flame, href: '/restaurant/argile' },
  ],
},
```
Add a new entry to the `items` array, right after Kitchen Display:
```tsx
{
  label: 'Back of House',
  items: [
    { name: t('nav.vertical.kds', 'Kitchen Display'), icon: Cpu, href: '/restaurant/kds' },
    { name: t('nav.vertical.deliveryOrders', 'Delivery Orders'), icon: Truck, href: '/restaurant/delivery-orders' },
    { name: t('nav.vertical.argile', 'Argile Station'), icon: Flame, href: '/restaurant/argile' },
  ],
},
```

`Truck` is already imported in `Layout.tsx` (used by the "Delivery" settings nav entry) — confirm this before assuming, since imports can change: `grep -n "^import.*Truck\|  Truck,$" src/components/Layout.tsx`. If it's not there for any reason, add it to the existing lucide-react import block.

- [ ] **Step 3: Typecheck, lint, and build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: no errors, no new warnings, build succeeds.

- [ ] **Step 4: Manual verification (dev server)**

Run: `npm run dev`, navigate to `/restaurant/delivery-orders`, confirm the page loads without crashing and shows the four-column empty board (no seed data needed for this check — an empty board with visible column headers is a sufficient smoke test given Task 3's unit tests already cover the data-driven behavior).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat(f&b): wire DeliveryOrders page into routing and navigation"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Data Model (sales.source extension) → Task 1. Backend (all 4 RPC changes) → Task 1. delivery-webhook update → Task 2. Frontend (DeliveryOrders page, kanban, polling, RBAC) → Task 3. Routing/nav → Task 4. Error handling table → enforced by the RPCs themselves (Task 1: `FOR UPDATE` + status checks) and the frontend's toast-on-error handling (Task 3). Testing section → Task 3's 7 Vitest cases plus the documented manual SQL smoke test (Task 1) and the existing curl-based convention for the edge function (Task 2, left to the human operator alongside the redeploy authorization).
- **Placeholder scan:** no TBD/TODO; every step has complete, concrete code.
- **Type consistency:** `DeliveryOrder`/`DeliveryOrderStatus`/`DeliveryOrderItem` types are defined once in Task 3 and used consistently within that same file (no other task needs to reference them, since Task 4 only wires the route/nav entry and doesn't touch the component's internals).
- **Migration numbering:** confirmed against `CLAUDE.md`'s current last entry (54, from the table-transfer feature already merged to `main`) — this plan's migration is `000055`, the correct next number.
