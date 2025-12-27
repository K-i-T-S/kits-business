import { supabase } from './supabaseClient';
import { logSecurityEvent } from './auditLogger';

// Enhanced rate limiting with Redis-like persistence
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
  blockedUntil?: number;
}

interface SecurityConfig {
  rateLimiting: {
    login: { maxRequests: number; windowMs: number; blockDurationMs: number };
    api: { maxRequests: number; windowMs: number; blockDurationMs: number };
    export: { maxRequests: number; windowMs: number; blockDurationMs: number };
    bulk: { maxRequests: number; windowMs: number; blockDurationMs: number };
  };
  validation: {
    maxStringLength: number;
    maxArrayLength: number;
    allowedFileTypes: string[];
    maxFileSize: number;
  };
  monitoring: {
    suspiciousThreshold: number;
    maxConcurrentSessions: number;
    sessionTimeoutMs: number;
  };
}

const SECURITY_CONFIG: SecurityConfig = {
  rateLimiting: {
    login: { maxRequests: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 },
    api: { maxRequests: 1000, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 },
    export: { maxRequests: 10, windowMs: 60 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 },
    bulk: { maxRequests: 50, windowMs: 60 * 60 * 1000, blockDurationMs: 10 * 60 * 1000 }
  },
  validation: {
    maxStringLength: 10000,
    maxArrayLength: 1000,
    allowedFileTypes: ['.json', '.csv', '.xlsx', '.pdf'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },
  monitoring: {
    suspiciousThreshold: 100,
    maxConcurrentSessions: 5,
    sessionTimeoutMs: 30 * 60 * 1000 // 30 minutes
  }
};

// Enhanced rate limit store with cleanup
class EnhancedRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: number;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000) as unknown as number;
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string): RateLimitEntry {
    const existing = this.get(key);
    const now = Date.now();
    
    if (existing) {
      existing.count++;
      existing.lastAccess = now;
      return existing;
    }
    
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + 60 * 1000, // Default 1 minute window
      lastAccess: now
    };
    
    this.set(key, newEntry);
    return newEntry;
  }

  block(key: string, durationMs: number): void {
    const entry = this.get(key) || {
      count: 0,
      resetTime: Date.now() + 60 * 1000,
      lastAccess: Date.now()
    };
    
    entry.blockedUntil = Date.now() + durationMs;
    this.set(key, entry);
  }

  isBlocked(key: string): boolean {
    const entry = this.get(key);
    return entry ? (entry.blockedUntil ? Date.now() < entry.blockedUntil : false) : false;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime && (!entry.blockedUntil || now > entry.blockedUntil)) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const rateLimitStore = new EnhancedRateLimitStore();

export interface SecurityContext {
  userId?: string;
  tenantId?: string;
  userRole?: string;
  ipAddress?: string | null;
  userAgent?: string;
  sessionId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

export class EnhancedSecurityMiddleware {
  private static instance: EnhancedSecurityMiddleware;
  private activeSessions = new Map<string, { lastAccess: number; context: SecurityContext }>();

  private constructor() {}

  static getInstance(): EnhancedSecurityMiddleware {
    if (!EnhancedSecurityMiddleware.instance) {
      EnhancedSecurityMiddleware.instance = new EnhancedSecurityMiddleware();
    }
    return EnhancedSecurityMiddleware.instance;
  }

  // Enhanced rate limiting with progressive blocking
  async checkRateLimit(
    operation: keyof SecurityConfig['rateLimiting'],
    context: SecurityContext
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; blocked?: boolean }> {
    const config = SECURITY_CONFIG.rateLimiting[operation];
    const key = `${context.userId || 'anonymous'}_${operation}_${context.ipAddress || 'unknown'}`;
    
    // Check if currently blocked
    if (rateLimitStore.isBlocked(key)) {
      const entry = rateLimitStore.get(key);
      await logSecurityEvent(
        'rate_limit_blocked',
        `User blocked for ${operation} due to repeated violations`,
        'high',
        {
          operation,
          userId: context.userId,
          tenantId: context.tenantId,
          ipAddress: context.ipAddress,
          blockedUntil: entry?.blockedUntil
        }
      );
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry?.blockedUntil || 0,
        blocked: true
      };
    }

    const entry = rateLimitStore.increment(key);
    const now = Date.now();

    // Reset window if expired
    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + config.windowMs;
    }

    // Check if over limit
    if (entry.count > config.maxRequests) {
      // Block for specified duration
      rateLimitStore.block(key, config.blockDurationMs);
      
      await logSecurityEvent(
        'rate_limit_exceeded',
        `Rate limit exceeded for ${operation}. User blocked.`,
        'medium',
        {
          operation,
          userId: context.userId,
          tenantId: context.tenantId,
          ipAddress: context.ipAddress,
          count: entry.count,
          limit: config.maxRequests,
          blockedUntil: entry.blockedUntil
        }
      );

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.blockedUntil!,
        blocked: true
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  // Enhanced input validation with deep sanitization
  validateInput(input: any, type: 'email' | 'phone' | 'text' | 'number' | 'json' | 'array' | 'file'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (type) {
        case 'email':
          return this.validateEmail(input);

        case 'phone':
          return this.validatePhone(input);

        case 'text':
          return this.validateText(input);

        case 'number':
          return this.validateNumber(input);

        case 'json':
          return this.validateJson(input);

        case 'array':
          return this.validateArray(input);

        case 'file':
          return this.validateFile(input);

        default:
          return { isValid: false, errors: ['Unknown input type'], warnings: [] };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  private validateEmail(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input || typeof input !== 'string') {
      errors.push('Email is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    const email = input.trim().toLowerCase();
    
    // Enhanced email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    if (email.length > 254) {
      errors.push('Email address is too long');
    }

    // Check for suspicious patterns
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
      warnings.push('Email format may be invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: errors.length === 0 ? email : undefined
    };
  }

  private validatePhone(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input || typeof input !== 'string') {
      errors.push('Phone number is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    const phone = input.replace(/[^\d+\-\s\(\)]/g, '').trim();
    
    // Enhanced phone validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
    
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      warnings.push('Phone number format may be invalid');
    }

    if (phone.length < 10 || phone.length > 20) {
      warnings.push('Phone number length is unusual');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: phone
    };
  }

  private validateText(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input === null || input === undefined) {
      return { isValid: true, errors, warnings, sanitized: null };
    }

    if (typeof input !== 'string') {
      errors.push('Text input must be a string');
      return { isValid: false, errors, warnings };
    }

    if (input.length > SECURITY_CONFIG.validation.maxStringLength) {
      errors.push(`Text exceeds maximum length of ${SECURITY_CONFIG.validation.maxStringLength} characters`);
    }

    // Enhanced XSS and injection prevention
    const sanitized = input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Iframe tags
      .replace(/javascript:/gi, '') // JavaScript protocol
      .replace(/on\w+\s*=/gi, '') // Event handlers
      .replace(/[<>'"&]/g, '') // HTML characters
      .replace(/['";\\]/g, '') // SQL injection characters
      .trim();

    if (sanitized.length !== input.length) {
      warnings.push('Input contained potentially dangerous characters and was sanitized');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }

  private validateNumber(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input === null || input === undefined) {
      return { isValid: true, errors, warnings, sanitized: null };
    }

    const num = Number(input);
    
    if (isNaN(num) || !isFinite(num)) {
      errors.push('Invalid number');
      return { isValid: false, errors, warnings };
    }

    // Check for reasonable bounds
    if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
      warnings.push('Number exceeds safe integer range');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: num
    };
  }

  private validateJson(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input === null || input === undefined) {
      return { isValid: true, errors, warnings, sanitized: null };
    }

    if (typeof input !== 'object') {
      errors.push('JSON input must be an object');
      return { isValid: false, errors, warnings };
    }

    try {
      const sanitized = this.sanitizeObject(input);
      
      // Check object size
      const jsonString = JSON.stringify(sanitized);
      if (jsonString.length > SECURITY_CONFIG.validation.maxStringLength) {
        errors.push('JSON object is too large');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitized
      };
    } catch (error) {
      errors.push('JSON validation failed');
      return { isValid: false, errors, warnings };
    }
  }

  private validateArray(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(input)) {
      errors.push('Input must be an array');
      return { isValid: false, errors, warnings };
    }

    if (input.length > SECURITY_CONFIG.validation.maxArrayLength) {
      errors.push(`Array exceeds maximum length of ${SECURITY_CONFIG.validation.maxArrayLength}`);
    }

    // Sanitize each element
    const sanitized = input.map((item, index) => {
      if (typeof item === 'string') {
        const result = this.validateText(item);
        if (!result.isValid) {
          errors.push(`Array element ${index}: ${result.errors.join(', ')}`);
        }
        return result.sanitized;
      } else if (typeof item === 'object' && item !== null) {
        return this.sanitizeObject(item);
      }
      return item;
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }

  private validateFile(input: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!(input instanceof File)) {
      errors.push('Input must be a File object');
      return { isValid: false, errors, warnings };
    }

    // Check file size
    if (input.size > SECURITY_CONFIG.validation.maxFileSize) {
      errors.push(`File size exceeds maximum of ${SECURITY_CONFIG.validation.maxFileSize} bytes`);
    }

    // Check file type
    const fileExtension = '.' + input.name.split('.').pop()?.toLowerCase();
    if (!SECURITY_CONFIG.validation.allowedFileTypes.includes(fileExtension)) {
      errors.push(`File type ${fileExtension} is not allowed`);
    }

    // Check for executable files
    const executableExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    if (executableExtensions.some(ext => input.name.toLowerCase().endsWith(ext))) {
      errors.push('Executable files are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const sanitizedKey = key.replace(/[<>'"&;'"\\]/g, '').trim();
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = value.replace(/[\x00-\x1F\x7F]/g, '').replace(/[<>'"&;'"\\]/g, '').trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    return sanitized;
  }

  // Session management
  async validateSession(context: SecurityContext): Promise<{ valid: boolean; error?: string }> {
    if (!context.sessionId || !context.userId) {
      return { valid: false, error: 'Invalid session context' };
    }

    const session = this.activeSessions.get(context.sessionId);
    const now = Date.now();

    if (!session) {
      // Check for too many active sessions
      const userSessions = Array.from(this.activeSessions.entries())
        .filter(([_, s]) => s.context.userId === context.userId);

      if (userSessions.length >= SECURITY_CONFIG.monitoring.maxConcurrentSessions) {
        await logSecurityEvent(
          'too_many_sessions',
          'User exceeded maximum concurrent sessions',
          'medium',
          {
            userId: context.userId,
            tenantId: context.tenantId,
            sessionCount: userSessions.length
          }
        );
        return { valid: false, error: 'Too many active sessions' };
      }

      // Create new session
      this.activeSessions.set(context.sessionId, {
        lastAccess: now,
        context
      });
      return { valid: true };
    }

    // Check session timeout
    if (now - session.lastAccess > SECURITY_CONFIG.monitoring.sessionTimeoutMs) {
      this.activeSessions.delete(context.sessionId);
      await logSecurityEvent(
        'session_expired',
        'Session expired due to inactivity',
        'low',
        {
          userId: context.userId,
          tenantId: context.tenantId,
          sessionId: context.sessionId
        }
      );
      return { valid: false, error: 'Session expired' };
    }

    // Update last access
    session.lastAccess = now;
    return { valid: true };
  }

  // Comprehensive security middleware
  async executeSecurityCheck(
    operation: keyof SecurityConfig['rateLimiting'],
    context: SecurityContext,
    inputs?: Array<{ value: any; type: string }>,
    requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer'
  ): Promise<{ authorized: boolean; error?: string; validations?: ValidationResult[] }> {
    const validations: ValidationResult[] = [];

    try {
      // 1. Session validation
      const sessionResult = await this.validateSession(context);
      if (!sessionResult.valid) {
        return { authorized: false, error: sessionResult.error };
      }

      // 2. Rate limiting
      const rateLimitResult = await this.checkRateLimit(operation, context);
      if (!rateLimitResult.allowed) {
        return {
          authorized: false,
          error: rateLimitResult.blocked 
            ? 'Access temporarily blocked due to repeated violations' 
            : 'Rate limit exceeded. Please try again later.'
        };
      }

      // 3. Input validation
      if (inputs) {
        for (const input of inputs) {
          const validation = this.validateInput(input.value, input.type as any);
          validations.push(validation);
          
          if (!validation.isValid) {
            await logSecurityEvent(
              'invalid_input',
              `Invalid input detected for ${operation}`,
              'medium',
              {
                operation,
                userId: context.userId,
                tenantId: context.tenantId,
                errors: validation.errors,
                inputType: input.type
              }
            );
            return {
              authorized: false,
              error: `Invalid input: ${validation.errors.join(', ')}`,
              validations
            };
          }
        }
      }

      // 4. Role validation (if required)
      if (requiredRole && context.userId && context.tenantId) {
        try {
          const { data, error } = await supabase.rpc('verify_role_permission', {
            required_role: requiredRole
          });

          if (error || !data) {
            await logSecurityEvent(
              'unauthorized_access',
              `User attempted unauthorized access to ${operation}`,
              'high',
              {
                operation,
                requiredRole,
                userId: context.userId,
                tenantId: context.tenantId,
                userRole: context.userRole
              }
            );
            return {
              authorized: false,
              error: `Insufficient permissions. ${requiredRole} role required.`,
              validations
            };
          }
        } catch (error) {
          await logSecurityEvent(
            'role_validation_error',
            'Role validation system error',
            'high',
            {
              operation,
              requiredRole,
              error: String(error)
            }
          );
          return {
            authorized: false,
            error: 'Authorization system error. Please try again.',
            validations
          };
        }
      }

      return { authorized: true, validations };
    } catch (error) {
      await logSecurityEvent(
        'security_middleware_error',
        'Security middleware encountered an error',
        'high',
        {
          operation,
          error: String(error),
          userId: context.userId,
          tenantId: context.tenantId
        }
      );
      return {
        authorized: false,
        error: 'Security validation failed. Please try again.'
      };
    }
  }

  // Cleanup method
  destroy(): void {
    rateLimitStore.destroy();
    this.activeSessions.clear();
  }
}

// Export singleton instance
export const enhancedSecurityMiddleware = EnhancedSecurityMiddleware.getInstance();
