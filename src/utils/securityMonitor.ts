import { logSecurityEvent } from './auditLogger';



// Security monitoring and alerting
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private alertThresholds = {
    failedLogins: 5,
    suspiciousOperations: 10,
    dataExportAttempts: 3,
    roleChangeAttempts: 2,
  };

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  // Monitor for security events
  async monitorSecurityEvent(
    eventType: string,
    userId?: string,
    tenantId?: string,
    details?: any,
  ): Promise<void> {
    const _eventKey = `${eventType}_${userId || 'anonymous'}_${Date.now()}`;

    // Log the event
    await logSecurityEvent(eventType, `Security event: ${eventType}`, 'medium', {
      userId,
      tenantId,
      ...details,
      timestamp: new Date().toISOString(),
    });

    // Check for alert conditions
    await this.checkAlertConditions(eventType, userId, tenantId, details);
  }

  private async checkAlertConditions(
    eventType: string,
    userId?: string,
    tenantId?: string,
    details?: any,
  ): Promise<void> {
    switch (eventType) {
      case 'failed_login':
        await this.handleFailedLogin(userId, tenantId, details);
        break;
      case 'suspicious_activity':
        await this.handleSuspiciousActivity(userId, tenantId, details);
        break;
      case 'data_export_attempt':
        await this.handleDataExportAttempt(userId, tenantId, details);
        break;
      case 'role_change_attempt':
        await this.handleRoleChangeAttempt(userId, tenantId, details);
        break;
    }
  }

  private async handleFailedLogin(userId?: string, tenantId?: string, details?: any): Promise<void> {
    // Check if this exceeds threshold
    const recentFailures = await this.getRecentEventCount('failed_login', 15 * 60 * 1000, userId); // 15 minutes

    if (recentFailures >= this.alertThresholds.failedLogins) {
      await logSecurityEvent(
        'brute_force_detected',
        'Multiple failed login attempts detected',
        'high',
        { userId, tenantId, failureCount: recentFailures, ...details },
      );

      // Could trigger account lockout or additional verification here
    }
  }

  private async handleSuspiciousActivity(userId?: string, tenantId?: string, details?: any): Promise<void> {
    const recentSuspicious = await this.getRecentEventCount('suspicious_activity', 60 * 60 * 1000, userId); // 1 hour

    if (recentSuspicious >= this.alertThresholds.suspiciousOperations) {
      await logSecurityEvent(
        'high_suspicious_activity',
        'High volume of suspicious activity detected',
        'critical',
        { userId, tenantId, suspiciousCount: recentSuspicious, ...details },
      );
    }
  }

  private async handleDataExportAttempt(userId?: string, tenantId?: string, details?: any): Promise<void> {
    const recentExports = await this.getRecentEventCount('data_export_attempt', 60 * 60 * 1000, userId); // 1 hour

    if (recentExports >= this.alertThresholds.dataExportAttempts) {
      await logSecurityEvent(
        'excessive_data_export',
        'Excessive data export attempts detected',
        'high',
        { userId, tenantId, exportCount: recentExports, ...details },
      );
    }
  }

  private async handleRoleChangeAttempt(userId?: string, tenantId?: string, details?: any): Promise<void> {
    const recentRoleChanges = await this.getRecentEventCount('role_change_attempt', 24 * 60 * 60 * 1000, userId); // 24 hours

    if (recentRoleChanges >= this.alertThresholds.roleChangeAttempts) {
      await logSecurityEvent(
        'excessive_role_changes',
        'Excessive role change attempts detected',
        'high',
        { userId, tenantId, roleChangeCount: recentRoleChanges, ...details },
      );
    }
  }

  private async getRecentEventCount(_eventType: string, _timeWindowMs: number, _userId?: string): Promise<number> {
    // In a real implementation, this would query the audit log
    // For now, return a mock count
    return Math.floor(Math.random() * 10);
  }

  // Security health check
  async performSecurityHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for common security issues
    const checks = await Promise.all([
      this.checkAuthenticationHealth(),
      this.checkAuthorizationHealth(),
      this.checkInputValidationHealth(),
      this.checkRateLimitHealth(),
      this.checkAuditLogHealth(),
    ]);

    checks.forEach(check => {
      issues.push(...check.issues);
      recommendations.push(...check.recommendations);
    });

    const status = issues.length === 0 ? 'healthy' :
      issues.length <= 3 ? 'warning' : 'critical';

    return { status, issues, recommendations };
  }

  private async checkAuthenticationHealth(): Promise<{ issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for recent authentication issues
    const recentFailedLogins = await this.getRecentEventCount('failed_login', 60 * 60 * 1000);

    if (recentFailedLogins > 10) {
      issues.push('High number of failed login attempts detected');
      recommendations.push('Consider implementing account lockout policies');
    }

    return { issues, recommendations };
  }

  private async checkAuthorizationHealth(): Promise<{ issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const recentUnauthorizedAttempts = await this.getRecentEventCount('unauthorized_access', 60 * 60 * 1000);

    if (recentUnauthorizedAttempts > 5) {
      issues.push('Multiple unauthorized access attempts detected');
      recommendations.push('Review user permissions and access controls');
    }

    return { issues, recommendations };
  }

  private async checkInputValidationHealth(): Promise<{ issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const recentValidationFailures = await this.getRecentEventCount('validation_failure', 60 * 60 * 1000);

    if (recentValidationFailures > 20) {
      issues.push('High number of input validation failures');
      recommendations.push('Review input validation rules and user input handling');
    }

    return { issues, recommendations };
  }

  private async checkRateLimitHealth(): Promise<{ issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const recentRateLimitHits = await this.getRecentEventCount('rate_limit_exceeded', 60 * 60 * 1000);

    if (recentRateLimitHits > 5) {
      issues.push('Rate limits being frequently exceeded');
      recommendations.push('Consider adjusting rate limit thresholds or investigating bot activity');
    }

    return { issues, recommendations };
  }

  private async checkAuditLogHealth(): Promise<{ issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if audit logging is working
    const recentLogs = await this.getRecentEventCount('any', 60 * 60 * 1000);

    if (recentLogs === 0) {
      issues.push('No audit logs detected in the last hour');
      recommendations.push('Verify audit logging is functioning correctly');
    }

    return { issues, recommendations };
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();
