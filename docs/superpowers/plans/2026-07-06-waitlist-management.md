# Waitlist Management (Tier 1.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staff-run walk-in waitlist queue — add a party, notify them via a WhatsApp `wa.me` link when their table is ready, and seat them by atomically opening a table order and marking the table occupied.

**Architecture:** One new Postgres table (`restaurant_waitlist`) + one new RPC (`fn_seat_waitlist_party`) for the only multi-table operation (seating); every other transition (add, notify, no-show, cancel) is a direct single-row Supabase client call. One new React page (`src/pages/restaurant/Waitlist.tsx`), wired into existing routing and the "Front of House" nav group.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + PostgREST), Vitest + Testing Library, sonner (toasts), react-i18next, lucide-react icons, Tailwind.

## Global Constraints

- No live migration application without explicit authorization — deliver the migration as a file only (`docs/superpowers/specs/2026-07-06-waitlist-management-design.md`, Implementation Notes).
- No `tenant_id` filtering needed in RLS-protected `select`/`insert` queries beyond what RLS already enforces — but direct `.update()`/`.delete()` calls in this codebase's existing convention still chain `.eq('tenant_id', tenantId)` defensively (see `DeliveryOrders.tsx`, `Reservations.tsx`) — follow that convention.
- Every new `SECURITY DEFINER` RPC must resolve `tenant_id` and immediately check it against `current_tenant_id()` before any other logic — this ordering fixed a Critical cross-tenant IDOR in this branch's history (table/waiter transfer feature) and must not regress.
- No automated SQL test harness exists in this repo — RPC correctness is verified via a scratch Postgres 16 instance (empirical check) or Supabase SQL Editor smoke test, not a pytest/vitest-style automated test.
- TypeScript strict mode, `noUncheckedIndexedAccess` — no `any`. Run `npm run typecheck && npm run lint` after every task.
- Dark theme only: `bg-slate-900`/`bg-white/5`/`bg-white/10` backgrounds, `text-white`/`text-white/60` text, `border-white/10` borders — match `DeliveryOrders.tsx`/`Reservations.tsx` exactly, no light backgrounds.
- `@/` path alias for all cross-directory imports.

---

### Task 1: Migration — `restaurant_waitlist` table + `fn_seat_waitlist_party` RPC

**Files:**
- Create: `supabase/migrations/20260706_000056_waitlist_management.sql`
- Modify: `CLAUDE.md:178` (append migration 56 entry directly after the existing line 178 entry for migration 55)

**Interfaces:**
- Produces: table `restaurant_waitlist` (columns: `id`, `tenant_id`, `guest_name`, `guest_phone`, `party_size`, `status`, `notes`, `table_id`, `created_at`, `notified_at`, `seated_at`); RPC `fn_seat_waitlist_party(p_waitlist_id uuid, p_target_table_id uuid) returns uuid` (returns the new `table_orders.id`).
- Consumes: existing tables `tenants`, `restaurant_tables` (columns `id`, `tenant_id`, `status` — values `'available'|'occupied'|'reserved'|'cleaning'`), `table_orders` (columns `id`, `tenant_id`, `table_id`, `status`, `notes` — `current_course`/`opened_at`/`closed_at` all have defaults, no need to set them on insert); existing function `current_tenant_id()`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260706_000056_waitlist_management.sql` with this exact content:

```sql
-- Migration: Waitlist Management (Tier 1.3)
-- Roadmap source: docs/fnb-competitive-gap-analysis.md, Tier 1 item 3.
-- Design spec: docs/superpowers/specs/2026-07-06-waitlist-management-design.md
--
-- New table restaurant_waitlist tracks the walk-in queue. Every transition
-- except seating is a direct single-row update from the frontend (no RPC
-- needed — see Waitlist.tsx). Seating a party is the one multi-table,
-- atomic operation: it creates the table_orders shell (with the real
-- assigned table_id — unlike the delivery-order shell, a waitlist seating
-- always has a physical table), marks the table occupied, and closes out
-- the waitlist entry, all in one transaction so a table can never be
-- double-assigned to two parties.

-- 1. restaurant_waitlist
CREATE TABLE IF NOT EXISTS restaurant_waitlist (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  guest_name   text not null,
  guest_phone  text not null,
  party_size   integer not null default 2,
  status       text not null default 'waiting', -- 'waiting'|'notified'|'seated'|'no_show'|'cancelled'
  notes        text,
  table_id     uuid references restaurant_tables(id) on delete set null, -- set once seated
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  seated_at    timestamptz
);

ALTER TABLE restaurant_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wl_select" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_insert" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_update" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_delete" ON restaurant_waitlist;

CREATE POLICY "wl_select" ON restaurant_waitlist FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY "wl_insert" ON restaurant_waitlist FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "wl_update" ON restaurant_waitlist FOR UPDATE
  USING (tenant_id = current_tenant_id());
CREATE POLICY "wl_delete" ON restaurant_waitlist FOR DELETE
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS restaurant_waitlist_tenant_status_idx
  ON restaurant_waitlist(tenant_id, status);

-- 2. fn_seat_waitlist_party — the one atomic, multi-table operation.
-- SECURITY DEFINER, tenant-checked immediately after resolving tenant_id,
-- before any other logic (established IDOR-prevention pattern in this repo).
CREATE OR REPLACE FUNCTION fn_seat_waitlist_party(p_waitlist_id uuid, p_target_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id        uuid;
  v_status           text;
  v_guest_name       text;
  v_party_size       integer;
  v_table_tenant_id  uuid;
  v_table_status     text;
  v_table_order_id   uuid;
BEGIN
  SELECT tenant_id, status, guest_name, party_size
    INTO v_tenant_id, v_status, v_guest_name, v_party_size
    FROM restaurant_waitlist
    WHERE id = p_waitlist_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'waitlist_entry_not_found: %', p_waitlist_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status NOT IN ('waiting', 'notified') THEN
    RAISE EXCEPTION 'Waitlist entry % is not seatable (status = %)', p_waitlist_id, v_status;
  END IF;

  SELECT tenant_id, status
    INTO v_table_tenant_id, v_table_status
    FROM restaurant_tables
    WHERE id = p_target_table_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'table_not_found: %', p_target_table_id;
  END IF;

  IF v_table_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_table_status <> 'available' THEN
    RAISE EXCEPTION 'Table % is not available (status = %)', p_target_table_id, v_table_status;
  END IF;

  INSERT INTO table_orders (tenant_id, table_id, status, notes)
  VALUES (
    v_tenant_id,
    p_target_table_id,
    'open',
    'WAITLIST: ' || v_guest_name || ' (' || v_party_size || ')'
  )
  RETURNING id INTO v_table_order_id;

  UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

  UPDATE restaurant_waitlist
    SET status = 'seated', seated_at = now(), table_id = p_target_table_id
    WHERE id = p_waitlist_id;

  RETURN v_table_order_id;
END;
$$;
```

- [ ] **Step 2: Empirically verify the migration against a scratch Postgres 16 instance**

This repo has no automated SQL test harness (established convention — see `docs/superpowers/specs/2026-07-06-waitlist-management-design.md`, Testing section). Verify correctness the same way this branch's earlier Postgres bugs were caught: spin up a scratch Postgres 16 Docker container, apply the base schema migrations this file depends on (`tenants`, `current_tenant_id()`, `restaurant_tables`, `table_orders` — from `20250617_000000_initial_schema.sql` and `20260620_000031_restaurant_schema.sql`, stubbing `auth.users`/`auth.uid()` as needed), then apply this migration, then run:

```sql
-- Setup: one tenant, one available table, one waiting party
INSERT INTO tenants (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant');
INSERT INTO restaurant_tables (id, tenant_id, number, status) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 5, 'available');
INSERT INTO restaurant_waitlist (id, tenant_id, guest_name, guest_phone, party_size, status) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Karim', '+96181290662', 4, 'waiting');

-- Simulate current_tenant_id() returning the test tenant (however this repo's
-- scratch-verification setup stubs it — matching the approach the Task 1
-- reviewer used for the earlier finalize_restaurant_order overload bug).

SELECT fn_seat_waitlist_party('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');
-- Expected: returns a new table_orders id, no error.

SELECT status, table_id FROM restaurant_waitlist WHERE id = '33333333-3333-3333-3333-333333333333';
-- Expected: status='seated', table_id='22222222-2222-2222-2222-222222222222'.

SELECT status FROM restaurant_tables WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: status='occupied'.

SELECT table_id, status, notes FROM table_orders WHERE id = (SELECT table_id FROM restaurant_waitlist WHERE id = '33333333-3333-3333-3333-333333333333');
-- Expected: table_id='22222222-2222-2222-2222-222222222222' (NOT null), status='open', notes='WAITLIST: Karim (4)'.

-- Double-seat should now fail:
SELECT fn_seat_waitlist_party('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');
-- Expected: ERROR "Waitlist entry ... is not seatable (status = seated)".

-- Seating onto an occupied table should fail:
INSERT INTO restaurant_waitlist (id, tenant_id, guest_name, guest_phone, party_size, status) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Lea', '+96170123456', 2, 'waiting');
SELECT fn_seat_waitlist_party('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222');
-- Expected: ERROR "Table ... is not available (status = occupied)".
```

Also verify the cross-tenant case: as a second tenant (`current_tenant_id()` returning a different UUID), calling `fn_seat_waitlist_party` on the first tenant's waitlist entry or table must raise `permission_denied` — confirming the tenant check runs before the status checks.

Do not apply this migration to any live Supabase project — this step is local verification only.

- [ ] **Step 3: Update `CLAUDE.md`'s migration list**

In `CLAUDE.md`, immediately after line 178 (the existing entry `55. \`20260706_000055_delivery_order_intake.sql\` — ...`), insert:

```
56. `20260706_000056_waitlist_management.sql` — adds restaurant_waitlist table (walk-in queue) + fn_seat_waitlist_party() RPC (Tier 1.3); seating atomically creates the table_orders shell with the real assigned table_id, marks the table occupied, and closes out the waitlist entry
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260706_000056_waitlist_management.sql CLAUDE.md
git commit -m "feat(f&b): add waitlist management RPCs (Tier 1.3)"
```

---

### Task 2: `Waitlist.tsx` page (TDD)

**Files:**
- Create: `src/pages/restaurant/Waitlist.tsx`
- Create: `src/pages/restaurant/Waitlist.test.tsx`

**Interfaces:**
- Consumes: RPC `fn_seat_waitlist_party(p_waitlist_id uuid, p_target_table_id uuid)` from Task 1; table `restaurant_waitlist` (same columns as Task 1); existing `restaurant_tables` table (`id`, `number`, `seats`, `status`); `useApp()` from `@/context/AppContext` (`currentTenant.id`); `supabase` from `@/utils/supabaseClient`; `RoleGate` from `@/components/RoleGate` (`action="make_sales"`); `Layout` from `@/components/Layout`.
- Produces: default-exported React component `Waitlist`, consumed by Task 3's routing.

- [ ] **Step 1: Write the failing test file**

Create `src/pages/restaurant/Waitlist.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();
const mockWaitlistSelectResult = { data: [] as unknown[], error: null };
const mockTablesSelectResult = { data: [] as unknown[], error: null };

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table === 'restaurant_waitlist') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve(mockWaitlistSelectResult),
              }),
            }),
          }),
          insert: (...args: unknown[]) => {
            mockInsert(...args);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'wl-new', ...(args[0] as object) }, error: null }) }) };
          },
          update: (...args: unknown[]) => {
            mockUpdate(...args);
            return { eq: () => ({ eq: (...eqArgs: unknown[]) => mockEq2(...eqArgs) }) };
          },
        };
      }
      // restaurant_tables
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve(mockTablesSelectResult),
            }),
          }),
        }),
      };
    },
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

import Waitlist from './Waitlist';

const waitingEntry = {
  id: 'wl-1', tenant_id: 't1', guest_name: 'Karim', guest_phone: '+96181290662',
  party_size: 4, status: 'waiting', notes: null, table_id: null,
  created_at: '2026-07-06T10:00:00Z', notified_at: null, seated_at: null,
};
const notifiedEntry = { ...waitingEntry, id: 'wl-2', guest_name: 'Lea', status: 'notified', notified_at: '2026-07-06T10:05:00Z' };
const availableTable = { id: 'tbl-1', number: 5, seats: 4, status: 'available' };

describe('Waitlist', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'order-1', error: null });
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    mockWaitlistSelectResult.data = [waitingEntry, notifiedEntry];
    mockTablesSelectResult.data = [availableTable];
  });

  it('renders the queue with guest names and elapsed wait time', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    expect(screen.getByText('Lea')).toBeInTheDocument();
  });

  it('shows Notify, Seat, Cancel for a waiting entry', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    expect(within(karimRow).getByRole('button', { name: /notify/i })).toBeInTheDocument();
    expect(within(karimRow).getByRole('button', { name: /seat/i })).toBeInTheDocument();
    expect(within(karimRow).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Seat, Cancel, No-show for a notified entry (no Notify button)', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Lea')).toBeInTheDocument(); });
    const leaRow = screen.getByText('Lea').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    expect(within(leaRow).queryByRole('button', { name: /^notify$/i })).not.toBeInTheDocument();
    expect(within(leaRow).getByRole('button', { name: /seat/i })).toBeInTheDocument();
    expect(within(leaRow).getByRole('button', { name: /no-show/i })).toBeInTheDocument();
  });

  it('adds a party to the waitlist via the Add to Waitlist form', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add to waitlist/i })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /add to waitlist/i }));
    fireEvent.change(screen.getByLabelText(/guest name/i), { target: { value: 'Nadim' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+96170111222' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't1', guest_name: 'Nadim', guest_phone: '+96170111222', party_size: 2, status: 'waiting',
      }));
    });
  });

  it('marks an entry notified and does not call an RPC', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /notify/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'notified' }));
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('cancels an entry via a direct update, not an RPC', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'cancelled' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('marks a notified entry no-show via a direct update', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Lea')).toBeInTheDocument(); });
    const leaRow = screen.getByText('Lea').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(leaRow).getByRole('button', { name: /no-show/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'no_show' });
    });
  });

  it('seats a party by calling fn_seat_waitlist_party with the chosen table', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /seat/i }));
    await waitFor(() => { expect(screen.getByText(/table 5/i)).toBeInTheDocument(); });
    fireEvent.click(screen.getByText(/table 5/i));
    fireEvent.click(screen.getByRole('button', { name: /confirm seat/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_seat_waitlist_party', { p_waitlist_id: 'wl-1', p_target_table_id: 'tbl-1' });
    });
  });

  it('shows an error toast when an RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /seat/i }));
    await waitFor(() => { expect(screen.getByText(/table 5/i)).toBeInTheDocument(); });
    fireEvent.click(screen.getByText(/table 5/i));
    fireEvent.click(screen.getByRole('button', { name: /confirm seat/i }));
    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
  });
});
```

Every row-scoped query above (`within(karimRow).getByRole(...)`, etc.) uses the real `within` from `@testing-library/react` imported at the top of the file, scoped to the `HTMLElement` returned by `screen.getByText('Karim').closest('div[data-testid="waitlist-row"]')`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/restaurant/Waitlist.test.tsx`
Expected: FAIL — `Cannot find module './Waitlist'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/pages/restaurant/Waitlist.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Users, Plus, X, MessageCircle, Armchair, XCircle } from 'lucide-react';

import Layout from '@/components/Layout';
import RoleGate from '@/components/RoleGate';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'no_show' | 'cancelled';

interface WaitlistEntry {
  id: string;
  tenant_id: string;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  status: WaitlistStatus;
  notes: string | null;
  table_id: string | null;
  created_at: string;
  notified_at: string | null;
  seated_at: string | null;
}

interface AvailableTable {
  id: string;
  number: number;
  seats: number;
  status: string;
}

interface WaitlistFormData {
  guest_name: string;
  guest_phone: string;
  party_size: number;
  notes: string;
}

const EMPTY_FORM: WaitlistFormData = { guest_name: '', guest_phone: '', party_size: 2, notes: '' };
const ACTIVE_STATUSES: WaitlistStatus[] = ['waiting', 'notified'];
const POLL_INTERVAL_MS = 30_000;

function formatElapsed(createdAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function buildReadyWhatsAppLink(phone: string, guestName: string, partySize: number): string {
  const msg = encodeURIComponent(
    `Hi ${guestName}! Your table for ${partySize} is ready — please head to the host stand. — KiTS Restaurant`,
  );
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${msg}`;
}

export default function Waitlist() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<WaitlistFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seatingEntry, setSeatingEntry] = useState<WaitlistEntry | null>(null);
  const [seatTargetTableId, setSeatTargetTableId] = useState('');
  const [seating, setSeating] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    const [waitlistRes, tablesRes] = await Promise.all([
      supabase.from('restaurant_waitlist').select('*').eq('tenant_id', tenantId).in('status', ACTIVE_STATUSES).order('created_at'),
      supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).eq('status', 'available').order('number'),
    ]);
    if (waitlistRes.data) setEntries(waitlistRes.data as WaitlistEntry[]);
    if (tablesRes.data) setAvailableTables(tablesRes.data as AvailableTable[]);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => { void loadData(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreate = async () => {
    if (!tenantId) return;
    if (!form.guest_name.trim()) { toast.error(t('waitlist.nameRequired', 'Guest name required')); return; }
    if (!form.guest_phone.trim()) { toast.error(t('waitlist.phoneRequired', 'Phone required')); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('restaurant_waitlist').insert({
        tenant_id: tenantId,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        party_size: form.party_size,
        notes: form.notes.trim() || null,
        status: 'waiting',
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setAddModalOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t('waitlist.added', 'Added to waitlist'));
      void loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleNotify = async (entry: WaitlistEntry) => {
    const { error } = await supabase
      .from('restaurant_waitlist')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    window.open(buildReadyWhatsAppLink(entry.guest_phone, entry.guest_name, entry.party_size), '_blank', 'noopener,noreferrer');
    void loadData();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('restaurant_waitlist').update({ status: 'cancelled' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    void loadData();
  };

  const handleNoShow = async (id: string) => {
    const { error } = await supabase.from('restaurant_waitlist').update({ status: 'no_show' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    void loadData();
  };

  const handleConfirmSeat = async () => {
    if (!seatingEntry || !seatTargetTableId) return;
    setSeating(true);
    try {
      const { error } = await supabase.rpc('fn_seat_waitlist_party', {
        p_waitlist_id: seatingEntry.id,
        p_target_table_id: seatTargetTableId,
      });
      if (error) { toast.error(t('waitlist.seatError', 'Failed to seat party')); return; }
      toast.success(t('waitlist.seated', 'Party seated'));
      setSeatingEntry(null);
      setSeatTargetTableId('');
      void loadData();
    } finally {
      setSeating(false);
    }
  };

  return (
    <Layout>
      <RoleGate action="make_sales">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-bold text-white">
              <Users className="h-5 w-5" />
              {t('waitlist.title', 'Waitlist')}
            </h1>
            <button
              onClick={() => { setForm(EMPTY_FORM); setAddModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('waitlist.addButton', 'Add to Waitlist')}
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5">
              <Users className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/30">{t('waitlist.empty', 'No one waiting')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  data-testid="waitlist-row"
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{entry.guest_name}</h3>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                        {formatElapsed(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">
                      {entry.guest_phone} · {entry.party_size} {t('waitlist.guests', 'guests')}
                    </p>
                    {entry.notes && <p className="mt-1 text-xs italic text-amber-400/70">{entry.notes}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {entry.status === 'waiting' && (
                      <button
                        onClick={() => { void handleNotify(entry); }}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-600/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/30"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {t('waitlist.notify', 'Notify')}
                      </button>
                    )}
                    <button
                      onClick={() => { setSeatingEntry(entry); setSeatTargetTableId(''); }}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Armchair className="h-3 w-3" />
                      {t('waitlist.seat', 'Seat')}
                    </button>
                    {entry.status === 'notified' && (
                      <button
                        onClick={() => { void handleNoShow(entry.id); }}
                        className="rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/5"
                      >
                        {t('waitlist.noShow', 'No-show')}
                      </button>
                    )}
                    <button
                      onClick={() => { void handleCancel(entry.id); }}
                      className="rounded-xl border border-white/10 p-1.5 text-white/20 hover:border-red-500/30 hover:text-red-400"
                      aria-label={`Cancel waitlist entry for ${entry.guest_name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setAddModalOpen(false); }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{t('waitlist.addButton', 'Add to Waitlist')}</h2>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="waitlist-guest-name" className="mb-1 block text-xs text-white/50">{t('waitlist.guestName', 'Guest Name')} *</label>
                  <input
                    id="waitlist-guest-name"
                    type="text"
                    value={form.guest_name}
                    onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-guest-phone" className="mb-1 block text-xs text-white/50">{t('waitlist.guestPhone', 'Phone (WhatsApp)')} *</label>
                  <input
                    id="waitlist-guest-phone"
                    type="tel"
                    value={form.guest_phone}
                    onChange={(e) => setForm((p) => ({ ...p, guest_phone: e.target.value }))}
                    placeholder="+961 3 XXX XXX"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-party-size" className="mb-1 block text-xs text-white/50">{t('waitlist.partySize', 'Party Size')}</label>
                  <input
                    id="waitlist-party-size"
                    type="number"
                    min={1}
                    max={50}
                    value={form.party_size}
                    onChange={(e) => setForm((p) => ({ ...p, party_size: parseInt(e.target.value) || 2 }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-notes" className="mb-1 block text-xs text-white/50">{t('waitlist.notes', 'Notes (optional)')}</label>
                  <textarea
                    id="waitlist-notes"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { void handleCreate(); }}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? t('common.saving', 'Saving…') : t('waitlist.add', 'Add')}
                  </button>
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {seatingEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSeatingEntry(null); }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {t('waitlist.seatPartyTitle', 'Seat')} {seatingEntry.guest_name}
                </h2>
                <button onClick={() => setSeatingEntry(null)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {availableTables.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-white/40">
                  <XCircle className="h-4 w-4" />
                  {t('waitlist.noAvailableTables', 'No available tables')}
                </p>
              ) : (
                <div className="space-y-2">
                  {availableTables.map((tbl) => (
                    <button
                      key={tbl.id}
                      onClick={() => setSeatTargetTableId(tbl.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                        seatTargetTableId === tbl.id
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {t('restaurant.tableNum', 'Table')} {tbl.number} ({tbl.seats}p)
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { void handleConfirmSeat(); }}
                disabled={seating || !seatTargetTableId}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('waitlist.confirmSeat', 'Confirm Seat')}
              </button>
            </div>
          </div>
        )}
      </RoleGate>
    </Layout>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/pages/restaurant/Waitlist.test.tsx`
Expected: all tests PASS (9 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean, zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/pages/restaurant/Waitlist.tsx src/pages/restaurant/Waitlist.test.tsx
git commit -m "feat(f&b): add Waitlist queue page (Tier 1.3)"
```

---

### Task 3: Wire routing + navigation

**Files:**
- Modify: `src/App.tsx:79` (add lazy import, after the existing `RestaurantDeliveryOrders` lazy import), `src/App.tsx:445` (add route, after the existing `/restaurant/delivery-orders` route)
- Modify: `src/components/Layout.tsx:230` (add nav entry to the `RESTAURANT_NAV_GROUPS` "Front of House" group, immediately after the Reservations entry)

**Interfaces:**
- Consumes: `Waitlist` default export from Task 2 (`src/pages/restaurant/Waitlist.tsx`).

- [ ] **Step 1: Add the lazy import in `App.tsx`**

In `src/App.tsx`, immediately after line 79 (`const RestaurantDeliveryOrders = lazy(() => import('./pages/restaurant/DeliveryOrders'));`), add:

```tsx
const RestaurantWaitlist = lazy(() => import('./pages/restaurant/Waitlist'));
```

- [ ] **Step 2: Add the route in `App.tsx`**

Immediately after line 445 (`<Route path="/restaurant/delivery-orders" element={isAuthenticated ? <RestaurantDeliveryOrders /> : <Navigate to="/login" replace />} />`), add:

```tsx
<Route path="/restaurant/waitlist" element={isAuthenticated ? <RestaurantWaitlist /> : <Navigate to="/login" replace />} />
```

- [ ] **Step 3: Add the nav entry in `Layout.tsx`**

In `src/components/Layout.tsx`, in the `RESTAURANT_NAV_GROUPS` array's `"Front of House"` group (around line 226-232), immediately after the Reservations entry (line 230: `{ name: t('nav.vertical.reservations', 'Reservations'), icon: Clock, href: '/restaurant/reservations' },`), add:

```tsx
{ name: t('nav.vertical.waitlist', 'Waitlist'), icon: Users, href: '/restaurant/waitlist' },
```

`Users` is already imported from `lucide-react` at the top of this file (used elsewhere in the nav) — no new import needed.

- [ ] **Step 4: Typecheck, lint, and build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 5: Verify the route renders (manual/browser check)**

Start the dev server (`npm run dev`) and navigate to `http://localhost:5173/restaurant/waitlist` while unauthenticated. Expected: redirects to `/login` (no crash, no 404, no blank page) — the same route-guard behavior confirmed for `/restaurant/delivery-orders` in the prior feature. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat(f&b): wire Waitlist page into routing and navigation"
```
