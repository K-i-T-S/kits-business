# Multi-Tenancy Architecture

## Model

Each business is a **tenant**. Users belong to one or more tenants with a specific role per tenant. All domain data is scoped by `tenant_id` and isolated via PostgreSQL Row-Level Security (RLS).

---

## Database Tables

### `tenants`
One row per business. Contains business metadata, subscription plan, and brand configuration.

```sql
id UUID PRIMARY KEY
name TEXT              -- business display name
slug TEXT UNIQUE       -- URL-safe identifier
owner_user_id UUID     -- references auth.users
subscription_plan TEXT -- 'starter' | 'growth' | 'business' DEFAULT 'starter'
subscription_status TEXT -- 'active' | 'trialing' | 'past_due' | 'canceled'
onboarding_completed BOOLEAN DEFAULT false
onboarding_step INTEGER DEFAULT 0
industry TEXT
phone TEXT
country TEXT DEFAULT 'Lebanon'
currency TEXT DEFAULT 'USD'
exchange_rate NUMERIC DEFAULT 89500  -- LBP per USD
trial_ends_at TIMESTAMPTZ
stripe_customer_id TEXT
stripe_subscription_id TEXT
brand_logo_url TEXT
brand_primary TEXT DEFAULT '#6366f1'
brand_secondary TEXT DEFAULT '#38bdf8'
brand_tagline TEXT
db_provision_status TEXT -- 'pending' | 'provisioned'
```

### `tenant_users`
Junction table — links a Supabase auth user to a tenant with a role.

```sql
tenant_id UUID → tenants
user_id UUID   → auth.users
role TEXT      -- see role set below
```

### `custom_roles`
Tenant-defined roles with granular permission sets.

```sql
id UUID PRIMARY KEY
tenant_id UUID → tenants
name TEXT
permissions JSONB  -- { make_sale, edit_products, view_reports, ... }
is_active BOOLEAN
```

### Domain tables
All have `tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`:

`products`, `customers`, `employees`, `sales`, `sale_items`, `inventory_movements`, `suppliers`, `purchase_orders`, `purchase_order_items`, `stock_transfers`, `stock_transfer_items`, `locations`, `location_stock`, `activity_log`, `api_keys`, `webhooks`, `webhook_deliveries`, `customer_points`, `campaigns`, `automated_workflows`, `expense_categories`, `expenses`, `expense_budgets`, `payroll_entries`

---

## RLS Enforcement

Two SECURITY DEFINER functions handle all isolation:

```sql
current_tenant_id() RETURNS UUID
-- Returns the tenant the current session is scoped to.
-- Set by get_current_user_tenant RPC after tenant selection.

current_user_role() RETURNS TEXT
-- Returns the active role for the current user/tenant.
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
    AND current_user_role() IN ('owner', 'admin', 'supervisor', 'manager')
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
  user_role: string
  subscription_plan: 'starter' | 'growth' | 'business'
  subscription_status: string
  onboarding_completed: boolean
  exchange_rate: number
  brand_primary: string
  brand_secondary: string
  brand_logo_url: string | null
  brand_tagline: string | null
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

8 standard roles (set in `tenant_users.role`):

| Role | Make sales | Edit products/inventory | View reports/finance | Edit employees | Settings |
|---|---|---|---|---|---|
| `viewer` | — | — | — | — | — |
| `cashier` | ✓ | — | — | — | — |
| `stockkeeper` | — | ✓ (inventory only) | — | — | — |
| `accountant` | — | — | ✓ (finance/reports) | — | — |
| `manager` | ✓ | ✓ | ✓ | — | — |
| `supervisor` | ✓ | ✓ | ✓ | ✓ | — |
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `owner` | ✓ | ✓ | ✓ | ✓ | ✓ |

Custom roles can be created per-tenant via `custom_roles` table (Enterprise plan).

Role checks in the frontend:
- `RoleGate` (`src/components/RoleGate.tsx`) — renders nothing for insufficient roles
- `canPerform()` from `SubscriptionContext` — programmatic check

Role checks in the backend use `current_user_role()` in RLS policies.

---

## Subscription Plans per Tenant

Each tenant has a `subscription_plan` column. The `SubscriptionContext` reads this and enforces feature access via `hasFeature()` and `isWithinLimit()`.

| Plan | Price | Products | Customers | Employees | Key Features |
|---|---|---|---|---|---|
| `starter` | Free | 50 | 100 | 1 | POS, basic reports |
| `growth` | $29/mo | Unlimited | Unlimited | 10 | + analytics, forecasting, CRM, inventory |
| `business` | $79/mo | Unlimited | Unlimited | Unlimited | + enterprise, monitoring, API, multi-location, WhatsApp |

See `src/types/subscription.ts` for the complete feature matrix.

---

## Invitations

Users are invited via the `pending_invitations` table. On first login, the `handle_new_user_invite` auth trigger (migration 000002) auto-applies any pending invitations for the user's email, inserting the appropriate `tenant_users` row.

- `accept_pending_invitation()` RPC also available for manual acceptance
- Auth trigger requires `SET search_path = 'public'` (migration 000017 fix)

---

## Onboarding

New tenants go through a 4-step wizard (`src/components/OnboardingWizard.tsx`) before reaching the dashboard:
1. Business profile (name, industry, country, currency, phone)
2. First product
3. First team member (skippable)
4. Done — sets `tenants.onboarding_completed = true`

Pre-existing tenants have `onboarding_completed = true` set retroactively via migrations 000009 and 000019.

---

## Brand Identity

Each tenant can customize their brand via `src/components/BrandIdentityModal.tsx`:
- Logo URL (external CDN or uploaded)
- Primary color → `--brand-primary` CSS custom property
- Secondary color → `--brand-secondary`
- Tagline

All buttons use `.btn-brand` CSS class, which references these variables. Colors propagate instantly across the UI on tenant switch.

---

## Testing Isolation

To verify tenant isolation:
1. Sign up as `user1@example.com` → create Tenant A → add products
2. Sign up as `user2@example.com` → create Tenant B → add different products
3. User1 should see only Tenant A products; User2 only Tenant B

RLS enforces this at the database level — no frontend filter can bypass it.
