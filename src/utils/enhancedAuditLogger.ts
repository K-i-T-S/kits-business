import { supabase } from './supabaseClient';
import { securityMiddleware } from './securityMiddleware';

interface SecurityContext {
  userId?: string;
  tenantId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'security' | 'business' | 'system' | 'compliance';
}

export class EnhancedAuditLogger {
  private static instance: EnhancedAuditLogger;
  private sensitiveFields = ['password', 'token', 'secret', 'key', 'credit_card', 'ssn'];
  private piiFields = ['email', 'phone', 'address', 'name'];

  private constructor() {}

  static getInstance(): EnhancedAuditLogger {
    if (!EnhancedAuditLogger.instance) {
      EnhancedAuditLogger.instance = new EnhancedAuditLogger();
    }
    return EnhancedAuditLogger.instance;
  }

  // Enhanced audit logging with PII protection
  async logAuditEvent(event: AuditEvent, context: SecurityContext): Promise<string | null> {
    try {
      // Sanitize sensitive data
      const sanitizedOldValues = this.sanitizeData(event.oldValues);
      const sanitizedNewValues = this.sanitizeData(event.newValues);
      const sanitizedMetadata = this.sanitizeData(event.metadata);

      // Determine if this is a sensitive operation
      const isSensitive = this.isSensitiveOperation(event.action, event.entityType);
      
      // Add security context to metadata
      const enhancedMetadata = {
        ...sanitizedMetadata,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: this.getSessionId(),
        isSensitive,
        category: event.category || this.categorizeEvent(event.action),
        timestamp: new Date().toISOString()
      };

      // Log to audit table
      const { data, error } = await supabase.rpc('log_audit', {
        p_action: event.action,
        p_entity_type: event.entityType,
        p_entity_id: event.entityId,
        p_old_values: sanitizedOldValues,
        p_new_values: sanitizedNewValues,
        p_metadata: enhancedMetadata
      });

      if (error) {
        console.error('Audit logging failed:', error);
        return null;
      }

      // Log to activity feed for user-facing events
      if (this.shouldLogToActivity(event.action)) {
        await this.logActivityEvent(event, context);
      }

      // Enhanced security logging for sensitive operations
      if (isSensitive) {
        await this.logSecurityEvent(event, context);
      }

      return data;
    } catch (error) {
      console.error('Enhanced audit logging error:', error);
      return null;
    }
  }

  // Role change audit logging
  async logRoleChange(
    userId: string,
    tenantId: string,
    oldRole: string,
    newRole: string,
    changedBy: string,
    context: SecurityContext
  ): Promise<void> {
    const event: AuditEvent = {
      action: 'role_changed',
      entityType: 'tenant_users',
      entityId: userId,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
      metadata: {
        changedBy,
        roleChangeType: this.getRoleChangeType(oldRole, newRole),
        escalation: this.isRoleEscalation(oldRole, newRole)
      },
      severity: this.isRoleEscalation(oldRole, newRole) ? 'high' : 'medium',
      category: 'security'
    };

    await this.logAuditEvent(event, { ...context, userId, tenantId });
  }

  // Tenant switch audit logging
  async logTenantSwitch(
    userId: string,
    oldTenantId: string | null,
    newTenantId: string,
    context: SecurityContext
  ): Promise<void> {
    const event: AuditEvent = {
      action: 'tenant_switched',
      entityType: 'tenant',
      entityId: newTenantId,
      oldValues: oldTenantId ? { tenantId: oldTenantId } : undefined,
      newValues: { tenantId: newTenantId },
      metadata: {
        switchType: oldTenantId ? 'switch' : 'initial_login',
        previousTenant: oldTenantId
      },
      severity: 'low',
      category: 'security'
    };

    await this.logAuditEvent(event, { ...context, userId, tenantId: newTenantId });
  }

  // Bulk operation audit logging
  async logBulkOperation(
    operation: string,
    entityType: string,
    affectedIds: string[],
    context: SecurityContext
  ): Promise<void> {
    const event: AuditEvent = {
      action: `bulk_${operation}`,
      entityType,
      metadata: {
        affectedCount: affectedIds.length,
        affectedIds: affectedIds.slice(0, 10), // Log first 10 IDs only
        bulkOperationType: operation
      },
      severity: operation === 'delete' ? 'high' : 'medium',
      category: 'business'
    };

    await this.logAuditEvent(event, context);
  }

  // Data export audit logging
  async logDataExport(
    exportType: string,
    recordCount: number,
    filters: any,
    context: SecurityContext
  ): Promise<void> {
    const event: AuditEvent = {
      action: 'data_exported',
      entityType: exportType,
      metadata: {
        recordCount,
        exportFormat: 'csv', // or other format
        filters: this.sanitizeData(filters),
        exportSize: this.estimateExportSize(recordCount)
      },
      severity: recordCount > 1000 ? 'high' : 'medium',
      category: 'compliance'
    };

    await this.logAuditEvent(event, context);
  }

  // Failed login attempt logging
  async logFailedLogin(
    email: string,
    reason: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const event: AuditEvent = {
      action: 'login_failed',
      entityType: 'auth',
      metadata: {
        email: this.maskEmail(email),
        failureReason: reason,
        attemptCount: await this.getFailedLoginAttempts(email, ipAddress)
      },
      severity: 'medium',
      category: 'security'
    };

    await this.logAuditEvent(event, { ipAddress, userAgent });
  }

  // Security violation logging
  async logSecurityViolation(
    violationType: string,
    description: string,
    context: SecurityContext,
    details: any = {}
  ): Promise<void> {
    const event: AuditEvent = {
      action: `security_violation_${violationType}`,
      entityType: 'security_event',
      metadata: {
        violationType,
        description,
        ...details
      },
      severity: 'high',
      category: 'security'
    };

    await this.logAuditEvent(event, context);
  }

  // Private helper methods

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [] : {} as any;

    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        // Mask sensitive fields
        (sanitized as any)[key] = '***REDACTED***';
      } else if (this.piiFields.some(field => key.toLowerCase().includes(field))) {
        // Partially mask PII fields
        (sanitized as any)[key] = this.maskPII(key, value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        (sanitized as any)[key] = this.sanitizeData(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  private maskPII(field: string, value: any): any {
    if (typeof value !== 'string') return value;

    if (field.toLowerCase().includes('email')) {
      return this.maskEmail(value);
    } else if (field.toLowerCase().includes('phone')) {
      return this.maskPhone(value);
    } else if (field.toLowerCase().includes('name')) {
      return this.maskName(value);
    }

    return value;
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    const username = parts[0];
    const domain = parts[1];
    
    if (!username || !domain) return '***@***.***';
    if (username.length <= 2) return `${username[0]}***@${domain}`;
    return `${username.substring(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return '***-***';
    return `${cleaned.substring(0, 3)}-***-${cleaned.substring(cleaned.length - 2)}`;
  }

  private maskName(name: string): string {
    if (name.length <= 2) return name[0] + '***';
    return name[0] + '***' + name[name.length - 1];
  }

  private isSensitiveOperation(action: string, entityType: string): boolean {
    const sensitiveActions = [
      'role_changed', 'permission_changed', 'tenant_switched',
      'bulk_delete', 'data_exported', 'user_created', 'user_deleted',
      'security_violation', 'login_failed', 'password_changed'
    ];

    const sensitiveEntities = [
      'tenant_users', 'auth', 'security_event', 'permissions'
    ];

    return sensitiveActions.includes(action) || sensitiveEntities.includes(entityType);
  }

  private shouldLogToActivity(action: string): boolean {
    const activityActions = [
      'sale_created', 'customer_added', 'product_added',
      'tenant_switched', 'user_login', 'user_logout'
    ];

    return activityActions.includes(action);
  }

  private categorizeEvent(action: string): 'security' | 'business' | 'system' | 'compliance' {
    if (action.includes('security') || action.includes('login') || action.includes('role')) {
      return 'security';
    } else if (action.includes('export') || action.includes('audit')) {
      return 'compliance';
    } else if (action.includes('system') || action.includes('config')) {
      return 'system';
    } else {
      return 'business';
    }
  }

  private async logActivityEvent(event: AuditEvent, context: SecurityContext): Promise<void> {
    const description = this.generateActivityDescription(event);

    await supabase.rpc('log_activity', {
      p_action: event.action,
      p_description: description,
      p_entity_type: event.entityType,
      p_entity_id: event.entityId,
      p_metadata: event.metadata
    });
  }

  private async logSecurityEvent(event: AuditEvent, context: SecurityContext): Promise<void> {
    await supabase.rpc('log_security_event', {
      event_type: event.action,
      description: this.generateSecurityDescription(event),
      severity: event.severity || 'medium',
      metadata: event.metadata
    });
  }

  private generateActivityDescription(event: AuditEvent): string {
    switch (event.action) {
      case 'sale_created':
        return `New sale processed`;
      case 'customer_added':
        return `New customer added`;
      case 'product_added':
        return `New product added to inventory`;
      case 'tenant_switched':
        return `Switched to different tenant`;
      case 'user_login':
        return `User logged in`;
      case 'user_logout':
        return `User logged out`;
      default:
        return `${event.action} on ${event.entityType}`;
    }
  }

  private generateSecurityDescription(event: AuditEvent): string {
    switch (event.action) {
      case 'role_changed':
        return `User role was changed`;
      case 'tenant_switched':
        return `User switched tenant context`;
      case 'bulk_delete':
        return `Bulk delete operation performed`;
      case 'data_exported':
        return `Data export operation performed`;
      default:
        return `Security event: ${event.action}`;
    }
  }

  private getRoleChangeType(oldRole: string, newRole: string): string {
    if (oldRole === newRole) return 'no_change';
    if (this.isRoleEscalation(oldRole, newRole)) return 'escalation';
    if (this.isRoleEscalation(newRole, oldRole)) return 'delegation';
    return 'modification';
  }

  private isRoleEscalation(oldRole: string, newRole: string): boolean {
    const roleHierarchy = { 'viewer': 1, 'cashier': 2, 'manager': 3, 'owner': 4 };
    return (roleHierarchy[newRole as keyof typeof roleHierarchy] || 0) > 
           (roleHierarchy[oldRole as keyof typeof roleHierarchy] || 0);
  }

  private getSessionId(): string {
    // Generate or retrieve session ID - in production, this would come from auth
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateExportSize(recordCount: number): string {
    // Rough estimation in bytes
    const avgRecordSize = 500; // bytes per record
    const totalBytes = recordCount * avgRecordSize;
    
    if (totalBytes < 1024) return `${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `${Math.round(totalBytes / 1024)} KB`;
    return `${Math.round(totalBytes / (1024 * 1024))} MB`;
  }

  private async getFailedLoginAttempts(email: string, ipAddress: string): Promise<number> {
    // Query recent failed attempts for this email/IP
    const { count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .contains('metadata', { email: this.maskEmail(email) })
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    return count || 0;
  }
}

// Export singleton instance
export const enhancedAuditLogger = EnhancedAuditLogger.getInstance();
