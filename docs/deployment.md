# Deployment Guide

## Overview

| Layer | Platform | Trigger |
|---|---|---|
| Frontend | Vercel | Auto-deploy on push to `main` |
| Database | Supabase | Manual migration via SQL Editor |
| Edge Functions | Supabase | Manual deploy via Supabase CLI |
| CI checks | GitHub Actions | Every push and PR to `main` |
| DB keep-alive | GitHub Actions (cron) | Every 3 days, 06:00 UTC |

---

## Frontend — Vercel

1. Connect the GitHub repo to a Vercel project (one-time setup).
2. Set these environment variables in Vercel project settings:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

3. Every push to `main` triggers an automatic deploy. No manual steps.

Build output directory is `build/` (configured in `vite.config.ts`). Vercel detects this automatically via `vercel.json`.

---

## Database — Supabase Migrations

Run migrations **in order** via **Supabase Dashboard → SQL Editor**. All 29 migrations are in `supabase/migrations/`. Do not skip or reorder.

| Order | File | Notes |
|---|---|---|
| 1 | `20250617_000000_initial_schema.sql` | tenants, tenant_users, current_tenant_id(), current_user_role(), get_current_user_tenant RPC |
| 2 | `20250617_000001_views_and_functions.sql` | Helper views and aggregate functions |
| 3 | `20250617_000002_auth_triggers.sql` | Auth trigger — auto-applies pending invitations on first login |
| 4 | `20250617_000003_safe_domain_setup.sql` | **Safe to re-run** — all domain tables, RLS policies, indexes |
| 5 | `20260617_000004_onboarding.sql` | Onboarding columns on tenants |
| 6 | `20260618_000005_subscription_tiers.sql` | Subscription + billing columns on tenants |
| 7 | `20260618_000006_activity_log.sql` | activity_log table with RLS (tenant-scoped audit trail) |
| 8 | `20260618_000007_stock_management.sql` | suppliers, purchase_orders, purchase_order_items, stock_transfers, stock_transfer_items |
| 9 | `20260618_000008_multi_location.sql` | locations, location_stock tables |
| 10 | `20260618_000009_fix_onboarding_completed.sql` | Retroactive set onboarding_completed = true for pre-existing tenants |
| 11 | `20260618_000010_admin_functions.sql` | admin_list_tenants() and admin_set_tenant_plan() RPCs |
| 12 | `20260618_000011_invite_accept_rpc.sql` | accept_pending_invitation() RPC + pending_invitations status column |
| 13 | `20260618_000012_api_webhooks.sql` | api_keys, webhooks, webhook_deliveries tables |
| 14 | `20260618_000013_db_provisioning.sql` | db_provision_status and provisioning fields on tenants; admin_provision_client() RPC |
| 15 | `20260618_000014_fix_admin_and_invite_rls.sql` | Fix admin_list_tenants (provisioning columns); pending_invitations RLS for pre-tenant invited users |
| 16 | `20260618_000015_fix_admin_list_ambiguous_id.sql` | Fix PL/pgSQL 42702 — alias auth.users → au |
| 17 | `20260618_000016_fix_admin_list_varchar_cast.sql` | Fix PostgreSQL 42804 — explicit ::TEXT casts |
| 18 | `20260618_000017_fix_trigger_search_path.sql` | Fix signup 500: auth trigger needs SET search_path = 'public' |
| 19 | `20260618_000018_tenants_profile_columns.sql` | Add country, currency, phone to tenants |
| 20 | `20260618_000019_fix_onboarding_loop.sql` | Set onboarding_completed = true for all pre-existing tenants |
| 21 | `20260618_000020_get_tenant_with_plan.sql` | Extend get_current_user_tenant() with subscription_plan + subscription_status |
| 22 | `20260618_000021_roles_and_custom_roles.sql` | 8-role set; custom_roles table; kits admin auto-added to all tenants |
| 23 | `20260618_000022_admin_pin_verification.sql` | pgcrypto verify_admin_pin (superseded by 000023) |
| 24 | `20260619_000023_admin_pin_config_table.sql` | kits_admin_config table for admin PIN hash storage |
| 25 | `20260619_000024_brand_identity.sql` | brand_logo_url, brand_primary, brand_secondary, brand_tagline on tenants |
| 26 | `20260619_000025_loyalty.sql` | customer_points table; points_balance on customers; Bronze/Silver/Gold tier logic |
| 27 | `20260619_000026_crm.sql` | Customer segments, communication history, CRM analytics helpers |
| 28 | `20260619_000027_campaigns.sql` | campaigns and automated_workflows tables |
| 29 | `20260619_000028_finance.sql` | expense_categories (34 Lebanese defaults), expenses, expense_budgets, payroll_entries |

If you need to reset to a clean state, run migration 4 (`000003`) again — it drops and recreates all domain-table RLS policies safely.

---

## Edge Functions — Supabase

Project ref: `pytndxjeznhhyycjasep`

### Deploy

```bash
# Deploy all functions
npx supabase functions deploy welcome-email --project-ref pytndxjeznhhyycjasep
npx supabase functions deploy send-invitation --project-ref pytndxjeznhhyycjasep
npx supabase functions deploy whatsapp-receipt --project-ref pytndxjeznhhyycjasep
npx supabase functions deploy trigger-workflows --project-ref pytndxjeznhhyycjasep
```

### Set Secrets

```bash
# Email (Resend)
npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref pytndxjeznhhyycjasep

# WhatsApp (Meta Cloud API)
npx supabase secrets set WHATSAPP_TOKEN=EAAxxxx --project-ref pytndxjeznhhyycjasep
npx supabase secrets set WHATSAPP_PHONE_ID=1234567890 --project-ref pytndxjeznhhyycjasep
```

Secrets can also be set via Dashboard → Functions → Secrets.

### Function Reference

| Function | Source | Trigger | Required Secrets |
|---|---|---|---|
| `welcome-email` | `supabase/functions/welcome-email/` | TenantSelection after tenant creation | `RESEND_API_KEY` |
| `send-invitation` | `supabase/functions/send-invitation/` | InviteTeamMemberModal | `RESEND_API_KEY` |
| `whatsapp-receipt` | `supabase/functions/whatsapp-receipt/` | POS WhatsApp button (Business plan) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| `trigger-workflows` | `supabase/functions/trigger-workflows/` | WorkflowAutomation "Run Now" | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |

See `docs/setup-whatsapp-receipts.md` for the full WhatsApp setup guide.

### Storage Buckets

Two buckets must be created in **Supabase Dashboard → Storage**:

| Bucket | Access | Used By |
|---|---|---|
| `expense-receipts` | Private (authenticated) | Finance → Expenses (receipt upload) |
| `avatars` | Private (authenticated) | ProfileSettings (avatar upload) |

---

## CI — GitHub Actions

File: `.github/workflows/ci.yml`

Runs on every push and pull request to `main`:
1. `npm ci` — install dependencies
2. `npm run typecheck` — TypeScript strict check
3. `npm run build` (with `VITE_USE_LOCAL_MODE=true`) — production build without Supabase

Vercel handles the actual deployment natively via its GitHub integration. The CI workflow is for quality gates only.

---

## Supabase Keep-Alive

File: `.github/workflows/keep-alive.yml`

Supabase free-tier projects pause after 7 days of inactivity. This workflow pings the project every 3 days to prevent that.

**Required GitHub repository secrets:**

| Secret | Value |
|---|---|
| `SUPABASE_URL` | `https://pytndxjeznhhyycjasep.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Add via: GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

---

## Post-Deploy Verification

After Vercel finishes deploying:

1. Visit production URL and sign in
2. Confirm dashboard loads with real data (not empty)
3. Run a test sale on the POS
4. Check Supabase Dashboard → Table Editor → `sales` to confirm the sale was recorded
5. Verify Finance page loads and expense categories are seeded (29 categories expected)

---

## Rollback

Vercel maintains a deployment history:
- Dashboard → Deployments → select a previous deployment → "Promote to Production"

Database rollbacks are manual — Supabase does not auto-snapshot. Export data before running destructive migrations.
