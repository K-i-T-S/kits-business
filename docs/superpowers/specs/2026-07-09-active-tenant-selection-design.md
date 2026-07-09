# Active Tenant Selection — Design Spec

**Date:** 2026-07-09
**Status:** Approved for planning

## Problem

`current_tenant_id()` and `current_user_role()` (`supabase/migrations/20250617_000000_initial_schema.sql:153-173`) — the two SQL functions that back nearly every RLS policy on the platform (197 references across the migration history) — are defined as:

```sql
SELECT tenant_id FROM tenant_users
WHERE user_id = auth.uid() AND is_active = true
LIMIT 1;
```

There is no `ORDER BY`. For any user who belongs to more than one tenant, which row this resolves to is undefined — Postgres may return any matching row, and the result is not guaranteed stable across calls. Nothing in the schema or frontend records "which tenant is this user currently operating as" — `TenantSelection.tsx`'s "Choose Your Business" picker only changes client-side navigation state; it never tells the database which tenant was selected.

### Confirmed real-world trigger

`kits.tech.co@gmail.com` (the KiTS admin account) is auto-added as `'admin'` to *every tenant on the platform* by a trigger in `supabase/migrations/20260618_000021_roles_and_custom_roles.sql:78-95`. This makes the admin account the platform's most heavily multi-tenant user — and therefore the one most likely to hit undefined `current_tenant_id()` resolution.

**Reproduced failure chain** (root-caused via static analysis, confirmed against user report on 2026-07-09):

1. Admin creates a new demo tenant. `create_tenant` RPC is `SECURITY DEFINER` and bypasses RLS, so tenant + owner row are created successfully.
2. `OnboardingWizard.tsx` Step 1 issues a plain client-side `supabase.from('tenants').update(...)`, gated by RLS policy `id = current_tenant_id() AND current_user_role() = 'owner'`. Since the admin belongs to dozens of tenants, `current_tenant_id()` very likely resolves to a different, older tenant — the update silently affects 0 rows (Supabase-js does not surface an error for a 0-row `UPDATE`), so the business profile step appears to succeed but never actually saves.
3. Step 2 inserts a product row, gated by `tenant_id = current_tenant_id()` on the `products` table's `FOR ALL` policy. If `current_tenant_id()` isn't the new tenant, this **throws a visible RLS error** ("new row violates row-level security policy for table products") — presenting to the user as "I can't create a new account."

### Severity beyond onboarding

Because the same two functions gate nearly every table's RLS, *any* user with 2+ active tenant memberships has an effectively undefined "which business am I operating on" for every RLS-scoped read and write on the platform — not just during onboarding. This is a credible root cause for other inconsistencies observed the same day, since they would all trace back to the same undefined resolution.

## Goals

- Every RLS-gated query resolves to a single, explicit, correct tenant for a multi-tenant user — not an arbitrary one.
- The tenant a user just created or just selected in the picker becomes their active tenant immediately, with no extra manual step.
- No outage at deploy time for any existing user, single- or multi-tenant.
- No use of Postgres session variables / `current_setting()` for this (already rejected in the codebase — see comment at `20250617_000000_initial_schema.sql:150-151`: they require an explicit call before every query and break with PostgREST's connection pooling).

## Non-goals

- Per-browser-tab / per-session active tenant (would require JWT custom claims and session refresh on every switch — a materially larger change). Accepted limitation, documented below.
- Rewriting the ~197 individual RLS policies that call `current_tenant_id()`/`current_user_role()` — they are unchanged; only the two helper functions' internals change.

## Design

### 1. New table: `user_active_tenant`

```sql
CREATE TABLE user_active_tenant (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_active_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own active tenant" ON user_active_tenant
  FOR ALL USING (user_id = auth.uid());
```

One row per user. Exactly one active tenant per user by construction — no ordering, no ties, no ambiguity.

### 2. Rewrite `current_tenant_id()` / `current_user_role()`

```sql
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
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
AS $$
    SELECT tu.role
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;
```

The `tu.is_active = true` join condition means a revoked membership correctly makes `current_tenant_id()` return `NULL` (no access) rather than silently falling back to a different tenant.

### 3. New RPC: `select_active_tenant(p_tenant_id uuid) RETURNS boolean`

```sql
CREATE OR REPLACE FUNCTION select_active_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
```

Called by the frontend whenever a user picks a tenant from `TenantSelection.tsx`.

### 4. `create_tenant` RPC change

After inserting the tenant and the owner's `tenant_users` row, also upsert `user_active_tenant` for the creator → the new tenant, in the same transaction:

```sql
INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
VALUES (owner_user_id, new_tenant_id, now())
ON CONFLICT (user_id) DO UPDATE SET tenant_id = new_tenant_id, updated_at = now();
```

This is what makes `OnboardingWizard` work immediately after tenant creation with no extra frontend round-trip — the tenant that was just created becomes active regardless of how many other tenants the creator belongs to.

### 5. Invite-acceptance paths (load-bearing, not optional)

Both places that add a row to `tenant_users` on behalf of an invited user must also upsert `user_active_tenant` for that user → the tenant they just joined:

- `handle_new_user_invite()` (auth trigger, `supabase/migrations/20260618_000017_fix_trigger_search_path.sql`) — fires when a user signs up with an email that has a pending invitation.
- `accept_pending_invitation()` RPC (`supabase/migrations/20260618_000012_invite_accept_rpc.sql`) — fires when an already-authenticated user accepts a new invitation to another tenant.

**This is required, not a nice-to-have.** Unlike the old `LIMIT 1` design, the new table has no accidental fallback: an invited user who joins `tenant_users` without a corresponding `user_active_tenant` upsert would have `current_tenant_id()` = `NULL` and hit a hard, silent lockout (every RLS-scoped read/write empty) on first login, with no picker step in their flow to self-correct (invite acceptance routes straight past `TenantSelection.tsx`).

### 6. Frontend wiring

`TenantSelection.tsx`'s `handleSelectTenant` calls `supabase.rpc('select_active_tenant', { p_tenant_id: tenant.tenant_id })` before `reloadSubscription()` and navigating to `/dashboard`. `handleCreateTenant` needs no frontend change — step 4 covers it server-side inside `create_tenant`.

### 7. Backfill migration (prevents the deploy itself from being an outage)

Before flipping `current_tenant_id()`/`current_user_role()` over, seed `user_active_tenant` for every existing user with at least one `tenant_users` row:

```sql
INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
SELECT DISTINCT ON (user_id) user_id, tenant_id, now()
FROM tenant_users
WHERE is_active = true
ORDER BY user_id, created_at ASC
ON CONFLICT (user_id) DO NOTHING;
```

- Single-tenant users: unambiguous, correct, permanent — this is their only tenant.
- Multi-tenant users (today, in practice, just the KiTS admin): earliest-created membership is an arbitrary but harmless starting point. The picker now actually works, so the very next tenant selection self-corrects it.

Must run in the same migration/transaction as the function rewrite, or immediately before it — a deploy that flips the functions without a prior backfill would `NULL`-lock every existing user.

## Data Flow Summary

| Scenario | Flow |
|---|---|
| New solo signup | Sign up → no tenant yet, `current_tenant_id()` = `NULL` (correct) → `create_tenant` → RPC upserts `user_active_tenant` → onboarding proceeds against the right tenant |
| Admin creating a demo tenant | Same as above — `create_tenant` unconditionally sets the *new* tenant active for the creator, regardless of existing memberships. Fixes the reported bug directly. |
| Switching tenants via the picker | Click → `select_active_tenant` RPC → upsert → navigate to `/dashboard` → subsequent queries resolve to the picked tenant |
| Accepting an invite | Trigger/RPC adds `tenant_users` row + upserts `user_active_tenant` in the same transaction → user lands on a working dashboard for the tenant just joined |

## Error Handling

- `select_active_tenant` on a tenant the caller isn't an active member of → `RAISE EXCEPTION 'permission_denied'`, surfaced as a toast error, no state change.
- Revoked membership while selected → `current_tenant_id()` returns `NULL`. `TenantSelection.tsx`'s tenant-list query (`tenant_user_details` filtered by `user_id`/`user_active`/`tenant_active`, not by `current_tenant_id()`) still renders correctly, so the user lands back at a working picker rather than a blank dashboard.

## Known Limitation (accepted)

Two browser tabs open on two different tenants for the same user share one `user_active_tenant` row — selecting a tenant in tab A silently affects tab B's next query too. This is the same constraint the codebase already documented for rejecting session-variable-based designs. A true per-tab fix needs per-session JWT claims and is out of scope here.

## Testing

- Backfill produces exactly one `user_active_tenant` row per pre-existing user with any `tenant_users` row; zero orphans; zero users left without a row who had at least one membership.
- `create_tenant` → immediately querying `current_tenant_id()` as that user returns the new tenant, even for a user who already belongs to other tenants.
- `select_active_tenant` on a foreign (non-member) tenant → raises `permission_denied`, no row change; on an own tenant → upserts and is immediately reflected in `current_tenant_id()`.
- Both invite-accept paths (trigger and RPC) → `current_tenant_id()` resolves to the joined tenant immediately after acceptance.
- Regression: an existing single-tenant user's `current_tenant_id()` is unchanged pre- and post-migration.
- Regression: revoking a membership (`tenant_users.is_active = false`) while it is the active tenant → `current_tenant_id()` returns `NULL`, not a stale/wrong tenant.
