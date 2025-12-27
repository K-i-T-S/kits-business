import { supabase } from '../utils/supabaseClient';

export interface AuditLogEntry {
  id?: string;
  user_id: string;
  tenant_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  timestamp?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'data' | 'system' | 'security' | 'business';
  success: boolean;
  error_message?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private batchSize = 100;
  private batchBuffer: AuditLogEntry[] = [];
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startBatchFlush();
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private startBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatch();
    }, this.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(batch);

      if (error) {
        console.error('Failed to write audit log batch:', error);
        this.batchBuffer.unshift(...batch);
      }
    } catch (error) {
      console.error('Error flushing audit log batch:', error);
      this.batchBuffer.unshift(...batch);
    }
  }

  public async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.batchBuffer.push(auditEntry);

    if (entry.severity === 'critical' || entry.category === 'security') {
      await this.flushBatch();
    }

    if (this.batchBuffer.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  public async logAuth(
    userId: string,
    action: 'login' | 'logout' | 'register' | 'password_change' | 'password_reset' | 'mfa_enabled' | 'mfa_disabled',
    success: boolean,
    metadata?: Record<string, any>,
    error?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: 'auth',
      severity: action === 'login' && !success ? 'high' : 'medium',
      category: 'auth',
      success,
      metadata,
      error_message: error,
    });
  }

  public async logDataOperation(
    userId: string,
    tenantId: string | undefined,
    action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
    resourceType: string,
    resourceId: string | undefined,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const severity = this.getDataOperationSeverity(action, resourceType);
    
    await this.log({
      user_id: userId,
      tenant_id: tenantId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      metadata,
      severity,
      category: 'data',
      success: true,
    });
  }

  public async logSecurityEvent(
    userId: string | undefined,
    action: 'rate_limit_exceeded' | 'suspicious_activity' | 'blocked_request' | 'privilege_escalation' | 'data_breach_attempt',
    resourceType: string,
    metadata: Record<string, any>,
    severity: 'high' | 'critical' = 'high'
  ): Promise<void> {
    await this.log({
      user_id: userId || 'anonymous',
      action,
      resource_type: resourceType,
      metadata,
      severity,
      category: 'security',
      success: false,
    });
  }

  private getDataOperationSeverity(action: string, resourceType: string): 'low' | 'medium' | 'high' {
    if (action === 'delete') return 'high';
    if (action === 'update' && ['user', 'role', 'permission'].includes(resourceType)) return 'high';
    if (action === 'export' && ['customer', 'financial'].includes(resourceType)) return 'high';
    return 'medium';
  }

  public async flush(): Promise<void> {
    await this.flushBatch();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushBatch().catch(console.error);
  }
}

export const auditLogger = AuditLogger.getInstance();

export const useAuditLogger = () => {
  return {
    logAuth: auditLogger.logAuth.bind(auditLogger),
    logDataOperation: auditLogger.logDataOperation.bind(auditLogger),
    logSecurityEvent: auditLogger.logSecurityEvent.bind(auditLogger),
  };
};
