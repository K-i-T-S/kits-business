# Deployment Guide

## Overview

| Layer | Platform | Trigger |
|---|---|---|
| Frontend | Vercel | Auto-deploy on push to `main` |
| Database | Supabase | Manual migration via SQL Editor |
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

Run migrations in order via **Supabase Dashboard → SQL Editor**. Each migration is idempotent where noted.

| Order | File | Notes |
|---|---|---|
| 1 | `20250617_000000_initial_schema.sql` | tenants, tenant_users, RLS functions, RPCs |
| 2 | `20250617_000001_views_and_functions.sql` | Helper views |
| 3 | `20250617_000002_auth_triggers.sql` | Auto-applies invitations on first login |
| 4 | `20250617_000003_safe_domain_setup.sql` | **Safe to re-run** — all domain tables, RLS policies |
| 5 | `20260617_000004_onboarding.sql` | Onboarding columns on tenants |
| 6 | `20260618_000005_subscription_tiers.sql` | Subscription + billing columns on tenants |

If you need to reset to a clean state, run migration 4 (`000003`) again — it drops and recreates all RLS policies safely.

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
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Add via: GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

You can also trigger the workflow manually from GitHub Actions → "Supabase Keep-Alive" → Run workflow.

---

## Verifying a Deploy

After Vercel finishes deploying:

1. Visit the production URL and sign in
2. Confirm the dashboard loads with real data (not empty)
3. Run a test sale on the POS
4. Check Supabase Dashboard → Table Editor to confirm the sale was recorded

---

## Rollback

Vercel maintains a deployment history. To roll back:
- Vercel Dashboard → Deployments → select a previous deployment → "Promote to Production"

Database rollbacks are manual — Supabase does not auto-snapshot. Export data before running destructive migrations.
