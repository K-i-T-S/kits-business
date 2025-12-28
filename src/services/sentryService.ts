import * as Sentry from '@sentry/react';

import { log } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
}

export class SentryService {
  private static instance: SentryService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): SentryService {
    if (!SentryService.instance) {
      SentryService.instance = new SentryService();
    }
    return SentryService.instance;
  }

  public initialize(config: SentryConfig): void {
    if (this.initialized) {
      log.warn('Sentry already initialized');
      return;
    }

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate || 0.1,
      debug: config.debug || false,
      beforeSend: (event, hint) => {
        // Filter out certain errors in development
        if (config.environment === 'development') {
          const error = hint?.originalException as Error;
          if (error?.name === 'ChunkLoadError') {
            return null; // Don't send chunk load errors in dev
          }
        }

        // Add user context if available
        this.addUserContext(event);

        return event;
      },
    });

    this.initialized = true;
    log.info('Sentry initialized successfully');
  }

  private async addUserContext(event: Sentry.Event): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        event.user = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.name || session.user.email,
        };
      }
    } catch (error) {
      console.warn('Failed to add user context to Sentry event:', error);
    }
  }

  public setUser(user: Sentry.User | null): void {
    Sentry.setUser(user);
  }

  public setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  public setContext(key: string, context: Record<string, any>): void {
    Sentry.setContext(key, context);
  }

  public addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  public captureException(error: Error, context?: Record<string, any>): void {
    Sentry.captureException(error, {
      extra: context,
    });
  }

  public captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    Sentry.captureMessage(message, level);
    if (context) {
      Sentry.setExtra('context', context);
    }
  }

  public captureUserAction(action: string, details?: Record<string, any>): void {
    this.addBreadcrumb({
      category: 'user',
      message: action,
      level: 'info',
      data: details,
    });
  }

  public captureApiCall(url: string, method: string, statusCode: number, duration: number): void {
    this.addBreadcrumb({
      category: 'http',
      message: `${method} ${url}`,
      level: statusCode >= 400 ? 'error' : 'info',
      data: {
        url,
        method,
        statusCode,
        duration,
      },
    });
  }

  public capturePerformanceMetric(name: string, value: number, unit: string = 'ms'): void {
    this.addBreadcrumb({
      category: 'performance',
      message: name,
      level: 'info',
      data: {
        value,
        unit,
        timestamp: Date.now(),
      },
    });
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public destroy(): void {
    Sentry.close();
    this.initialized = false;
  }
}

export const sentryService = SentryService.getInstance();

// React hook for Sentry
export const useSentry = () => {
  return {
    setUser: sentryService.setUser.bind(sentryService),
    setTag: sentryService.setTag.bind(sentryService),
    setContext: sentryService.setContext.bind(sentryService),
    addBreadcrumb: sentryService.addBreadcrumb.bind(sentryService),
    captureException: sentryService.captureException.bind(sentryService),
    captureMessage: sentryService.captureMessage.bind(sentryService),
    captureUserAction: sentryService.captureUserAction.bind(sentryService),
    captureApiCall: sentryService.captureApiCall.bind(sentryService),
    capturePerformanceMetric: sentryService.capturePerformanceMetric.bind(sentryService),
  };
};

// Performance monitoring utilities
export const PerformanceMonitor = {
  startTimer: (name: string): (() => void) => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      sentryService.capturePerformanceMetric(name, duration);
    };
  },

  measureAsync: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      sentryService.capturePerformanceMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      sentryService.capturePerformanceMetric(name, duration);
      sentryService.captureException(error as Error, { operation: name, duration });
      throw error;
    }
  },
};

// API monitoring middleware
export const createApiMonitoringMiddleware = () => {
  return (req: any, res: any, next: Function) => {
    const start = Date.now();

    // Capture request start
    sentryService.addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.url} - started`,
      level: 'info',
      data: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    });

    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - start;

      // Capture API call completion
      sentryService.captureApiCall(req.url, req.method, res.statusCode, duration);

      // Add error context if request failed
      if (res.statusCode >= 400) {
        sentryService.setContext('api_error', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          response: data,
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};
