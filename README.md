# KiTS Business Terminal

> Multi-tenant POS and business management platform for Lebanese/MENA SMBs.  
> React 18 · Vite · TypeScript (strict) · Tailwind CSS · Supabase · Vercel

---

## What This Is

A production-grade, white-label-ready business terminal covering the full operational stack: point of sale, inventory, customers, employees, reports, CRM, forecasting, and enterprise monitoring — all in one multi-tenant SaaS platform designed specifically for the Lebanese and MENA market.

Key differentiators:
- **Lebanese VAT (TVA 11%)** built-in with compliant receipt formatting
- **Dual currency** — USD + LBP display with configurable exchange rate
- **WhatsApp receipts** via Meta Cloud API (Lebanon WhatsApp penetration ≈ 100%)
- **Arabic RTL** full support across all pages
- **Loyalty points** — earn/redeem, Bronze/Silver/Gold tiers
- **Lebanese holiday calendar** baked into the forecasting engine

---

## Live Demo

**Production:** [kits-business.vercel.app](https://kits-business.vercel.app)  
**Support:** [WhatsApp +961 81 290 662](https://wa.me/96181290662) · kits.tech.co@gmail.com

---

## Quick Start

### Local (no Supabase needed)

```bash
npm install
# .env.local already sets VITE_USE_LOCAL_MODE=true
npm run dev        # → http://localhost:5173
```

Data lives in browser `localStorage`. No credentials needed. Use this for UI development.

### With Supabase

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

---

## Commands

```bash
npm run dev           # Dev server on http://localhost:5173
npm run typecheck     # TypeScript strict check — run before every edit
npm run lint          # ESLint, zero warnings
npm run lint:fix      # Auto-fix ESLint errors
npm run build         # Production build → build/
npm run verify        # typecheck + lint + build (full pre-commit gate)

npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E
npm run storybook     # Component explorer on :6006
```

---

## Database Setup

Run migrations in order in **Supabase Dashboard → SQL Editor**. All 27 migrations are in `supabase/migrations/` and must be applied in filename order (000000 → 000026).

See `CLAUDE.md` for the full ordered list with descriptions.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Production | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Production | Supabase anon key |
| `VITE_USE_LOCAL_MODE` | Dev only | `true` → skip Supabase, use localStorage |

**Supabase Function Secrets** (set in Dashboard → Functions → Secrets):

| Secret | Function | Description |
|---|---|---|
| `RESEND_API_KEY` | `welcome-email` | Transactional email |
| `WHATSAPP_TOKEN` | `whatsapp-receipt` | Meta Cloud API bearer token |
| `WHATSAPP_PHONE_ID` | `whatsapp-receipt` | Meta sender phone number ID |

---

## Subscription Tiers

| Feature | Starter (Free) | Growth ($29/mo) | Business ($79/mo) |
|---|---|---|---|
| Point of Sale | ✓ | ✓ | ✓ |
| Basic Reports | ✓ | ✓ | ✓ |
| Products limit | 50 | Unlimited | Unlimited |
| Customers limit | 100 | Unlimited | Unlimited |
| Employees limit | 1 | 10 | Unlimited |
| Advanced Analytics | | ✓ | ✓ |
| Forecasting | | ✓ | ✓ |
| CRM & Loyalty | | ✓ | ✓ |
| Inventory Management | | ✓ | ✓ |
| Enterprise Dashboard | | | ✓ |
| Monitoring | | | ✓ |
| API & Webhooks | | | ✓ |
| Multi-Location | | | ✓ |
| WhatsApp Receipts | | | ✓ |

---

## User Roles

8 standard roles: `owner` · `admin` · `supervisor` · `manager` · `accountant` · `stockkeeper` · `cashier` · `viewer`

Custom roles can be created per-tenant with granular permission sets. Role-based routing sends each role to their primary screen on login.

---

## Feature Overview

For complete feature documentation including data flow, key files, and developer notes:

→ **[FEATURES.md](./FEATURES.md)**

For the engineering roadmap, completed items, and active sprint:

→ **[NEXT_STEPS.md](./NEXT_STEPS.md)**

---

## Architecture

### Data Layer

All CRUD uses **direct PostgREST calls** via `supabase.from('table')`. No intermediary API layer. RLS handles all tenant isolation server-side.

```
Frontend → supabase.from('products').select() → PostgREST → RLS → PostgreSQL
```

RLS enforced by two SECURITY DEFINER functions: `current_tenant_id()` and `current_user_role()`.

### State Management

- **AppContext** (`src/context/AppContext.tsx`) — all domain data + CRUD functions
- **SubscriptionContext** (`src/context/SubscriptionContext.tsx`) — plan, role, `hasFeature()`, `canPerform()`
- **ThemeContext** (`src/context/ThemeContext.tsx`) — dark/light toggle
- **LanguageContext** — locale + RTL direction
- **TanStack Query** — server/async state via `QueryProvider`

### Provider Stack (outermost → innermost)

```
ErrorBoundary → ThemeProvider → Router → AppProvider → SubscriptionProvider
→ QueryProvider → LanguageProvider → TranslationProvider → AccessibilityProvider
```

### Path Alias

`@/` → `src/`. Use for all cross-directory imports.

### Build Output

`build/` (not `dist/`). Vite chunk splitting: vendor, radix, charts, i18n, export, dnd, router.

---

## Deployment

**Frontend** — Vercel auto-deploys on push to `main`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings.

**Edge Functions** — Deploy via Supabase CLI:
```bash
supabase functions deploy welcome-email --project-ref pytndxjeznhhyycjasep
supabase functions deploy send-invitation --project-ref pytndxjeznhhyycjasep
supabase functions deploy whatsapp-receipt --project-ref pytndxjeznhhyycjasep
```

**CI** — GitHub Actions (`.github/workflows/ci.yml`): typecheck + build on every push/PR.

**Supabase keep-alive** — `.github/workflows/keep-alive.yml` pings Supabase every 3 days to prevent free-tier auto-pause. Requires GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Setup Guides

- **WhatsApp Receipts** → `docs/setup-whatsapp-receipts.md`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript (strict mode + noUncheckedIndexedAccess) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Backend | Supabase (PostgreSQL + PostgREST + Auth + Storage + Edge Functions) |
| Charts | Recharts |
| i18n | react-i18next (EN, AR, FR, ES, ZH) |
| Export | ExcelJS + jsPDF (dynamic import) |
| Testing | Vitest + Testing Library + Playwright |
| CI/CD | GitHub Actions + Vercel |
| Hosting | Vercel (frontend) + Supabase (backend) |

---

## Built By

**KiTS — Khoder's IT Solutions**  
Tripoli, Lebanon · [kits.tech.co@gmail.com](mailto:kits.tech.co@gmail.com)
