# Phase 2 Manual Setup Guide

Complete this checklist to activate all Phase 2 AI Layer features.

## Quick Start (5 steps)

1. **Push DB migration:**
   ```bash
   cd supabase && supabase db push
   ```

2. **Set API keys** (get from Anthropic Console + Supabase Dashboard):
   ```bash
   # Local dev
   echo 'VITE_ANTHROPIC_API_KEY=sk-ant-YOUR_KEY' >> .env.local
   
   # Vercel: go to Project Settings → Environment Variables
   # Set: VITE_ANTHROPIC_API_KEY = sk-ant-YOUR_KEY
   
   # Supabase secrets
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY --project-ref pytndxjeznhhyycjasep
   ```

3. **Deploy Edge Functions:**
   ```bash
   npx supabase functions deploy restaurant-ai-assistant --project-ref pytndxjeznhhyycjasep
   npx supabase functions deploy restaurant-demand-forecast --project-ref pytndxjeznhhyycjasep
   npx supabase functions deploy restaurant-upsell-compute --project-ref pytndxjeznhhyycjasep
   npx supabase functions deploy restaurant-menu-engineering --project-ref pytndxjeznhhyycjasep
   ```

4. **Verify deployments:**
   - Supabase Dashboard → Edge Functions → check all 4 functions listed

5. **Test endpoints:**
   ```bash
   curl -X POST \
     https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-ai-assistant \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"YOUR_TENANT_ID","question":"How did we do today?","language":"en"}'
   ```

---

## Detailed Steps

### 1. Database Migration

**File:** `supabase/migrations/20260622_000047_restaurant_ai.sql`

Creates 4 new tables:
- `restaurant_ai_queries` — chat history
- `restaurant_demand_forecasts` — 7-day predictions
- `restaurant_upsell_rules` — association rules
- `restaurant_menu_engineering_cache` — BCG classifications

**Run:**
```bash
cd supabase
supabase db push
```

---

### 2. Anthropic API Key Setup

Get key from: https://console.anthropic.com/

#### Local Development
Create `.env.local` (not committed):
```
VITE_ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

#### Vercel Production
1. Go to: Vercel Dashboard → Project Settings → Environment Variables
2. Add new variable:
   - Name: `VITE_ANTHROPIC_API_KEY`
   - Value: `sk-ant-YOUR_KEY_HERE`
   - Environments: Production, Preview, Development

#### Supabase Edge Functions
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE --project-ref pytndxjeznhhyycjasep
```

---

### 3. Deploy Edge Functions

All function files are in `supabase/functions/`

```bash
# AI Assistant (Claude Sonnet with function calling)
npx supabase functions deploy restaurant-ai-assistant --project-ref pytndxjeznhhyycjasep

# Demand Forecast (7-day ML predictions)
npx supabase functions deploy restaurant-demand-forecast --project-ref pytndxjeznhhyycjasep

# Upsell Compute (association rules)
npx supabase functions deploy restaurant-upsell-compute --project-ref pytndxjeznhhyycjasep

# Menu Engineering (BCG matrix)
npx supabase functions deploy restaurant-menu-engineering --project-ref pytndxjeznhhyycjasep
```

**Verify:**
- Supabase Dashboard → Edge Functions → all 4 should be listed and "Active"

---

### 4. Schedule Nightly Cron Jobs (Optional)

These jobs compute forecasts/upsells every night. Optional but recommended.

#### Option A: Supabase Dashboard (Manual)

1. Go to: Supabase Dashboard → SQL Editor
2. Run these queries:

```sql
-- Schedule demand forecast for 2am daily
SELECT cron.schedule(
  'restaurant-forecast-nightly',
  '0 2 * * *',
  $$SELECT net.http_post(
    url:='https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-demand-forecast',
    headers:='{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id$$
);

-- Schedule upsell compute for 3am daily
SELECT cron.schedule(
  'restaurant-upsell-nightly',
  '0 3 * * *',
  $$SELECT net.http_post(
    url:='https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-upsell-compute',
    headers:='{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id$$
);

-- Schedule menu engineering for 3:30am daily
SELECT cron.schedule(
  'restaurant-menu-engineering-nightly',
  '30 3 * * *',
  $$SELECT net.http_post(
    url:='https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-menu-engineering',
    headers:='{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id$$
);
```

Replace `YOUR_SERVICE_ROLE_KEY` with your Supabase Service Role key (from Supabase Dashboard → Project Settings → API).

#### Option B: GitHub Actions (Automatic)

Create `.github/workflows/restaurant-cron.yml`:

```yaml
name: Restaurant Nightly AI Jobs

on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC

jobs:
  forecast:
    runs-on: ubuntu-latest
    steps:
      - name: Run demand forecast
        run: |
          curl -X POST \
            https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-demand-forecast \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"

  upsells:
    runs-on: ubuntu-latest
    steps:
      - name: Run upsell compute
        run: |
          curl -X POST \
            https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-upsell-compute \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"

  menu_engineering:
    runs-on: ubuntu-latest
    steps:
      - name: Run menu engineering
        run: |
          curl -X POST \
            https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-menu-engineering \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub Secrets (Repo Settings → Secrets → New repository secret).

---

### 5. Test Each Function

After deployment, test each endpoint:

```bash
# Get keys from Supabase Dashboard → Project Settings → API
ANON_KEY="your-anon-key"
TENANT_ID="your-tenant-uuid"

# Test AI Assistant
curl -X POST \
  https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-ai-assistant \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"question\":\"How did we do today?\",\"language\":\"en\"}"

# Test Demand Forecast
curl -X POST \
  https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-demand-forecast \
  -H "Authorization: Bearer $ANON_KEY"

# Test Upsell Compute
curl -X POST \
  https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-upsell-compute \
  -H "Authorization: Bearer $ANON_KEY"

# Test Menu Engineering
curl -X POST \
  https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-menu-engineering \
  -H "Authorization: Bearer $ANON_KEY"
```

Expected response: `{"success": true, ...}`

---

## File Locations

| Feature | Location |
|---------|----------|
| **Backend** | |
| DB Migration | `supabase/migrations/20260622_000047_restaurant_ai.sql` |
| AI Assistant Function | `supabase/functions/restaurant-ai-assistant/` |
| Demand Forecast Function | `supabase/functions/restaurant-demand-forecast/` |
| Upsell Rules Function | `supabase/functions/restaurant-upsell-compute/` |
| Menu Engineering Function | `supabase/functions/restaurant-menu-engineering/` |
| **Frontend** | |
| AI Chat Page | `src/pages/restaurant/AIAssistant.tsx` |
| Forecast Tab | `src/pages/restaurant/RestaurantAnalytics.tsx` |
| Menu Matrix Tab | `src/pages/restaurant/RestaurantAnalytics.tsx` |
| Content Generator Modal | `src/components/restaurant/AIContentGeneratorModal.tsx` |
| Upsell Hook | `src/hooks/useUpsellRules.ts` |
| **Config** | |
| Environment Template | `.env.example` |
| Progress Ledger | `.superpowers/sdd/progress.md` |

---

## Troubleshooting

**"Function not found" error:**
- Verify function deployed: Supabase Dashboard → Edge Functions
- Check project ref is correct: `pytndxjeznhhyycjasep`

**"Missing ANTHROPIC_API_KEY":**
- Run: `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY --project-ref pytndxjeznhhyycjasep`
- Verify in Supabase Dashboard → Edge Functions → Secrets

**"RLS violation" or "No rows returned":**
- Check `VITE_ANTHROPIC_API_KEY` is set in `.env.local`
- Verify tenant exists and is active

**Forecast/upsell data not showing:**
- Run cron job manually (curl test above)
- Check Supabase logs: Dashboard → Edge Functions → logs
- Verify database migration ran: Dashboard → SQL Editor → check tables exist

---

## Getting Your Keys

**Anthropic API Key:**
- Go to: https://console.anthropic.com/
- Click "API keys"
- Create new key
- Copy value (starts with `sk-ant-`)

**Supabase Anon Key:**
- Go to: Supabase Dashboard
- Click your project
- Settings → API
- Copy `anon` value

**Supabase Service Role Key:**
- Same location as above
- Copy `service_role` value (⚠️ keep secret!)

---

## What Each Feature Does

### AI Assistant (`/restaurant/ai`)
- Chat interface for restaurant questions
- Asks Claude about revenue, top items, staffing recommendations
- Bilingual EN/AR support

### Demand Forecasting (RestaurantAnalytics → "Forecast" tab)
- 7-day predictions with confidence scores
- Factored for Lebanese holidays, Ramadan, summer peak
- Staffing recommendations per day

### Menu Engineering (RestaurantAnalytics → "Matrix" tab)
- 4-quadrant BCG matrix (Stars/Plowhorses/Puzzles/Dogs)
- Revenue impact recommendations per item
- Interactive filters by category

### Upsell Prompts (WaiterInterface → QuickAddModal)
- "Guests who order X also love Y" suggestions
- Based on transaction history association rules
- One-tap add to order

### AI Content Generator (MenuManagement → Item Form)
- Generate EN/AR menu descriptions from ingredients
- Powered by Claude
- Edit and save before publishing

---

**Phase 2 Status:** Code complete and tested ✅
**Next Step:** Run this checklist to activate
