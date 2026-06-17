# All-in-One Business Terminal

Modern POS + business terminal built with React 18, Vite, TypeScript, Supabase, Hono, Radix UI, and Tailwind utilities.

## Requirements

- Node.js 20+
- npm 10+
- Supabase project with:
  - Edge Functions enabled
  - Table `kv_store_210e7672` (columns: `key` text PK, `value` jsonb)
  - Environment variables:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - For Edge Function deploys: `SUPABASE_SERVICE_ROLE_KEY`

## Install & Local Development

### Option 1: Local Development (No Supabase Required)

For development and testing without setting up Supabase:

```bash
npm install
cp .env.local .env
npm run dev         # Vite dev server on http://localhost:5173
```

This uses local browser storage to mimic Supabase functionality. Perfect for development, testing, and demos.

### Option 2: Docker Local Development

Using Docker for containerized local development:

```bash
docker-compose up
```

The app will be available at http://localhost:5173

### Option 3: Supabase Production Mode

For production with Supabase backend:

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev         # Vite dev server on http://localhost:5173
```

## Verification Pipeline

```bash
npm run typecheck   # Strict TS validation
npm run build       # Production build (vite)
npm run verify      # Runs typecheck + build
```

## Supabase Edge Function

Source: `supabase/functions/make-server-210e7672`

Deploy:

```bash
cd supabase/functions/make-server-210e7672
npx supabase functions deploy make-server-210e7672 --project-ref <YOUR_PROJECT_ID>
```

> **Tip:** Use `--debug` if Supabase CLI reports missing entrypoint paths. Ensure you run the command from this directory so the CLI finds `index.ts`.

### Supabase Schema & Ops Notes

**Environment**

Copy `.env.example` → `.env` and fill in:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> # only for CLI deploys
```

**KV Table (stores products/sales/customers/employees)**

```sql
create table if not exists kv_store_210e7672 (
  key text primary key,
  value jsonb not null,
  inserted_at timestamptz default now()
);

create index if not exists kv_store_210e7672_key_prefix_idx
  on kv_store_210e7672 (key text_pattern_ops);
```

**Operational Runbook**

1. `npm run verify` – ensures frontend typechecks & builds.
2. `cd supabase/functions/make-server-210e7672`
3. `npx supabase functions deploy make-server-210e7672 --project-ref <PROJECT_REF>`
4. Monitor the deployment at `https://supabase.com/dashboard/project/<PROJECT_REF>/functions`.

## Running End-to-End

1. Set `.env` (or `.env.local`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Deploy the Edge Function (see above).
3. Start the frontend: `npm run dev`.
4. Log in or sign up via the UI, then use Dashboard / POS / Reports pages.