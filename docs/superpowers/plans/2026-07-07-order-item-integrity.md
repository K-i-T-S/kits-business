# Order Item Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up recipe-ingredient deduction end-to-end, close two `menu_item_id` gaps that silently break it, and replace `QRCart.tsx`'s broken direct-table-write order placement (confirmed non-functional for real anonymous customers) with a single `SECURITY DEFINER` RPC that respects the tenant's Order Flow setting.

**Architecture:** Three independent-but-related fixes. (1) A new anonymous-callable RPC `qr_place_order` becomes the sole write path for QR customer orders, replacing direct `table_orders`/`restaurant_order_items` inserts that RLS silently rejects today. (2) `KitchenDisplay.tsx` gets the already-built `useRecipeDeduction` hook wired into its three "item became ready" handlers, with a ref-based in-flight guard preventing double-deduction on a fast double-click. (3) One missing `menu_item_id` field gets added to `useRestaurantOrder.ts`'s duplicate `confirmPendingOrder` implementation.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + PostgREST), Vitest + Testing Library.

## Global Constraints

- No live migration application without explicit authorization — deliver as a file only.
- `SECURITY DEFINER` RPCs called by *authenticated staff* must check `tenant_id = current_tenant_id()` immediately after resolving it. `qr_place_order` is the one exception — it's called by anonymous customers, so it derives `tenant_id` server-side from `p_table_id` instead (never trusts a client-supplied tenant id), mirroring the existing `get_public_menu(p_tenant_slug)` pattern.
- No new RLS policies, no `GRANT EXECUTE` — Postgres grants `EXECUTE` on new functions to `PUBLIC` by default in this project (confirmed: `get_public_menu` already works anonymously with no explicit grant in its migration).
- Recipe deduction must fire exactly once, at the point an item transitions to `'ready'` — never at `'served'`, never twice for the same item.
- TypeScript strict mode, `noUncheckedIndexedAccess` — no `any`. Run `npm run typecheck && npm run lint` after every task.
- No automated SQL test harness exists in this repo — RPC correctness is verified via a scratch Postgres 16 instance (empirical check), not a vitest/pytest-style automated test.

---

### Task 1: Migration — `qr_place_order` RPC

**Files:**
- Create: `supabase/migrations/20260707_000057_order_item_integrity.sql`
- Modify: `CLAUDE.md` (append migration 57 entry after the existing migration 56 entry)

**Interfaces:**
- Produces: RPC `qr_place_order(p_table_id uuid, p_items jsonb) returns jsonb`. `p_items` shape: `[{ "menu_item_id": "uuid", "quantity": int, "modifier_ids": ["uuid", ...] (optional), "notes": "string" (optional) }, ...]`. Return shape: `{"mode": "pending"|"direct", "order_id": "uuid"}`.
- Consumes: existing tables `restaurant_tables` (`id`, `tenant_id`), `table_orders` (`id`, `tenant_id`, `table_id`, `status`, `current_course`, `order_flow` — column already exists, migration `20260621_000035`), `restaurant_settings` (`tenant_id`, `default_order_flow`), `restaurant_menu_items` (`id`, `tenant_id`, `name`, `base_price_usd`, `is_active`), `restaurant_modifiers` (`id`, `tenant_id`, `name`, `price_delta`), `restaurant_pending_orders` (`tenant_id`, `table_id`, `table_order_id`, `items`, `status`), `restaurant_order_items` (`tenant_id`, `order_id`, `menu_item_id`, `product_name`, `quantity`, `unit_price`, `modifiers`, `course`, `status`, `notes`).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260707_000057_order_item_integrity.sql` with this exact content:

```sql
-- Migration: Order Item Integrity — QR order placement fix
-- Design spec: docs/superpowers/specs/2026-07-07-order-item-integrity-design.md
--
-- QRCart.tsx currently writes directly to table_orders/restaurant_order_items
-- as an anonymous customer. RLS rejects both (empirically verified against a
-- scratch Postgres 16 replica of the live schema — no public policy exists on
-- either table). This RPC is the fix: SECURITY DEFINER, derives tenant_id
-- server-side from p_table_id (never trusts a client-supplied tenant id,
-- mirroring get_public_menu's p_tenant_slug-derivation pattern), resolves
-- prices/modifier names server-side from the menu catalog rather than
-- trusting client-supplied values, and branches on the target order's
-- order_flow ('waiter_confirm' -> restaurant_pending_orders staging table,
-- already built and already has a public insert policy; 'direct' -> real
-- restaurant_order_items rows with menu_item_id always set, unlike today's
-- QRCart.tsx which omits it).
CREATE OR REPLACE FUNCTION qr_place_order(p_table_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id      uuid;
  v_order_id       uuid;
  v_order_flow     text;
  v_default_flow   text;
  v_item           jsonb;
  v_menu_item_id   uuid;
  v_menu_item_name text;
  v_base_price     numeric;
  v_mod_id         text;
  v_mod_name       text;
  v_mod_price      numeric;
  v_line_price     numeric;
  v_line_modifiers jsonb;
  v_pending_items  jsonb := '[]'::jsonb;
  v_valid_count    integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM restaurant_tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'table_not_found';
  END IF;

  SELECT id, order_flow INTO v_order_id, v_order_flow
    FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1;

  IF v_order_id IS NULL THEN
    SELECT default_order_flow INTO v_default_flow FROM restaurant_settings WHERE tenant_id = v_tenant_id;
    v_order_flow := COALESCE(v_default_flow, 'waiter_confirm');
    INSERT INTO table_orders (tenant_id, table_id, status, current_course, order_flow)
    VALUES (v_tenant_id, p_table_id, 'open', 'appetizers', v_order_flow)
    RETURNING id INTO v_order_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := NULL;
    SELECT id, name, base_price_usd INTO v_menu_item_id, v_menu_item_name, v_base_price
      FROM restaurant_menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid AND tenant_id = v_tenant_id AND is_active = true;

    IF v_menu_item_id IS NULL THEN
      CONTINUE; -- forged/stale/inactive menu_item_id — skip, don't trust client data
    END IF;

    v_line_price := v_base_price;
    v_line_modifiers := '[]'::jsonb;

    IF v_item ? 'modifier_ids' THEN
      FOR v_mod_id IN SELECT * FROM jsonb_array_elements_text(v_item->'modifier_ids')
      LOOP
        v_mod_name := NULL;
        SELECT name, price_delta INTO v_mod_name, v_mod_price
          FROM restaurant_modifiers
          WHERE id = v_mod_id::uuid AND tenant_id = v_tenant_id;
        IF v_mod_name IS NOT NULL THEN
          v_line_price := v_line_price + v_mod_price;
          v_line_modifiers := v_line_modifiers || jsonb_build_object('name', v_mod_name, 'price_delta', v_mod_price);
        END IF;
      END LOOP;
    END IF;

    v_valid_count := v_valid_count + 1;

    IF v_order_flow = 'waiter_confirm' THEN
      v_pending_items := v_pending_items || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', v_menu_item_name,
        'quantity', (v_item->>'quantity')::int,
        'unit_price', v_line_price,
        'modifiers', v_line_modifiers,
        'notes', COALESCE(v_item->>'notes', ''),
        'course', 'mains'
      );
    ELSE
      INSERT INTO restaurant_order_items (
        tenant_id, order_id, menu_item_id, product_name, quantity, unit_price, modifiers, course, status, notes
      ) VALUES (
        v_tenant_id, v_order_id, v_menu_item_id, v_menu_item_name,
        (v_item->>'quantity')::int, v_line_price, v_line_modifiers, 'mains', 'pending',
        NULLIF(v_item->>'notes', '')
      );
    END IF;
  END LOOP;

  IF v_valid_count = 0 THEN
    RAISE EXCEPTION 'no_valid_items';
  END IF;

  IF v_order_flow = 'waiter_confirm' THEN
    INSERT INTO restaurant_pending_orders (tenant_id, table_id, table_order_id, items, status)
    VALUES (v_tenant_id, p_table_id, v_order_id, v_pending_items, 'pending');
    RETURN jsonb_build_object('mode', 'pending', 'order_id', v_order_id);
  ELSE
    RETURN jsonb_build_object('mode', 'direct', 'order_id', v_order_id);
  END IF;
END;
$$;
```

- [ ] **Step 2: Empirically verify against a scratch Postgres 16 instance**

This repo has no automated SQL test harness. Spin up a scratch Postgres 16 Docker container, replicate the minimal real schema this RPC depends on (`tenants`, `restaurant_tables`, `table_orders` with its `order_flow` column, `restaurant_settings`, `restaurant_menu_items`, `restaurant_modifiers`, `restaurant_pending_orders`, `restaurant_order_items` — pull exact column definitions from `supabase/migrations/20260620_000031_restaurant_schema.sql`, `20260621_000034_restaurant_menu_system.sql`, `20260621_000035_restaurant_order_flow.sql`), including an `anon` Postgres role and RLS policies matching the real project (so the test proves the RPC works *as the anon role*, not just as postgres superuser — this is the whole point of the fix). Apply this migration, then run:

```sql
-- Setup
INSERT INTO tenants (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant');
INSERT INTO restaurant_tables (id, tenant_id, number, status) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 5, 'available');
INSERT INTO restaurant_settings (tenant_id, default_order_flow) VALUES
  ('11111111-1111-1111-1111-111111111111', 'waiter_confirm');
INSERT INTO restaurant_menu_items (id, tenant_id, name, base_price_usd, is_active) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Hummus', 5.00, true);

-- TEST 1: as anon, waiter_confirm flow (tenant default) — no open order exists yet
SET ROLE anon;
SELECT qr_place_order(
  '22222222-2222-2222-2222-222222222222',
  '[{"menu_item_id": "33333333-3333-3333-3333-333333333333", "quantity": 2, "notes": "no onions"}]'::jsonb
);
-- Expected: {"mode": "pending", "order_id": "<some uuid>"} — no error.
RESET ROLE;

SELECT status, items FROM restaurant_pending_orders WHERE table_id = '22222222-2222-2222-2222-222222222222';
-- Expected: one row, status='pending', items[0].menu_item_id = the real menu item id (NOT client-forgeable),
-- items[0].name = 'Hummus', items[0].unit_price = 5.00 (server-resolved, not client-sent).

SELECT order_flow FROM table_orders WHERE table_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 'waiter_confirm' (stamped from restaurant_settings.default_order_flow).

-- TEST 2: as anon, direct flow — update the tenant's setting, open a fresh table
UPDATE restaurant_settings SET default_order_flow = 'direct' WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO restaurant_tables (id, tenant_id, number, status) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 6, 'available');
SET ROLE anon;
SELECT qr_place_order(
  '44444444-4444-4444-4444-444444444444',
  '[{"menu_item_id": "33333333-3333-3333-3333-333333333333", "quantity": 1}]'::jsonb
);
-- Expected: {"mode": "direct", "order_id": "<some uuid>"}.
RESET ROLE;
SELECT menu_item_id, product_name, unit_price, status FROM restaurant_order_items
  WHERE order_id = (SELECT id FROM table_orders WHERE table_id = '44444444-4444-4444-4444-444444444444');
-- Expected: one row, menu_item_id = the real menu item id, product_name='Hummus', unit_price=5.00, status='pending'.

-- TEST 3: forged menu_item_id is skipped, not trusted
SET ROLE anon;
SELECT qr_place_order(
  '44444444-4444-4444-4444-444444444444',
  '[{"menu_item_id": "99999999-9999-9999-9999-999999999999", "quantity": 1}]'::jsonb
);
-- Expected: ERROR "no_valid_items" (the forged id matches no real menu item, so v_valid_count stays 0).
RESET ROLE;

-- TEST 4: confirm direct table access is STILL rejected for anon (the RPC is the only path, as designed)
SET ROLE anon;
INSERT INTO restaurant_order_items (tenant_id, order_id, product_name, quantity, unit_price, status)
VALUES ('11111111-1111-1111-1111-111111111111', (SELECT id FROM table_orders LIMIT 1), 'Hacked', 1, 0.01, 'pending');
-- Expected: ERROR "new row violates row-level security policy" — confirms no new public policy was
-- accidentally added on restaurant_order_items; the RPC is the only anonymous write path.
RESET ROLE;
```

Do not apply this migration to any live Supabase project — this step is local verification only.

- [ ] **Step 3: Update `CLAUDE.md`'s migration list**

Append after the existing migration 56 entry:

```
57. `20260707_000057_order_item_integrity.sql` — adds qr_place_order() RPC, the sole anonymous write path for QR customer orders; resolves tenant_id server-side from the table (never trusts a client-supplied tenant id), revalidates item prices/modifier names server-side from the menu catalog rather than trusting client-supplied values, and branches on the target table_order's order_flow ('waiter_confirm' -> restaurant_pending_orders staging table, 'direct' -> real restaurant_order_items rows with menu_item_id always set)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707_000057_order_item_integrity.sql CLAUDE.md
git commit -m "feat(f&b): add qr_place_order RPC for anonymous QR order placement"
```

---

### Task 2: Recipe deduction wiring — `KitchenDisplay.tsx` + `useRestaurantOrder.ts`

**Files:**
- Modify: `src/pages/restaurant/KitchenDisplay.tsx` (import `useRecipeDeduction`; modify `handleBumpItem`, `handleBumpAll`, `handleMarkAllReady`)
- Modify: `src/hooks/useRestaurantOrder.ts:292-302` (add `menu_item_id` to the `inserts` map in `confirmPendingOrder`)
- Create: `src/pages/restaurant/KitchenDisplay.test.tsx`

**Interfaces:**
- Consumes: `useRecipeDeduction()` from `@/hooks/useRecipeDeduction` — already exists, unmodified, returns `{ deductForMenuItem: (menuItemId: string, quantity?: number) => Promise<void> }`.

- [ ] **Step 1: Write the failing test file**

Create `src/pages/restaurant/KitchenDisplay.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeductForMenuItem = vi.fn();
const mockUpdateCalls: unknown[] = [];
const mockOrdersResult = { data: [] as unknown[], error: null };
const mockItemsResult = { data: [] as unknown[], error: null };
const mockTablesResult = { data: [] as unknown[], error: null };

function makeUpdateChain() {
  const chain = {
    eq: () => chain,
    in: () => chain,
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  return chain;
}

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ({}) };
      return ch;
    },
    removeChannel: () => Promise.resolve(),
    from: (table: string) => {
      if (table === 'restaurant_kds_stations') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      if (table === 'table_orders') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve(mockOrdersResult) }) }) }) };
      }
      if (table === 'restaurant_tables') {
        return { select: () => ({ eq: () => Promise.resolve(mockTablesResult) }) };
      }
      // restaurant_order_items — supports both the initial select and the bump updates
      return {
        select: () => ({ eq: () => ({ in: () => ({ order: () => Promise.resolve(mockItemsResult) }) }) }),
        update: (payload: unknown) => {
          mockUpdateCalls.push(payload);
          return makeUpdateChain();
        },
      };
    },
  },
}));

vi.mock('@/hooks/useRecipeDeduction', () => ({
  useRecipeDeduction: () => ({ deductForMenuItem: mockDeductForMenuItem }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import KitchenDisplay from './KitchenDisplay';

const openOrder = {
  id: 'ord-1', tenant_id: 't1', table_id: 'tbl-1', status: 'open',
  current_course: 'mains', opened_at: '2026-07-07T10:00:00Z', closed_at: null,
};
const table = {
  id: 'tbl-1', tenant_id: 't1', number: 5, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

function pendingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', tenant_id: 't1', order_id: 'ord-1', menu_item_id: 'mi-1',
    product_name: 'Hummus', quantity: 2, unit_price: 5, modifiers: [], course: 'mains',
    status: 'pending', notes: null, sent_at: '2026-07-07T10:00:00Z', ready_at: null,
    ...overrides,
  };
}

describe('KitchenDisplay recipe deduction wiring', () => {
  beforeEach(() => {
    mockDeductForMenuItem.mockReset();
    mockUpdateCalls.length = 0;
    mockOrdersResult.data = [openOrder];
    mockTablesResult.data = [table];
  });

  it('deducts recipe ingredients when a single item is bumped to ready', async () => {
    mockItemsResult.data = [pendingItem()];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
    });
  });

  it('does not deduct twice on a rapid double-click of the same item', async () => {
    mockItemsResult.data = [pendingItem()];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call deduction for an item with no menu_item_id', async () => {
    mockItemsResult.data = [pendingItem({ id: 'item-2', menu_item_id: null })];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockUpdateCalls.length).toBeGreaterThan(0);
    });
    expect(mockDeductForMenuItem).not.toHaveBeenCalled();
  });

  it('deducts for every item when bumping all pending items at once', async () => {
    mockItemsResult.data = [
      pendingItem({ id: 'item-1', menu_item_id: 'mi-1', quantity: 2 }),
      pendingItem({ id: 'item-3', menu_item_id: 'mi-3', product_name: 'Fries', quantity: 3 }),
    ];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(2\)/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-3', 3);
    });
  });

  it('deducts for every item when marking all in-progress items ready', async () => {
    mockItemsResult.data = [pendingItem({ status: 'in_progress' })];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(1\)/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/restaurant/KitchenDisplay.test.tsx`
Expected: FAIL — deduction calls never happen (the wiring doesn't exist yet).

- [ ] **Step 3: Wire deduction into `KitchenDisplay.tsx`**

Add the import (in `src/pages/restaurant/KitchenDisplay.tsx`, alongside the existing `import { useApp } from '@/context/AppContext';` line):

```tsx
import { useRecipeDeduction } from '@/hooks/useRecipeDeduction';
```

Inside `export default function KitchenDisplay()`, near the top where other hooks are called (alongside the existing `useApp()` call), add:

```tsx
  const { deductForMenuItem } = useRecipeDeduction();
  const bumpingItemIds = useRef<Set<string>>(new Set());
```

Replace `handleBumpItem` entirely with:

```tsx
  const handleBumpItem = useCallback(async (itemId: string) => {
    if (!tenantId) return;
    if (bumpingItemIds.current.has(itemId)) return; // guard against a fast double-click
    bumpingItemIds.current.add(itemId);
    try {
      const currentItem = tickets.flatMap((tk) => tk.items).find((i) => i.id === itemId);
      const wasAlreadyReady = currentItem ? (currentItem.status === 'ready' || currentItem.status === 'served') : false;

      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('tenant_id', tenantId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev.map((tk) => ({
          ...tk,
          items: tk.items.map((i) =>
            i.id === itemId
              ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
              : i,
          ),
        })),
      );
      if (!wasAlreadyReady && currentItem?.menu_item_id) {
        void deductForMenuItem(currentItem.menu_item_id, currentItem.quantity);
      }
    } finally {
      bumpingItemIds.current.delete(itemId);
    }
  }, [tenantId, tickets, deductForMenuItem]);
```

Replace `handleBumpAll` entirely with:

```tsx
  const handleBumpAll = useCallback(
    async (orderId: string) => {
      const ticket = tickets.find((tk) => tk.order.id === orderId);
      if (!ticket) return;
      const itemsToBump = ticket.items.filter((i) => i.status === 'pending' || i.status === 'in_progress');
      if (itemsToBump.length === 0) return;
      if (!tenantId) return;
      const ids = itemsToBump.map((i) => i.id);
      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .in('id', ids)
        .eq('tenant_id', tenantId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev.map((tk) =>
          tk.order.id === orderId
            ? {
              ...tk,
              items: tk.items.map((i) =>
                ids.includes(i.id)
                  ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
                  : i,
              ),
            }
            : tk,
        ),
      );
      itemsToBump.forEach((item) => {
        if (item.menu_item_id) void deductForMenuItem(item.menu_item_id, item.quantity);
      });
    },
    [tickets, tenantId, deductForMenuItem],
  );
```

Replace `handleMarkAllReady` entirely with:

```tsx
  const handleMarkAllReady = useCallback(
    async (orderId: string) => {
      if (!tenantId) return;
      const ticket = tickets.find((tk) => tk.order.id === orderId);
      const itemsToBump = ticket ? ticket.items.filter((i) => i.status === 'in_progress') : [];
      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .eq('status', 'in_progress');
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev.map((tk) =>
          tk.order.id === orderId
            ? {
              ...tk,
              items: tk.items.map((i) =>
                i.status === 'in_progress'
                  ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
                  : i,
              ),
            }
            : tk,
        ),
      );
      itemsToBump.forEach((item) => {
        if (item.menu_item_id) void deductForMenuItem(item.menu_item_id, item.quantity);
      });
    },
    [tenantId, tickets, deductForMenuItem],
  );
```

`handleBumpAllReady` (the separate `ready → served` transition) is **not modified** — deduction must fire exactly once, at `ready`, not again at `served`.

- [ ] **Step 4: Fix `useRestaurantOrder.ts`'s `confirmPendingOrder`**

In `src/hooks/useRestaurantOrder.ts`, in the `inserts` map inside `confirmPendingOrder` (around line 292-302), add the missing field. Change:

```tsx
    const inserts = pendingItems.map((item) => ({
      tenant_id: tenantId,
      order_id: orderId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      course: item.course,
      notes: item.notes || null,
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));
```

to:

```tsx
    const inserts = pendingItems.map((item) => ({
      tenant_id: tenantId,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      course: item.course,
      notes: item.notes || null,
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run src/pages/restaurant/KitchenDisplay.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean, zero errors/warnings.

- [ ] **Step 7: Commit**

```bash
git add src/pages/restaurant/KitchenDisplay.tsx src/pages/restaurant/KitchenDisplay.test.tsx src/hooks/useRestaurantOrder.ts
git commit -m "fix(f&b): wire recipe-ingredient deduction into KDS ready transitions"
```

---

### Task 3: `QRCart.tsx` + `QROrderSuccess.tsx` — call `qr_place_order`, fix silent failure

**Files:**
- Modify: `src/pages/qr-menu/QRCart.tsx` (replace `handlePlaceOrder`, add inline error state)
- Modify: `src/pages/qr-menu/QROrderSuccess.tsx` (add `mode` prop, differentiated copy)
- Modify: `src/pages/qr-menu/QRMenuPage.tsx` (thread `mode` through `handleOrderSuccess` to `QROrderSuccess`)
- Create: `src/pages/qr-menu/QRCart.test.tsx`

**Interfaces:**
- Consumes: RPC `qr_place_order(p_table_id uuid, p_items jsonb) returns jsonb` from Task 1 (`{mode, order_id}`).
- Produces: `QRCartProps.onSuccess` signature changes from `(orderNumber: string) => void` to `(orderNumber: string, mode: 'direct' | 'pending') => void`; `QROrderSuccessProps` gains `mode: 'direct' | 'pending'`.

- [ ] **Step 1: Write the failing test file**

Create `src/pages/qr-menu/QRCart.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import QRCart from './QRCart';

const cartItem = {
  menuItemId: 'mi-1',
  menuItem: { id: 'mi-1', name: 'Hummus', name_ar: null, base_price_usd: 5, tenant_id: 't1', category_id: null, description: null, description_ar: null, photo_url: null, base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [], is_featured: false, is_chef_pick: false, is_eighty_sixd: false, active_breakfast: true, active_lunch: true, active_dinner: true, sort_order: 0, is_active: true },
  quantity: 2,
  selectedModifiers: { 'grp-1': ['mod-1'] },
  totalPrice: 10,
  notes: 'no onions',
};

describe('QRCart', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls qr_place_order with a thin, server-trusted payload (no client-computed price)', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-abcdef' }, error: null });
    const onSuccess = vi.fn();
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [{ menu_item_id: 'mi-1', quantity: 2, modifier_ids: ['mod-1'], notes: 'no onions' }],
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('ABCDEF', 'direct');
    });
  });

  it('passes mode "pending" through to onSuccess when the tenant requires waiter confirmation', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'pending', order_id: 'order-ghijkl' }, error: null });
    const onSuccess = vi.fn();
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('GHIJKL', 'pending');
    });
  });

  it('shows a visible error message instead of failing silently', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no_valid_items' } });
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: FAIL — `QRCart` still calls `.from('table_orders')` directly, never calls `supabase.rpc`.

- [ ] **Step 3: Rewrite `QRCart.tsx`**

In `src/pages/qr-menu/QRCart.tsx`, change the `onSuccess` prop type (line 17):

```tsx
  onSuccess: (orderNumber: string) => void;
```

to:

```tsx
  onSuccess: (orderNumber: string, mode: 'direct' | 'pending') => void;
```

Add a new state declaration immediately after the existing `const [placing, setPlacing] = useState(false);` line:

```tsx
  const [placeError, setPlaceError] = useState<string | null>(null);
```

Replace `handlePlaceOrder` entirely with:

```tsx
  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const payload = items.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        modifier_ids: Object.values(item.selectedModifiers).flat(),
        notes: item.notes || undefined,
      }));

      const { data, error } = await supabase.rpc('qr_place_order', {
        p_table_id: tableId,
        p_items: payload,
      });
      if (error) throw new Error(error.message);

      const result = data as { mode: 'direct' | 'pending'; order_id: string };
      onSuccess(result.order_id.slice(-6).toUpperCase(), result.mode);
    } catch (err) {
      console.error('[QRCart] place order error:', err);
      setPlaceError('Something went wrong placing your order — please try again or ask your server for help.');
    } finally {
      setPlacing(false);
    }
  };
```

Add the inline error banner in the JSX, immediately before the existing `<motion.button onClick={() => { void handlePlaceOrder(); }} ...>` element (inside the `{/* Footer */}` block):

```tsx
        {placeError && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-center text-xs"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--qr-text)' }}
          >
            {placeError}
          </p>
        )}
```

- [ ] **Step 4: Add the `mode` prop to `QROrderSuccess.tsx`**

In `src/pages/qr-menu/QROrderSuccess.tsx`, change the props interface:

```tsx
interface QROrderSuccessProps {
  orderNumber: string;
  onDone: () => void;
}
```

to:

```tsx
interface QROrderSuccessProps {
  orderNumber: string;
  mode: 'direct' | 'pending';
  onDone: () => void;
}
```

Change the function signature:

```tsx
export default function QROrderSuccess({ orderNumber, onDone }: QROrderSuccessProps) {
```

to:

```tsx
export default function QROrderSuccess({ orderNumber, mode, onDone }: QROrderSuccessProps) {
```

Replace the two `<h2>`/`<p>` heading lines:

```tsx
        <h2
          className="text-3xl font-bold"
          style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
        >
          Your order has been received!
        </h2>
        <p style={{ color: 'var(--qr-text-muted)' }} className="text-sm">
          Our team is on it — sit back and relax 🎉
        </p>
```

with:

```tsx
        <h2
          className="text-3xl font-bold"
          style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
        >
          {mode === 'pending' ? 'Your order has been sent!' : 'Your order has been received!'}
        </h2>
        <p style={{ color: 'var(--qr-text-muted)' }} className="text-sm">
          {mode === 'pending'
            ? "Your waiter will confirm it shortly, then it's off to the kitchen 🎉"
            : 'Our team is on it — sit back and relax 🎉'}
        </p>
```

Replace the "Our team has received..." paragraph and the estimated-time block:

```tsx
        <p className="text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          Our team has received your order and is preparing it with care.
        </p>
        <div
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
          style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)', color: 'var(--qr-text-muted)' }}
        >
          <span className="text-base">⏱️</span>
          <span>Estimated time: <strong style={{ color: 'var(--qr-text)' }}>15–20 minutes</strong></span>
        </div>
```

with:

```tsx
        <p className="text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          {mode === 'pending'
            ? 'Your waiter has been notified and will confirm your order shortly.'
            : 'Our team has received your order and is preparing it with care.'}
        </p>
        {mode === 'direct' && (
          <div
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
            style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)', color: 'var(--qr-text-muted)' }}
          >
            <span className="text-base">⏱️</span>
            <span>Estimated time: <strong style={{ color: 'var(--qr-text)' }}>15–20 minutes</strong></span>
          </div>
        )}
```

- [ ] **Step 5: Thread `mode` through `QRMenuPage.tsx`**

In `src/pages/qr-menu/QRMenuPage.tsx`, find the `orderNumber` state declaration (`const [orderNumber, setOrderNumber] = useState('');`) and add a sibling state immediately after it:

```tsx
  const [orderMode, setOrderMode] = useState<'direct' | 'pending'>('direct');
```

Change `handleOrderSuccess`:

```tsx
  const handleOrderSuccess = (num: string) => {
    setOrderNumber(num);
    clearCart();
    setView('success');
  };
```

to:

```tsx
  const handleOrderSuccess = (num: string, mode: 'direct' | 'pending') => {
    setOrderNumber(num);
    setOrderMode(mode);
    clearCart();
    setView('success');
  };
```

Change the `QROrderSuccess` render call:

```tsx
            <QROrderSuccess
              orderNumber={orderNumber}
              onDone={() => setView('menu')}
            />
```

to:

```tsx
            <QROrderSuccess
              orderNumber={orderNumber}
              mode={orderMode}
              onDone={() => setView('menu')}
            />
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean, zero errors/warnings.

- [ ] **Step 8: Commit**

```bash
git add src/pages/qr-menu/QRCart.tsx src/pages/qr-menu/QRCart.test.tsx src/pages/qr-menu/QROrderSuccess.tsx src/pages/qr-menu/QRMenuPage.tsx
git commit -m "fix(f&b): replace QRCart's broken direct writes with qr_place_order RPC"
```
