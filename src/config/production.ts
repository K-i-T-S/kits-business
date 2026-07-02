export const PRODUCTION_CONFIG = {
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
    environment: 'production',
    tracesSampleRate: 0.1,
  },
  analytics: {
    enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    gaId: import.meta.env.VITE_GOOGLE_ANALYTICS_ID as string | undefined,
  },
  performance: {
    budget: parseInt((import.meta.env.VITE_PERFORMANCE_BUDGET as string | undefined) ?? '500000'),
    monitoring: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
  },
};
