# KiTS Business Terminal

Multi-tenant POS and business management platform for Lebanese/MENA SMBs. Built with React 18, Vite, TypeScript, Supabase, and Tailwind CSS. Deployed on Vercel.

## Features

| Module | Status |
|---|---|
| Point of Sale (barcode search, cart, checkout, receipts) | Live |
| Inventory (CRUD, batch tracking, reorder points) | Live |
| Customers (CRUD, debt tracking, purchase history) | Live |
| Employees (CRUD, roles, commission rates) | Live |
| Reports (sales, profit, export to Excel/PDF) | Live |
| Dashboard (live stats) | Live |
| CRM (customer data, segmentation) | Partial — campaigns/automation coming soon |
| Enterprise dashboard + role management | Live (real data) |
| Monitoring (Web Vitals, health checks, error tracking) | Live |
| Stock transfers, supplier management, purchase orders | Coming soon |
| Stripe billing | Coming soon |
| Multi-location | Coming soon |

## Quick Start — Local Development (No Supabase)

```bash
npm install
cp .env.local .env   # sets VITE_USE_LOCAL_MODE=true
npm run dev          # http://localhost:5173
```

All data is stored in browser localStorage. No credentials needed. Suitable for development and demos.

## Quick Start — Supabase (Production)

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (prod) | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon/public key |
| `VITE_USE_LOCAL_MODE` | Dev only | Set `true` to skip Supabase entirely |
| `VITE_SENTRY_DSN` | Optional | Sentry error tracking |

## Database Setup

Run these migrations in order in **Supabase Dashboard → SQL Editor**:

1. `supabase/migrations/20250617_000000_initial_schema.sql`
2. `supabase/migrations/20250617_000001_views_and_functions.sql`
3. `supabase/migrations/20250617_000002_auth_triggers.sql`
4. `supabase/migrations/20250617_000003_safe_domain_setup.sql`
5. `supabase/migrations/20260617_000004_onboarding.sql`
6. `supabase/migrations/20260618_000005_subscription_tiers.sql`

Migration 3 is safe to re-run on any existing schema state.

## Verification

```bash
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint (zero warnings)
npm run build        # Production build → build/
npm run verify       # All three above
```

## Deployment

**Frontend** — Vercel auto-deploys on push to `main`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings.

**Database** — Supabase (manual migrations via SQL Editor, see above).

**CI** — GitHub Actions runs typecheck + build on every push and PR (`.github/workflows/ci.yml`).

**Supabase keep-alive** — A scheduled workflow pings Supabase every 3 days to prevent free-tier auto-pause (`.github/workflows/keep-alive.yml`). Requires GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Subscription Tiers

| Tier | Price | Products | Customers | Employees |
|---|---|---|---|---|
| Starter | Free | 50 | 100 | 1 |
| Growth | $29/mo | Unlimited | Unlimited | 10 |
| Business | $79/mo | Unlimited | Unlimited | Unlimited |

Growth adds: Advanced Analytics, Forecasting, CRM, Inventory Management.  
Business adds: Enterprise Dashboard, Monitoring, API/Webhooks, Multi-location.

## User Roles

| Role | POS | Edit Products | Manage Employees | Settings |
|---|---|---|---|---|
| Viewer | — | — | — | — |
| Cashier | ✓ | — | — | — |
| Manager | ✓ | ✓ | View only | — |
| Owner | ✓ | ✓ | ✓ | ✓ |

## Support

- WhatsApp: [+961 81 290 662](https://wa.me/96181290662)
- Email: kits.tech.co@gmail.com
- Built and maintained by **KiTS — Khoder's IT Solutions**, Tripoli, Lebanon
