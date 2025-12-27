import { supabase } from './supabaseClient';
import { logSecurityEvent } from './auditLogger';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface SecurityContext {
  userId?: string;
  tenantId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private rateLimits: Map<string, RateLimitConfig> = new Map();

  private constructor() {
    // Configure rate limits for different operations
    this.rateLimits.set('login', { maxRequests: 5, windowMs: 15 * 60 * 1000 }); // 5 per 15 min
    this.rateLimits.set('api_call', { maxRequests: 1000, windowMs: 60 * 1000 }); // 1000 per minute
    this.rateLimits.set('data_export', { maxRequests: 10, windowMs: 60 * 60 * 1000 }); // 10 per hour
    this.rateLimits.set('bulk_operation', { maxRequests: 50, windowMs: 60 * 60 * 1000 }); // 50 per hour
  }

  static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  // Rate limiting check
  async checkRateLimit(
    operation: string,
    context: SecurityContext,
    customConfig?: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const config = customConfig || this.rateLimits.get(operation) || { maxRequests: 100, windowMs: 60000 };
    const key = `${context.userId || 'anonymous'}_${operation}_${context.ipAddress || 'unknown'}`;
    
    const now = Date.now();
    const existing = rateLimitStore.get(key);
    
    if (!existing || now > existing.resetTime) {
      // Reset or create new entry
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs
      };
    }
    
    // Check if over limit
    if (existing.count >= config.maxRequests) {
      // Log rate limit violation
      await logSecurityEvent(
        'rate_limit_exceeded',
        `Rate limit exceeded for ${operation}`,
        'medium',
        {
          operation,
          userId: context.userId,
          tenantId: context.tenantId,
          ipAddress: context.ipAddress,
          count: existing.count,
          limit: config.maxRequests
        }
      );
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: existing.resetTime
      };
    }
    
    // Increment counter
    existing.count++;
    rateLimitStore.set(key, existing);
    
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime
    };
  }

  // Server-side role validation
  async validateRole(
    requiredRole: 'owner' | 'manager' | 'cashier' | 'viewer',
    context: SecurityContext
  ): Promise<{ valid: boolean; actualRole?: string }> {
    if (!context.userId || !context.tenantId) {
      await logSecurityEvent(
        'unauthorized_access',
        'Role validation failed: missing user context',
        'high',
        { requiredRole, userId: context.userId, tenantId: context.tenantId }
      );
      
      return { valid: false };
    }

    try {
      const { data, error } = await supabase.rpc('verify_role_permission', {
        required_role: requiredRole
      });

      if (error) {
        await logSecurityEvent(
          'role_validation_error',
          'Role validation function error',
          'medium',
          { requiredRole, error: error.message }
        );
        
        return { valid: false };
      }

      const valid = !!data;
      
      if (!valid) {
        await logSecurityEvent(
          'unauthorized_access',
          `User attempted to access ${requiredRole} level resources`,
          'medium',
          {
            requiredRole,
            userId: context.userId,
            tenantId: context.tenantId,
            userRole: context.userRole
          }
        );
      }

      return { valid, actualRole: context.userRole };
    } catch (error) {
      await logSecurityEvent(
        'role_validation_exception',
        'Role validation exception occurred',
        'high',
        { requiredRole, error: String(error) }
      );
      
      return { valid: false };
    }
  }

  // Input validation and sanitization
  validateInput(input: any, type: 'email' | 'phone' | 'text' | 'number' | 'json'): { valid: boolean; sanitized?: any; error?: string } {
    if (input === null || input === undefined) {
      return { valid: true, sanitized: null };
    }

    try {
      switch (type) {
        case 'email':
          const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
          if (!emailRegex.test(input)) {
            return { valid: false, error: 'Invalid email format' };
          }
          return { valid: true, sanitized: input.toLowerCase().trim() };

        case 'phone':
          const phoneRegex = /^\+?[0-9\s\-\(\)]{10,}$/;
          if (!phoneRegex.test(input)) {
            return { valid: false, error: 'Invalid phone format' };
          }
          return { valid: true, sanitized: input.replace(/\s+/g, ' ').trim() };

        case 'text':
          if (typeof input !== 'string') {
            return { valid: false, error: 'Text input must be a string' };
          }
          // Sanitize against XSS and injection attempts
          const sanitized = input
            .replace(/[<>'"&]/g, '') // Remove HTML characters
            .replace(/[;'"\\]/g, '') // Remove SQL injection characters
            .trim();
          return { valid: true, sanitized };

        case 'number':
          const num = Number(input);
          if (isNaN(num) || !isFinite(num)) {
            return { valid: false, error: 'Invalid number' };
          }
          return { valid: true, sanitized: num };

        case 'json':
          if (typeof input === 'object') {
            // Recursively sanitize object
            return { valid: true, sanitized: this.sanitizeObject(input) };
          }
          return { valid: false, error: 'Invalid JSON object' };

        default:
          return { valid: false, error: 'Unknown input type' };
      }
    } catch (error) {
      return { valid: false, error: 'Validation error occurred' };
    }
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = value.replace(/[<>'"&;'"\\]/g, '').trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // Security audit logging for sensitive operations
  async auditSensitiveOperation(
    operation: string,
    context: SecurityContext,
    details: any
  ): Promise<void> {
    const sensitiveOperations = [
      'role_change',
      'tenant_switch',
      'bulk_delete',
      'data_export',
      'user_creation',
      'permission_change'
    ];

    if (sensitiveOperations.includes(operation)) {
      await logSecurityEvent(
        operation,
        `Sensitive operation: ${operation}`,
        operation === 'role_change' || operation === 'permission_change' ? 'high' : 'medium',
        {
          ...details,
          userId: context.userId,
          tenantId: context.tenantId,
          userRole: context.userRole,
          ipAddress: context.ipAddress,
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  // Check for suspicious patterns
  async detectSuspiciousActivity(
    context: SecurityContext,
    operation: string
  ): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let suspicious = false;

    // Check for rapid successive operations
    const recentKey = `${context.userId}_recent_ops`;
    const recent = rateLimitStore.get(recentKey);
    
    if (recent && recent.count > 50) { // More than 50 operations in a short window
      reasons.push('High frequency operations detected');
      suspicious = true;
    }

    // Check for operations from multiple IPs (potential session hijacking)
    const ipKey = `${context.userId}_ips`;
    const ips = rateLimitStore.get(ipKey);
    
    if (ips && ips.count > 3) { // More than 3 different IPs
      reasons.push('Multiple IP addresses detected');
      suspicious = true;
    }

    if (suspicious) {
      await logSecurityEvent(
        'suspicious_activity',
        `Suspicious activity detected: ${reasons.join(', ')}`,
        'high',
        {
          reasons,
          operation,
          userId: context.userId,
          tenantId: context.tenantId,
          ipAddress: context.ipAddress
        }
      );
    }

    return { suspicious, reasons };
  }

  // Middleware function for API calls
  async apiMiddleware(
    operation: string,
    context: SecurityContext,
    requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer'
  ): Promise<{ authorized: boolean; error?: string; rateLimit?: any }> {
    // 1. Rate limiting check
    const rateLimitResult = await this.checkRateLimit('api_call', context);
    if (!rateLimitResult.allowed) {
      return {
        authorized: false,
        error: 'Rate limit exceeded. Please try again later.',
        rateLimit: rateLimitResult
      };
    }

    // 2. Role validation (if required)
    if (requiredRole) {
      const roleResult = await this.validateRole(requiredRole, context);
      if (!roleResult.valid) {
        return {
          authorized: false,
          error: `Insufficient permissions. ${requiredRole} role required.`
        };
      }
    }

    // 3. Suspicious activity detection
    const suspiciousResult = await this.detectSuspiciousActivity(context, operation);
    if (suspiciousResult.suspicious) {
      // Log but don't block - let security team investigate
      console.warn('Suspicious activity detected:', suspiciousResult.reasons);
    }

    return { authorized: true, rateLimit: rateLimitResult };
  }
}

// Export singleton instance
export const securityMiddleware = SecurityMiddleware.getInstance();
