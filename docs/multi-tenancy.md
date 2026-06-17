# Multi-Tenancy Architecture

## Model

Each business is a **tenant**. Users belong to one or more tenants with a specific role per tenant. All domain data is scoped by `tenant_id` and isolated via PostgreSQL Row-Level Security (RLS).

---

## Database Tables

### `tenants`
One row per business. Contains business metadata and subscription plan.

```sql
id UUID PRIMARY KEY
name TEXT           -- business display name
slug TEXT UNIQUE    -- URL-safe identifier
owner_user_id UUID  -- references auth.users
subscription_plan TEXT  -- 'starter' | 'growth' | 'business'
onboarding_completed BOOLEAN DEFAULT false
industry, phone, country, currency  -- business profile
stripe_customer_id, stripe_subscription_id  -- billing (future)
```

### `tenant_users`
Junction table — links a Supabase auth user to a tenant with a role.

```sql
tenant_id UUID → tenants
user_id UUID   → auth.users
role TEXT      -- 'owner' | 'manager' | 'cashier' | 'viewer'
```

### Domain tables
`products`, `customers`, `employees`, `sales`, `sale_items`, `inventory_movements` — all have `tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`.

---

## RLS Enforcement

Two SECURITY DEFINER functions handle all isolation:

```sql
current_tenant_id() RETURNS UUID
-- Returns the tenant the current session is scoped to.
-- Set by get_current_user_tenant RPC after tenant selection.

current_user_role() RETURNS TEXT
-- Returns 'owner' | 'manager' | 'cashier' | 'viewer' for the current user/tenant.
```

All RLS policies follow this pattern:

```sql
-- Read: anyone in the tenant can see the data
CREATE POLICY "view tenant products" ON products
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Write: restricted to roles that can modify
CREATE POLICY "staff manage products" ON products
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
  );
```

**Frontend implication**: Never add `.eq('tenant_id', ...)` to Supabase queries. The database filters automatically and exclusively based on the session's active tenant.

---

## Tenant Selection Flow

After login, `/tenant-selection`:
1. Calls `get_current_user_tenant` RPC → returns all tenant memberships for the user
2. If the user has tenants, shows them as cards
3. User clicks a tenant → sets the active tenant context → checks `onboarding_completed`
4. If no tenants → shows create-business form → calls `create_tenant` RPC

### `get_current_user_tenant` RPC
Returns array of:
```typescript
{
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  user_role: 'owner' | 'manager' | 'cashier' | 'viewer'
  subscription_plan: string
  onboarding_completed: boolean
  settings: Record<string, unknown>
}
```

### `create_tenant` RPC
```typescript
supabase.rpc('create_tenant', {
  tenant_name: string,
  tenant_slug: string,    // kebab-case, auto-generated from name
  owner_user_id: string,
  settings: {}
})
```

---

## Role-Based Access

| Role | Make sales | Edit products | View employees | Edit employees | Settings |
|---|---|---|---|---|---|
| viewer | — | — | — | — | — |
| cashier | ✓ | — | — | — | — |
| manager | ✓ | ✓ | ✓ | — | — |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ |

Role checks in the frontend use `RoleGate` from `src/components/RoleGate.tsx` and `canPerform()` from `SubscriptionContext`. Role checks in the backend use `current_user_role()` in RLS policies.

---

## Subscription Plans per Tenant

Each tenant has a `subscription_plan` column. The `SubscriptionContext` reads this and enforces feature access via `hasFeature()` and `isWithinLimit()`.

| Plan | Products | Customers | Employees |
|---|---|---|---|
| starter | 50 | 100 | 1 |
| growth | unlimited | unlimited | 10 |
| business | unlimited | unlimited | unlimited |

See `src/types/subscription.ts` for the full feature matrix.

---

## Onboarding

New tenants go through a 4-step onboarding wizard (`src/components/OnboardingWizard.tsx`) before reaching the dashboard:
1. Business profile (name, industry, country, currency, phone)
2. First product
3. First team member (skippable)
4. Done — sets `tenants.onboarding_completed = true`

Existing tenants with `onboarding_completed = false` are also shown the wizard on next login.

---

## Testing Isolation

To verify tenant isolation:
1. Sign up as `user1@example.com` → create Tenant A → add products
2. Sign up as `user2@example.com` → create Tenant B → add different products
3. User1 should see only Tenant A products; User2 only Tenant B

RLS enforces this at the database level — no frontend filter can bypass it.
