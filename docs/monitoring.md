# Monitoring Guide

The monitoring system is entirely client-side — no external monitoring infrastructure is required. All metrics are read from browser APIs and live Supabase queries.

---

## Monitoring Dashboard (`/monitoring`)

Accessible at the `/monitoring` route. Business plan only (feature-gated via `FeatureGate feature="monitoring"`).

### Tabs

#### Health Check (`src/components/monitoring/HealthCheckDashboard.tsx`)
- **Supabase connectivity**: Runs `supabase.from('products').select('count')` and measures round-trip latency
- **Auth service**: Calls `supabase.auth.getSession()` to verify auth is reachable
- **Frontend app**: `navigator.onLine` + `window.performance.now()`
- Results shown as: ✅ Healthy / ⚠️ Degraded / ❌ Down with response time in ms
- Auto-refreshes every 30 seconds

#### Performance (`src/components/monitoring/PerformanceDashboard.tsx`)
Reads real browser Web Vitals via the `Performance` API:
- **LCP** (Largest Contentful Paint) — target: < 2.5s
- **FCP** (First Contentful Paint) — target: < 1.8s
- **CLS** (Cumulative Layout Shift) — target: < 0.1
- **TTFB** (Time to First Byte) — target: < 600ms

Shows `N/A` until the metric is observable in the current session. Note: server-side metrics (CPU, memory) are not available in a browser SPA and are not shown.

#### Error Tracking (`src/components/monitoring/ErrorTrackingDashboard.tsx`)
Captures real runtime errors in the current session via:
- `window.onerror` — synchronous JavaScript errors
- `window.addEventListener('unhandledrejection', ...)` — unhandled Promise rejections

Shows green "No errors captured" when the session is clean. Errors accumulate in component state for the session lifetime.

#### Overview (`src/components/monitoring/MonitoringDashboard.tsx`)
Live business stats from Supabase:
- Sales recorded today
- Total products
- Total customers
- Active employees

---

## Sentry Integration (Optional)

`src/services/sentryService.ts` and `src/config/monitoring.ts` are wired for Sentry. To activate:

1. Create a Sentry project at sentry.io
2. Add `VITE_SENTRY_DSN` to Vercel environment variables
3. Sentry will auto-capture unhandled errors and performance data

Without the DSN set, Sentry initializes in no-op mode — no errors thrown.

---

## Web Vitals Targets

| Metric | Good | Needs Work | Poor |
|---|---|---|---|
| LCP | < 2.5s | 2.5–4.0s | > 4.0s |
| FCP | < 1.8s | 1.8–3.0s | > 3.0s |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |
| TTFB | < 600ms | 600ms–1.8s | > 1.8s |

---

## Known Gaps

- No persistent storage for monitoring data — metrics reset on page reload
- No alerting system (email/Slack/SMS) — manual dashboard monitoring only
- No historical trend charts — current session only
- Server-side metrics (database query times, CPU) require a server component and are not available in this SPA architecture
