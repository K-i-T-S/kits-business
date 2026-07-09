# Active Tenant Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user an explicit, deterministic "active tenant" so `current_tenant_id()`/`current_user_role()` — which back nearly every RLS policy on the platform — never resolve to an arbitrary tenant for a user who belongs to more than one.

**Architecture:** A new `user_active_tenant` table (one row per user) replaces the old unordered `LIMIT 1` over `tenant_users`. Every code path that puts a user "onto" a tenant (`create_tenant`, both invite-acceptance paths, the tenant picker) upserts this table. A backfill seeds it for all existing users in the same migration as the function rewrite, so the deploy itself causes no outage.

**Tech Stack:** PostgreSQL/Supabase (SQL migration, PL/pgSQL functions, RLS), React/TypeScript frontend (`tenantManager.ts`, `TenantSelection.tsx`), Vitest for the frontend test.

## Global Constraints

- TypeScript strict, no `any` — use `unknown` and narrow (repo-wide rule, `CLAUDE.md`).
- Every new/replaced SQL function must have `SET search_path = 'public'` (or `SET search_path TO 'public'` — both forms appear in this codebase; either is acceptable) — the established defense-in-depth pattern from the `000058`/`000060` security audits.
- `user_active_tenant` must **never** be directly writable by the `authenticated` role via PostgREST (no `GRANT INSERT/UPDATE` to `authenticated`). All writes go through `SECURITY DEFINER` RPCs that verify tenant membership server-side first. Granting direct write access would let a client set their own active tenant to any `tenant_id` with no membership check — this is a hard security requirement, not a style preference.
- The backfill (inserting into `user_active_tenant` for all existing users) must be in the same migration file as the `current_tenant_id()`/`current_user_role()` rewrite, and must run before those functions are replaced in file order. Deploying the function rewrite without the backfill first is a platform-wide outage (every existing user's `current_tenant_id()` becomes `NULL` until they manually reselect).
- Follow the migration file header-comment convention already used throughout `supabase/migrations/` (root cause, impact, fix, one paragraph each) — see any of `000058`–`000063` for the established style.
- Dark theme palette for any new UI (none needed for this plan, noted for completeness): `bg-slate-900`/`bg-slate-950`/`bg-white/5`/`bg-white/10`, `text-white` variants, `border-white/10`/`border-white/20`.
- This repo has no pgTAP or other automated SQL-migration test framework. Task 1's correctness is verified by careful manual review against the exact current-state SQL quoted in its brief (not by an automated test run) — matching how migrations `000058`–`000063` were verified earlier this session.

---

### Task 1: Database migration — user_active_tenant table, function rewrite, RPC, and the three activation touch-points

**Files:**
- Create: `supabase/migrations/20260709_000064_active_tenant_selection.sql`
- Modify: `CLAUDE.md:187` (append new migration list entry after the existing entry 64)

**Interfaces:**
- Produces: `user_active_tenant(user_id, tenant_id, updated_at)` table; `select_active_tenant(p_tenant_id uuid) RETURNS boolean` RPC (raises `permission_denied` if the caller is not an active member of `p_tenant_id`); rewritten `current_tenant_id()`/`current_user_role()` (same names/signatures/return types as before — every existing RLS policy that calls them is unaffected); `create_tenant(...)` keeps its existing signature (`tenant_name text, tenant_slug text, owner_user_id uuid, settings jsonb DEFAULT '{}'::jsonb`) and still returns the new tenant's `uuid`; `accept_pending_invitation(p_invitation_id UUID) RETURNS JSONB` keeps its existing signature and return shape (`{success, tenant_id}`); `handle_new_user_invite()` trigger keeps its existing behavior/signature.
- Consumes: nothing from other tasks — this task is self-contained and must land first (Task 2 calls the `select_active_tenant` RPC this task creates).

This is one migration file, not split into steps with separate commits, because the backfill and the function rewrite must be in the same transaction/file to avoid a deploy-time outage (see Global Constraints). Write the whole file, then verify it, then commit once.

- [ ] **Step 1: Write the full migration file**

Create `supabase/migrations/20260709_000064_active_tenant_selection.sql`:

```sql
-- ============================================================
-- Migration: Explicit Active-Tenant Selection
--
-- Root cause: current_tenant_id()/current_user_role() (defined in
-- 20250617_000000_initial_schema.sql) resolved a user's tenant via
-- `SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND
-- is_active = true LIMIT 1` — no ORDER BY. For any user belonging to
-- 2+ tenants, which row this resolved to was UNDEFINED. These two
-- functions back ~197 RLS policy references across virtually the
-- whole schema, so any multi-tenant user had an effectively random
-- "which business am I operating on" for every RLS-scoped read/write.
--
-- The platform's own kits.tech.co@gmail.com admin account is
-- auto-added to every tenant on the platform by a trigger in
-- 20260618_000021_roles_and_custom_roles.sql, making it the account
-- most likely to hit this — confirmed as the cause of a real "unable
-- to create a new demo account" failure on 2026-07-09: create_tenant
-- (SECURITY DEFINER, bypasses RLS) succeeded, but OnboardingWizard's
-- subsequent client-side writes (tenants UPDATE, products INSERT)
-- resolved current_tenant_id() to a DIFFERENT, pre-existing tenant —
-- silently dropping the business-profile save, then hard-failing the
-- product insert with a raw RLS error ("new row violates row-level
-- security policy for table products").
--
-- Fix: a dedicated user_active_tenant table (one row per user) makes
-- "which tenant is this user currently on" explicit and deterministic
-- — no ordering, no ties. Every place that puts a user onto a tenant
-- (create_tenant, both invite-acceptance paths, the TenantSelection
-- picker) upserts it. A backfill seeds it for all existing users
-- before the function rewrite below, so the deploy itself does not
-- lock anyone out.
--
-- Full design: docs/superpowers/specs/2026-07-09-active-tenant-selection-design.md
-- ============================================================

-- ── 1. New table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_active_tenant (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_active_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own active tenant" ON user_active_tenant
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON user_active_tenant TO authenticated;
-- Deliberately no INSERT/UPDATE/DELETE grant to authenticated: every
-- write goes through select_active_tenant() / create_tenant() /
-- accept_pending_invitation() / handle_new_user_invite(), all
-- SECURITY DEFINER and all verifying tenant membership server-side
-- before writing. Granting direct table writes here would let a
-- client set their own active tenant to any tenant_id with zero
-- membership check.

-- ── 2. Backfill existing users BEFORE the function rewrite ──────
-- Must happen before step 3 flips current_tenant_id()/current_user_role()
-- over to read from this table, or every existing user (not just
-- multi-tenant ones) is NULL-locked out of every RLS-scoped table the
-- instant this migration finishes.

INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
SELECT DISTINCT ON (user_id) user_id, tenant_id, now()
FROM tenant_users
WHERE is_active = true
ORDER BY user_id, created_at ASC
ON CONFLICT (user_id) DO NOTHING;

-- ── 3. Rewrite the RLS helper functions ──────────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT tu.tenant_id
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT tu.role
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;

-- ── 4. New RPC: select_active_tenant ─────────────────────────────
-- Called by the frontend whenever a user picks a tenant from the
-- "Choose Your Business" screen.

CREATE OR REPLACE FUNCTION select_active_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
  VALUES (auth.uid(), p_tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = p_tenant_id, updated_at = now();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION select_active_tenant(uuid) FROM anon;

-- ── 5. create_tenant: activate the tenant the creator just made ──
-- Unchanged signature/behavior except the added upsert at the end —
-- this is what makes OnboardingWizard work immediately after tenant
-- creation with no extra frontend round-trip, regardless of how many
-- other tenants the creator already belongs to.

CREATE OR REPLACE FUNCTION public.create_tenant(tenant_name text, tenant_slug text, owner_user_id uuid, settings jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    new_tenant_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_user_id THEN
        RAISE EXCEPTION 'Not authorized: you may only create a tenant naming yourself as owner';
    END IF;
    INSERT INTO tenants (name, slug, settings) VALUES (tenant_name, tenant_slug, settings)
    RETURNING id INTO new_tenant_id;
    INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (new_tenant_id, owner_user_id, 'owner');

    INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
    VALUES (owner_user_id, new_tenant_id, now())
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = new_tenant_id, updated_at = now();

    RETURN new_tenant_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_tenant(text, text, uuid, jsonb) FROM anon;

-- ── 6. accept_pending_invitation: activate the joined tenant ─────
-- Unchanged signature/return shape except the added upsert. This one
-- is load-bearing, not optional: an invited user who accepts via this
-- RPC never passes through the TenantSelection picker, so without
-- this upsert they would be NULL-locked out of the tenant they just
-- joined on their very next query.

CREATE OR REPLACE FUNCTION accept_pending_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM pending_invitations
  WHERE id = p_invitation_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF lower(v_invitation.email) != lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation is for a different email address';
  END IF;

  -- Link user to tenant directly (bypasses current_user_role() check
  -- that would fail for users with no existing tenant context)
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (v_invitation.tenant_id, v_user_id, v_invitation.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role       = v_invitation.role,
    is_active  = true,
    updated_at = NOW();

  INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
  VALUES (v_user_id, v_invitation.tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = v_invitation.tenant_id, updated_at = now();

  -- Create employee record if role warrants it
  INSERT INTO employees (
    tenant_id, user_id, name, email, role, commission_rate, is_active, created_at
  )
  VALUES (
    v_invitation.tenant_id,
    v_user_id,
    v_invitation.name,
    v_invitation.email,
    v_invitation.role,
    COALESCE(v_invitation.commission, 0),
    true,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  -- Mark invitation accepted
  UPDATE pending_invitations
  SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true, 'tenant_id', v_invitation.tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_pending_invitation(UUID) TO authenticated;

-- ── 7. handle_new_user_invite: activate the joined tenant ─────────
-- Fires when a brand-new user signs up with an email that has a
-- pending invitation. Same load-bearing reasoning as step 6 — this
-- path never touches TenantSelection.tsx either.

CREATE OR REPLACE FUNCTION public.handle_new_user_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_invite public.pending_invitations%ROWTYPE;
    v_tenant_id UUID;
BEGIN
    -- Find an unaccepted invitation for this email
    SELECT * INTO v_invite
    FROM public.pending_invitations
    WHERE email = NEW.email
      AND accepted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
        -- No invite — user signed up independently, nothing to do.
        RETURN NEW;
    END IF;

    v_tenant_id := v_invite.tenant_id;

    -- Add the user to the tenant with the invited role
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, v_invite.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role       = v_invite.role,
        is_active  = true,
        updated_at = NOW();

    INSERT INTO public.user_active_tenant (user_id, tenant_id, updated_at)
    VALUES (NEW.id, v_tenant_id, now())
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = v_tenant_id, updated_at = now();

    -- Create the employee record for non-owner roles
    IF v_invite.role IN ('manager', 'cashier') THEN
        INSERT INTO public.employees (
            tenant_id, user_id, name, email, role, commission_rate
        )
        VALUES (
            v_tenant_id,
            NEW.id,
            v_invite.name,
            NEW.email,
            v_invite.role,
            COALESCE(v_invite.commission, 0)
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Mark invite as accepted
    UPDATE public.pending_invitations
    SET accepted_at = NOW(),
        status      = 'accepted'
    WHERE id = v_invite.id;

    RETURN NEW;
END;
$$;

-- Recreate the trigger (DROP+CREATE to ensure function binding is refreshed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_invite();
```

- [ ] **Step 2: Manual verification pass (no pgTAP in this repo — read carefully instead of running a suite)**

Check each of the following by reading the file, and note the result in your report:

1. The backfill (section 2) appears in the file **before** the `CREATE OR REPLACE FUNCTION current_tenant_id()` in section 3.
2. `user_active_tenant` has exactly one `GRANT` statement (`SELECT ... TO authenticated`) and no `GRANT INSERT`/`GRANT UPDATE`/`GRANT ALL` to `authenticated` anywhere in the file.
3. Every function in the file (`current_tenant_id`, `current_user_role`, `select_active_tenant`, `create_tenant`, `accept_pending_invitation`, `handle_new_user_invite`) has a `SET search_path` clause.
4. `create_tenant`, `accept_pending_invitation`, and `handle_new_user_invite` are otherwise byte-identical to their current live versions (quoted in this brief) except for the added `user_active_tenant` upsert — confirm by diffing against the "Consumes" signatures above; do not introduce unrelated changes to their existing logic.
5. `select_active_tenant` is the only new externally-callable entry point that writes to `user_active_tenant`, and it checks membership (`EXISTS (... tenant_users ...)`) before writing.

- [ ] **Step 3: Update CLAUDE.md's migration list**

Read `CLAUDE.md` around line 187 (the current final entry, `64. \`20260709_000063_fix_transfer_seat_null_comparison.sql\` — ...`). Add a new entry `65.` immediately after it, following the exact style of the preceding entries (one paragraph: what the migration does, root cause if it's a fix). Content:

```
65. `20260709_000064_active_tenant_selection.sql` — fixes a real "unable to create a new demo account" failure: `current_tenant_id()`/`current_user_role()` resolved a user's tenant via an unordered `LIMIT 1` over `tenant_users`, which is undefined for any user belonging to 2+ tenants — including `kits.tech.co@gmail.com`, auto-added to every tenant by `000021`'s trigger. Adds a `user_active_tenant` table (one row per user, upserted on tenant creation/selection/invite-acceptance) so "which tenant is this user on" is explicit and deterministic; rewrites both helper functions to join through it; adds `select_active_tenant()` RPC for the picker; backfills existing users in the same migration to avoid a deploy-time outage. Full design: `docs/superpowers/specs/2026-07-09-active-tenant-selection-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260709_000064_active_tenant_selection.sql CLAUDE.md
git commit -m "fix(db): give every user an explicit, deterministic active tenant

current_tenant_id()/current_user_role() picked an arbitrary tenant via
unordered LIMIT 1 for any user belonging to 2+ tenants — including the
platform admin account, auto-added to every tenant. This broke demo
tenant creation today and is a systemic RLS-resolution bug across
~197 policy references. Adds user_active_tenant (one row per user,
upserted on creation/selection/invite-acceptance) with a same-migration
backfill so the deploy itself causes no outage."
```

---

### Task 2: Frontend — call select_active_tenant when a user picks a tenant

**Files:**
- Modify: `src/utils/tenantManager.ts` (add `selectActiveTenant` helper)
- Modify: `src/pages/TenantSelection.tsx:141-148` (`handleSelectTenant`)
- Test: `src/pages/TenantSelection.test.tsx` (new file)

**Interfaces:**
- Consumes: `select_active_tenant(p_tenant_id uuid) RETURNS boolean` RPC from Task 1 (raises on a tenant the caller doesn't belong to).
- Produces: `selectActiveTenant(tenantId: string): Promise<boolean>` exported from `tenantManager.ts`, following the exact pattern of the other functions already in that file (local-mode short-circuit, `supabase.rpc`, throw on error).

- [ ] **Step 1: Write the failing test**

Create `src/pages/TenantSelection.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: vi.fn(),
    },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('../context/SubscriptionContext', () => ({
  useSubscription: () => ({ reloadSubscription: vi.fn() }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import TenantSelection from './TenantSelection';

function seedTwoTenants() {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1', email: 'admin@kits.test' } } },
  });
  const tenantsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
    then: undefined,
  };
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tenant_user_details') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              { tenant_id: 't1', tenant_name: 'Business One', tenant_slug: 'one', user_role: 'admin' },
              { tenant_id: 't2', tenant_name: 'Business Two', tenant_slug: 'two', user_role: 'admin' },
            ],
            error: null,
          }),
      };
    }
    // pending_invitations
    return { ...tenantsQuery, select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
  });
}

describe('TenantSelection handleSelectTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls select_active_tenant with the chosen tenant before navigating', async () => {
    seedTwoTenants();
    mockRpc.mockResolvedValue({ data: true, error: null });

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    const businessOne = await screen.findByText('Business One');
    await userEvent.click(businessOne);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('select_active_tenant', { p_tenant_id: 't1' });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error toast and does not navigate when the RPC fails', async () => {
    seedTwoTenants();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } });
    const toastSpy = vi.spyOn(toast, 'error');

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    const businessTwo = await screen.findByText('Business Two');
    await userEvent.click(businessTwo);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/TenantSelection.test.tsx`
Expected: FAIL — `selectActiveTenant`/RPC wiring doesn't exist yet in `handleSelectTenant`, so the first assertion (`mockRpc` called with `select_active_tenant`) is never satisfied.

- [ ] **Step 3: Add `selectActiveTenant` to `tenantManager.ts`**

In `src/utils/tenantManager.ts`, add this function immediately after `createTenant` (after line 39):

```ts
export async function selectActiveTenant(tenantId: string) {
  if (useLocalMode) return true;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('select_active_tenant', {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return data as unknown as boolean;
}
```

- [ ] **Step 4: Wire it into `TenantSelection.tsx`**

In `src/pages/TenantSelection.tsx`, update the import on line 9:

```ts
import { createTenant, selectActiveTenant } from '../utils/tenantManager';
```

Replace `handleSelectTenant` (lines 141-148):

```tsx
  const handleSelectTenant = async (tenant: Tenant) => {
    // Mark this tenant active server-side so current_tenant_id() (and every
    // RLS policy that depends on it) resolves correctly for users who
    // belong to more than one tenant.
    try {
      await selectActiveTenant(tenant.tenant_id);
    } catch {
      toast.error('Failed to switch business. Please try again.');
      return;
    }
    // The onboarding wizard only fires for tenants created in the current
    // session (via handleCreateTenant). Checking onboarding_completed here
    // caused an infinite loop for tenants where the flag was never set
    // (pre-migration-000019 bug).
    await reloadSubscription();
    void navigate('/dashboard');
  };
```

(This removes the `_tenant` unused-parameter prefix, since `tenant.tenant_id` is now used — update the one call site at line 203's `onClick={() => void handleSelectTenant(tenant)}` is unaffected, it already passes the tenant object.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/pages/TenantSelection.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/utils/tenantManager.ts src/pages/TenantSelection.tsx src/pages/TenantSelection.test.tsx
git commit -m "fix: call select_active_tenant when a user picks a tenant

Wires the picker in TenantSelection.tsx to the new select_active_tenant
RPC so switching tenants actually changes which tenant current_tenant_id()
resolves to server-side, not just the client-side route."
```
