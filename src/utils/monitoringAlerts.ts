import { sentryService } from '../services/sentryService';

export interface MonitoringAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: MonitoringAlert['severity'];
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: number;
}

export class MonitoringAlerts {
  private static instance: MonitoringAlerts;
  private alerts: MonitoringAlert[] = [];
  private rules: AlertRule[] = [];
  private subscribers: ((alerts: MonitoringAlert[]) => void)[] = [];

  private constructor() {
    this.setupDefaultRules();
  }

  public static getInstance(): MonitoringAlerts {
    if (!MonitoringAlerts.instance) {
      MonitoringAlerts.instance = new MonitoringAlerts();
    }
    return MonitoringAlerts.instance;
  }

  private setupDefaultRules(): void {
    this.rules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.05,
        severity: 'critical',
        enabled: true,
        cooldown: 15,
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        condition: (metrics) => metrics.averageResponseTime > 2000,
        severity: 'medium',
        enabled: true,
        cooldown: 10,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.memoryUsage > 85,
        severity: 'medium',
        enabled: true,
        cooldown: 20,
      },
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure',
        condition: (metrics) => !metrics.databaseConnected,
        severity: 'critical',
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'low-uptime',
        name: 'Low Uptime',
        condition: (metrics) => metrics.uptime < 99,
        severity: 'high',
        enabled: true,
        cooldown: 60,
      },
    ];
  }

  public checkRules(metrics: any): void {
    const now = Date.now();

    this.rules.forEach(rule => {
      if (!rule.enabled) return;

      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown * 60 * 1000) {
        return;
      }

      // Check condition
      if (rule.condition(metrics)) {
        this.createAlert({
          type: rule.severity === 'critical' ? 'error' : 'warning',
          title: rule.name,
          message: this.generateAlertMessage(rule, metrics),
          severity: rule.severity,
          source: 'automated-rule',
          metadata: { ruleId: rule.id, metrics },
        });

        rule.lastTriggered = now;
      }
    });
  }

  private generateAlertMessage(rule: AlertRule, metrics: any): string {
    switch (rule.id) {
      case 'high-error-rate':
        return `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%, exceeding 5% threshold`;
      case 'slow-response-time':
        return `Average response time is ${metrics.averageResponseTime}ms, exceeding 2000ms threshold`;
      case 'high-memory-usage':
        return `Memory usage is ${metrics.memoryUsage}%, exceeding 85% threshold`;
      case 'database-connection-failure':
        return 'Database connection is down or unavailable';
      case 'low-uptime':
        return `Uptime is ${metrics.uptime}%, below 99% threshold`;
      default:
        return 'Threshold exceeded for ' + rule.name;
    }
  }

  public createAlert(alertData: Omit<MonitoringAlert, 'id' | 'timestamp' | 'acknowledged'>): MonitoringAlert {
    const alert: MonitoringAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.unshift(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    // Send to Sentry
    sentryService.captureMessage(alert.title, alert.type === 'error' ? 'error' : 'warning', {
      alertId: alert.id,
      severity: alert.severity,
      source: alert.source,
      metadata: alert.metadata,
    });

    // Notify subscribers
    this.notifySubscribers();

    return alert;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getAlerts(filter?: {
    type?: MonitoringAlert['type'];
    severity?: MonitoringAlert['severity'];
    acknowledged?: boolean;
    source?: string;
  }): MonitoringAlert[] {
    let filtered = [...this.alerts];

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(alert => alert.type === filter.type);
      }
      if (filter.severity) {
        filtered = filtered.filter(alert => alert.severity === filter.severity);
      }
      if (filter.acknowledged !== undefined) {
        filtered = filtered.filter(alert => alert.acknowledged === filter.acknowledged);
      }
      if (filter.source) {
        filtered = filtered.filter(alert => alert.source === filter.source);
      }
    }

    return filtered;
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.notifySubscribers();

      sentryService.captureUserAction('Alert acknowledged', {
        alertId,
        alertTitle: alert.title,
        alertSeverity: alert.severity,
      });

      return true;
    }
    return false;
  }

  public getUnacknowledgedAlerts(): MonitoringAlert[] {
    return this.getAlerts({ acknowledged: false });
  }

  public getCriticalAlerts(): MonitoringAlert[] {
    return this.getAlerts({ severity: 'critical', acknowledged: false });
  }

  public subscribe(callback: (alerts: MonitoringAlert[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.alerts));
  }

  public addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  public getRules(): AlertRule[] {
    return [...this.rules];
  }

  public clearAlerts(): void {
    this.alerts = [];
    this.notifySubscribers();
  }

  public getAlertStats(): {
    total: number;
    unacknowledged: number;
    critical: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    } {
    const total = this.alerts.length;
    const unacknowledged = this.getUnacknowledgedAlerts().length;
    const critical = this.getCriticalAlerts().length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    return { total, unacknowledged, critical, byType, bySeverity };
  }
}

export const monitoringAlerts = MonitoringAlerts.getInstance();

// Initialize periodic checks
if (typeof window !== 'undefined') {
  setInterval(() => {
    // Simulate metrics collection (in production, this would come from real monitoring)
    const mockMetrics = {
      errorRate: Math.random() * 0.1,
      averageResponseTime: 100 + Math.random() * 3000,
      memoryUsage: 50 + Math.random() * 50,
      databaseConnected: Math.random() > 0.05,
      uptime: 95 + Math.random() * 5,
    };

    monitoringAlerts.checkRules(mockMetrics);
  }, 60000); // Check every minute
}
