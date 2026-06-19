# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**KiTS Business Terminal** — a multi-tenant POS + business management SPA built with React 18, Vite, TypeScript, Supabase, and Tailwind CSS. Designed for Lebanese/MENA SMB clients. Deployed on Vercel.

## Commands

```bash
npm run dev           # Dev server on http://localhost:5173
npm run typecheck     # Strict TS check (no emit) — run before every edit
npm run lint          # ESLint, zero warnings enforced
npm run lint:fix      # Auto-fix ESLint errors
npm run build         # Production build → build/
npm run verify        # typecheck + lint + build (full pre-commit check)

npm run test                  # Vitest unit tests
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Coverage report
npm run test:e2e              # Playwright E2E
npm run test:e2e:headed       # E2E with visible browser
npm run test:accessibility    # Accessibility spec only
npm run test:critical         # Critical paths spec only
npm run storybook             # Component dev server on :6006
```

Single file test: `npx vitest run src/utils/cart.test.ts`  
Single Playwright spec: `npx playwright test tests/e2e/auth.spec.ts`

## Local Development

`.env.local` sets `VITE_USE_LOCAL_MODE=true` → data routes through `src/utils/localStorageClient.ts` (browser localStorage mock). No Supabase credentials needed.

For Supabase: copy `.env.example` → `.env`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Architecture

### Data Layer

All application data uses **direct PostgREST calls** via `supabase.from('table')` — there is no intermediary Edge Function for CRUD. The `supabase` client is exported from `src/utils/supabaseClient.ts` and switches automatically between the real client and localStorage mock.

The Edge Function at `supabase/functions/make-server-210e7672/` exists in the repo but is **not wired to any active data flow**. The `api` object in `supabaseClient.ts` also exists but is unused by the application — do not add new calls to it.

**When adding any data operation**: use `supabase.from('table_name').select/insert/update/delete()` directly. RLS handles all tenant isolation server-side — no `tenant_id` filter is needed in queries.

### State Management

- **AppContext** (`src/context/AppContext.tsx`): products, sales, customers, employees, currentTenant, currentEmployee, loading + all CRUD functions. `loadData()` fires on auth change and tenant selection, queries all tables in parallel via `Promise.all`.
- **SubscriptionContext** (`src/context/SubscriptionContext.tsx`): plan (starter/growth/business), role (owner/manager/cashier/viewer), `hasFeature()`, `canPerform()`, `isWithinLimit()`.
- **Server/async state**: TanStack Query via `src/providers/QueryProvider.tsx`.
- **Auth**: Supabase `onAuthStateChange` in `App.tsx`.
- **Language/RTL**: `src/context/LanguageContext.tsx` + i18next.

### Multi-Tenancy / RLS

Every domain table has `tenant_id` referencing `tenants.id`. RLS is enforced by two SECURITY DEFINER functions:

- `current_tenant_id()` — returns the active tenant UUID for the session
- `current_user_role()` — returns 'owner' | 'manager' | 'cashier' | 'viewer' for the current user

All RLS policies use these functions. Frontend never filters by `tenant_id` — the database enforces it automatically.

Tenant membership: `tenant_users(tenant_id, user_id, role)`. The `get_current_user_tenant` RPC returns the user's tenant memberships including plan and role.

### Subscription / RBAC

- `src/types/subscription.ts` — canonical definitions for `SubscriptionPlan`, `Feature`, `RoleAction`, `PLAN_FEATURES`, `PLAN_LIMITS`, `ROLE_ACTIONS`
- `src/components/FeatureGate.tsx` — wraps any tier-gated section; shows lock UI + upgrade CTA when plan is insufficient
- `src/components/RoleGate.tsx` — wraps any role-gated action; renders nothing (or fallback) for insufficient roles
- `src/hooks/useFeature.ts` — `useFeature(feature)` → `{ available: boolean, requiredPlan }`

Tier matrix:
| Plan | Price | Limits | Features |
|---|---|---|---|
| starter | Free | 50 products, 100 customers, 1 employee | POS, basic reports |
| growth | $29/mo | 10 employees, unlimited products/customers | + analytics, CRM, forecasting, inventory |
| business | $79/mo | Unlimited | + enterprise, monitoring, API, multi-location |

Stripe integration is stubbed (`stripe_customer_id`, `stripe_subscription_id` on tenants) but not yet active.

### Onboarding

`src/components/OnboardingWizard.tsx` — 4-step full-screen wizard (Business Profile → First Product → Invite Team → Done). Triggered from `src/pages/TenantSelection.tsx` when `tenant.onboarding_completed = false`.

### Provider Stack (App.tsx, outermost first)

`ErrorBoundary` → `ThemeProvider` → `Router` → `AppProvider` → `SubscriptionProvider` → `QueryProvider` → `LanguageProvider` → `TranslationProvider` → `AccessibilityProvider`

### Routing

All pages (`src/pages/`) are lazy-loaded. Auth guard is in `App.tsx` via Supabase session check. Unauthenticated users redirect to `/login`. The `ProtectedRoute` component at `src/components/ProtectedRoute.tsx` is also available for route-level guards.

### Path Alias

`@/` → `src/`. Use for all cross-directory imports.

### Build Output

Output goes to `build/` (not `dist/`). Vite chunk splitting in `vite.config.ts`: vendor, radix, charts, i18n, export, dnd, router are separate chunks.

## Key Files

| File | Purpose |
|---|---|
| `src/context/AppContext.tsx` | All domain state + CRUD — the single source of truth for data |
| `src/utils/supabaseClient.ts` | Supabase client (mode switching between real and mock) |
| `src/types/subscription.ts` | Plan/tier/role canonical definitions |
| `src/context/SubscriptionContext.tsx` | Live subscription + role state |
| `src/components/FeatureGate.tsx` | Tier gate: wrap any feature requiring growth/business plan |
| `src/components/RoleGate.tsx` | Role gate: wrap any action requiring specific role |
| `src/components/OnboardingWizard.tsx` | First-time setup wizard |
| `src/pages/TenantSelection.tsx` | Post-login tenant flow + onboarding trigger |
| `src/constants/branding.ts` | Brand config: name, support WhatsApp, email, Instagram |
| `src/utils/formatting.ts` | Currency/date formatting — use for all display values |
| `src/utils/exportService.ts` | Excel/PDF export (ExcelJS + jsPDF) |
| `supabase/migrations/` | DB migrations — run in order in Supabase SQL Editor |

## Database Migrations

Run in this order in Supabase Dashboard → SQL Editor:

1. `20250617_000000_initial_schema.sql` — tenants, tenant_users, RLS functions, RPC helpers
2. `20250617_000001_views_and_functions.sql` — views and helper functions
3. `20250617_000002_auth_triggers.sql` — auto-applies pending invitations on first login
4. `20250617_000003_safe_domain_setup.sql` — all domain tables, RLS policies (safe to re-run)
5. `20260617_000004_onboarding.sql` — onboarding columns on tenants
6. `20260618_000005_subscription_tiers.sql` — subscription columns on tenants
7. `20260618_000006_activity_log.sql` — activity_log table with RLS (tenant-scoped audit trail)
8. `20260618_000007_stock_management.sql` — suppliers, purchase_orders, purchase_order_items, stock_transfers, stock_transfer_items
9. `20260618_000008_multi_location.sql` — locations, location_stock tables
10. `20260618_000009_fix_onboarding_completed.sql` — retroactive set onboarding_completed = true for pre-existing tenants
11. `20260618_000010_admin_functions.sql` — admin_list_tenants() and admin_set_tenant_plan() RPCs
12. `20260618_000011_invite_accept_rpc.sql` — accept_pending_invitation() RPC + pending_invitations status column
13. `20260618_000012_api_webhooks.sql` — api_keys, webhooks, webhook_deliveries tables
14. `20260618_000013_db_provisioning.sql` — db_provision_status and related fields on tenants; admin_provision_client() RPC
15. `20260618_000014_fix_admin_and_invite_rls.sql` — DROP+RECREATE admin_list_tenants (provisioning columns); pending_invitations SELECT RLS for invited users pre-tenant-context
16. `20260618_000015_fix_admin_list_ambiguous_id.sql` — Fix PL/pgSQL 42702 — alias auth.users → au to resolve ambiguous `id` OUT param
17. `20260618_000016_fix_admin_list_varchar_cast.sql` — Fix PostgreSQL 42804 — explicit ::TEXT casts on all string columns
18. `20260618_000017_fix_trigger_search_path.sql` — Fix signup 500: auth trigger `handle_new_user_invite` needs SET search_path = 'public'; Supabase auth context has restricted search_path that excludes public schema
19. `20260618_000018_tenants_profile_columns.sql` — Add country, currency, phone columns to tenants (required by OnboardingWizard step 1)
20. `20260618_000019_fix_onboarding_loop.sql` — Set onboarding_completed = true for all pre-existing tenants
21. `20260618_000020_get_tenant_with_plan.sql` — Extend get_current_user_tenant() with subscription_plan + subscription_status
22. `20260618_000021_roles_and_custom_roles.sql` — 8-role set (admin/supervisor/accountant/stockkeeper added); custom_roles table; kits admin auto-added to all tenants
23. `20260618_000022_admin_pin_verification.sql` — Initial pgcrypto verify_admin_pin (uses ALTER DATABASE — superseded by 000023)
24. `20260619_000023_admin_pin_config_table.sql` — Fix admin PIN: kits_admin_config table (ALTER DATABASE not available in Supabase SQL Editor); UPDATE the table to set your PIN hash
25. `20260619_000024_brand_identity.sql` — brand_logo_url, brand_primary, brand_secondary, brand_tagline on tenants; extends get_current_user_tenant()
26. `20260619_000025_loyalty.sql` — customer_points table; points_balance on customers; Bronze/Silver/Gold tier logic; earn/redeem triggers
27. `20260619_000026_crm.sql` — customer segments, communication history, CRM analytics helper views
28. `20260619_000027_campaigns.sql` — campaigns table (marketing campaigns CRUD); automated_workflows table (trigger-based automations)
29. `20260619_000028_finance.sql` — expense_categories (34 Lebanese system defaults seeded); expenses (USD/LBP dual-currency, VAT, receipt upload); expense_budgets; payroll_entries (NSSF 22.5%, EOS 8.5% accrual, transport allowance)

## Edge Functions

| Function | Trigger | Env Var Required |
|---|---|---|
| `welcome-email` | Called from TenantSelection after tenant creation | `RESEND_API_KEY` |
| `send-invitation` | Called from InviteTeamMemberModal | `RESEND_API_KEY` |
| `whatsapp-receipt` | Called from POS after sale (Business plan) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| `trigger-workflows` | Called from WorkflowAutomation "Run Now" | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |

Deploy all: `npx supabase functions deploy <function-name> --project-ref pytndxjeznhhyycjasep`

Set WhatsApp secrets: `npx supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... --project-ref pytndxjeznhhyycjasep`

## TypeScript

Strict mode + `noUncheckedIndexedAccess`. No `any` — use `unknown` and narrow. Lint enforces zero warnings. Always run `npm run typecheck` after edits.

## i18n / RTL

Translations in `src/i18n/locales/`. Arabic RTL styles in `src/styles/rtl.css`. All UI text uses `useTranslation()` from `react-i18next`. RTL support is partially complete — test at `dir="rtl"` before shipping UI changes.

## Testing

- Unit tests (`src/**/*.test.ts`): Vitest + jsdom + Testing Library. Auth mock utilities in `src/test-utils/mocks.ts`.
- E2E tests (`tests/e2e/*.spec.ts`): Playwright. See `docs/auth-mocking.md` for auth setup patterns.
- Storybook stories colocated with components (`src/components/**/*.stories.tsx`).
- Visual regression: `playwright.visual.config.ts`.

## Deployment

- **Frontend**: Vercel auto-deploys on push to `main`. No manual deploy step needed.
- **Database**: Run migrations manually in Supabase Dashboard → SQL Editor.
- **CI**: GitHub Actions `.github/workflows/ci.yml` — typecheck + build on every push/PR.
- **Keep-alive**: `.github/workflows/keep-alive.yml` — pings Supabase every 3 days to prevent free-tier auto-pause.
- **Required GitHub Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for keep-alive workflow)
- **Required Vercel Env Vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Required Supabase Function Secrets**: `RESEND_API_KEY` (Dashboard → Functions → Secrets)

## Dark Theme Standard

All UI uses dark navy. Never introduce light backgrounds. Standard classes:
- Backgrounds: `bg-slate-900`, `bg-slate-950`, `bg-white/5`, `bg-white/10`
- Text: `text-white`, `text-white/80`, `text-white/60`, `text-white/40`
- Borders: `border-white/10`, `border-white/20`
- Selects: `bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2`
- Primary button: `bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl`

## MENA / Lebanese Context

- Default currency: USD (also LBP)
- Default country: Lebanon
- Phone format: `+961 X XXX XXX`
- Support: WhatsApp `+961 81 290 662`, email `kits.tech.co@gmail.com`
