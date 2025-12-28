export const monitoringConfig = {
  // Sentry configuration
  sentry: {
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.VITE_APP_VERSION || '1.0.0',
    tracesSampleRate: 0.1,
    debug: process.env.NODE_ENV === 'development'
  },

  // Performance thresholds
  performance: {
    // Web Vitals thresholds (in milliseconds unless specified)
    lcp: { threshold: 2500, warning: 2000 },
    fid: { threshold: 100, warning: 50 },
    cls: { threshold: 0.1, warning: 0.05 },
    fcp: { threshold: 1800, warning: 1000 },
    ttfb: { threshold: 600, warning: 300 },

    // Resource performance thresholds
    apiResponseTime: { threshold: 2000, warning: 1000 },
    databaseQueryTime: { threshold: 500, warning: 200 },
    assetLoadTime: { threshold: 3000, warning: 1500 },
    bundleSize: { threshold: 500, warning: 250 } // in KB
  },

  // System monitoring thresholds
  system: {
    memoryUsage: { threshold: 85, warning: 70 }, // percentage
    cpuUsage: { threshold: 80, warning: 60 }, // percentage
    diskUsage: { threshold: 90, warning: 75 }, // percentage
    errorRate: { threshold: 0.05, warning: 0.01 }, // percentage
    uptime: { threshold: 99, warning: 99.5 } // percentage
  },

  // Alert configuration
  alerts: {
    // Cooldown periods in minutes
    cooldowns: {
      critical: 5,
      high: 10,
      medium: 15,
      low: 30
    },

    // Notification channels
    channels: {
      email: {
        enabled: true,
        recipients: ['admin@company.com'],
        severity: ['critical', 'high']
      },
      slack: {
        enabled: false,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#alerts',
        severity: ['critical', 'high', 'medium']
      },
      sms: {
        enabled: false,
        numbers: [],
        severity: ['critical']
      }
    },

    // Alert rules
    rules: {
      enabled: true,
      checkInterval: 60000, // milliseconds
      maxAlertsPerHour: 50,
      autoAcknowledgeAfter: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    }
  },

  // Data retention
  retention: {
    metrics: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    alerts: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
    logs: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  },

  // Health check configuration
  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retries: 3,
    services: [
      { name: 'api', endpoint: '/api/health', critical: true },
      { name: 'database', endpoint: '/api/health/database', critical: true },
      { name: 'auth', endpoint: '/api/health/auth', critical: true },
      { name: 'storage', endpoint: '/api/health/storage', critical: false }
    ]
  },

  // Dashboard configuration
  dashboard: {
    refreshInterval: 30000, // 30 seconds
    maxDataPoints: 100,
    defaultTimeRange: '24h',
    availableTimeRanges: ['1h', '6h', '24h', '7d', '30d']
  }
};

export type MonitoringConfig = typeof monitoringConfig;
