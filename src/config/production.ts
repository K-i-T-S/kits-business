export const PRODUCTION_CONFIG = {
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,
  },
  analytics: {
    enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    gaId: import.meta.env.VITE_GOOGLE_ANALYTICS_ID,
  },
  performance: {
    budget: parseInt(import.meta.env.VITE_PERFORMANCE_BUDGET || '500000'),
    monitoring: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
  }
};
