# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

All-in-One Business Terminal — a multi-tenant POS + business management SPA built with React 18, Vite, TypeScript, Supabase, and Tailwind CSS 4. Designed for Lebanese/MENA SMB clients.

## Commands

```bash
npm run dev           # Dev server on http://localhost:3000
npm run typecheck     # Strict TS (no emit)
npm run lint          # ESLint, zero warnings allowed
npm run lint:fix      # Auto-fix ESLint errors
npm run build         # Production build → build/
npm run verify        # typecheck + lint + build (run before every PR)

npm run test                  # Vitest unit tests (run once)
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Coverage report (90% threshold enforced)
npm run test:e2e              # Playwright E2E
npm run test:e2e:headed       # E2E with visible browser
npm run test:e2e:ui           # Playwright UI mode
npm run test:accessibility    # Accessibility spec only
npm run test:critical         # Critical paths spec only

npm run storybook             # Component dev server on :6006
```

To run a single Vitest test file:
```bash
npx vitest run src/utils/cart.test.ts
```

To run a single Playwright spec:
```bash
npx playwright test tests/e2e/auth.spec.ts
```

## Local Development (No Supabase)

`.env.local` sets `VITE_USE_LOCAL_MODE=true`. This routes all data through `src/utils/localStorageClient.ts` (browser localStorage) instead of Supabase. Use this for development and testing — no credentials required.

For production Supabase: copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Architecture

### Data Layer

All backend calls go through `src/utils/supabaseClient.ts`, which exports:
- `supabase` — auth client (switches to localStorage mock in local mode)
- `api` — typed fetch wrapper to the Supabase Edge Function (`make-server-210e7672`)

In production, all application data lives in a single `kv_store_210e7672` table (key-value with JSONB). The Edge Function (`supabase/functions/make-server-210e7672/`, built with Hono) handles routing.

Never call fetch or Supabase directly from components — always use `api` or the hooks in `src/hooks/useApi.ts`.

### State Management

- **Global app state** (`AppContext`): Products, Sales, Customers, Employees — loaded once, kept in React Context (`src/context/AppContext.tsx`). Core domain types (`Product`, `Sale`, `Customer`, `Employee`, etc.) are defined there.
- **Server/async state**: TanStack Query via `src/providers/QueryProvider.tsx`.
- **Auth**: Supabase `onAuthStateChange` in `App.tsx`, auth state passed as props.
- **Language/RTL**: `src/context/LanguageContext.tsx` + `src/context/TranslationContext.tsx` + i18next (`src/i18n/`).

### Multi-Tenancy

Tenant selection happens at `/tenant-selection` after login. `src/utils/tenantManager.ts` handles tenant CRUD via Supabase RPC. RLS policies enforce data isolation. See `supabase/migrations/` and `docs/multi-tenancy.md`.

### Provider Stack (App.tsx order, outermost first)

`ErrorBoundary` → `Router` → `AppProvider` → `QueryProvider` → `LanguageProvider` → `TranslationProvider` → `AccessibilityProvider`

### Routing

All pages (`src/pages/`) are lazy-loaded. Route guard is inline in `App.tsx` — unauthenticated users are redirected to `/login`. There is no separate `ProtectedRoute` wrapper being used in main routes (despite the component existing).

### Path Alias

`@/` resolves to `src/`. Use it for all imports within `src/`.

### Build Output

Output goes to `build/` (not `dist/`). Chunk splitting is configured in `vite.config.ts` — vendor, radix, charts, i18n, export, etc. are separate chunks.

## Key Utilities

| File | Purpose |
|------|---------|
| `src/utils/supabaseClient.ts` | Single entry point for all API/auth calls |
| `src/utils/localStorageClient.ts` | Supabase mock for local dev |
| `src/utils/tenantManager.ts` | Tenant CRUD (requires service role key) |
| `src/utils/dataValidation.ts` | Input validation with `DataValidator` class |
| `src/utils/raceConditionPrevention.ts` | `OperationQueue`, `StockUpdateLock`, `ConcurrentOperationGuard` |
| `src/utils/optimisticUpdates.ts` | Optimistic update hooks for products/stock |
| `src/utils/auditLogger.ts` | Security audit trail |
| `src/utils/securityHeaders.ts` | Vite plugin that adds security headers in dev |
| `src/utils/formatting.ts` | Currency, dates — use for any display formatting |
| `src/utils/exportService.ts` | Excel/PDF export (ExcelJS + jsPDF) |

## i18n / RTL

Translations live in `src/i18n/locales/`. Arabic RTL styles are in `src/styles/rtl.css` (imported globally in `App.tsx`). All UI text must use `useTranslation()` from `react-i18next`. Test RTL at `dir="rtl"` before shipping any UI change.

## TypeScript

Strict mode + `noUncheckedIndexedAccess`. No `any` — use `unknown` and narrow. Lint enforces zero warnings. Run `npm run verify` before every commit.

## Testing Approach

- Unit tests (`src/**/*.test.ts`) use Vitest + jsdom + Testing Library. 90% coverage threshold enforced.
- E2E tests (`tests/e2e/*.spec.ts`) use Playwright. Auth setup via `tests/e2e/auth.setup.ts`.
- Storybook stories colocated with components (`src/components/**/*.stories.tsx`). Visual regression via `playwright.visual.config.ts`.
- E2E tests use auth mocking — see `docs/auth-mocking.md` before writing new E2E tests.

## Deployment

- Frontend: Vercel (`vercel.json`). Staging config in `vercel.staging.json`.
- Edge Functions: deploy via `npx supabase functions deploy make-server-210e7672 --project-ref <REF>` from `supabase/functions/make-server-210e7672/`.
- CI/CD: GitHub Actions in `.github/workflows/`.
- Blue-green deploy script: `scripts/blue-green-deploy.sh`.
