
import { SecurityValidator } from './enhancedValidation';
import { securityMonitor } from './securityMonitor';

// Enhanced security utilities for frontend components
export class FrontendSecurity {
  // Secure form validation
  static validateFormInput(input: any, type: 'product' | 'customer' | 'employee' | 'sale'): {
    isValid: boolean;
    validatedData?: any;
    errors: string[];
  } {
    try {
      let validatedData;

      switch (type) {
        case 'product':
          validatedData = SecurityValidator.validateProduct(input);
          break;
        case 'customer':
          validatedData = SecurityValidator.validateCustomer(input);
          break;
        case 'employee':
          validatedData = SecurityValidator.validateEmployee(input);
          break;
        case 'sale':
          validatedData = SecurityValidator.validateSale(input);
          break;
        default:
          return { isValid: false, errors: ['Unknown validation type'] };
      }

      return { isValid: true, validatedData, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: error instanceof Error ? [error.message] : ['Validation failed'],
      };
    }
  }

  // XSS protection for dynamic content
  static sanitizeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // Safe JSON parsing with validation
  static safeJsonParse(jsonString: string, _schema?: any): any {
    try {
      const parsed = JSON.parse(jsonString);

      // Basic validation to prevent prototype pollution
      if (parsed && typeof parsed === 'object') {
        return this.preventPrototypePollution(parsed);
      }

      return parsed;
    } catch (_error) {
      throw new Error('Invalid JSON format');
    }
  }

  private static preventPrototypePollution(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    // Check for dangerous keys
    const dangerousKeys = ['__proto__', 'prototype', 'constructor'];

    if (Array.isArray(obj)) {
      return obj.map(item => this.preventPrototypePollution(item));
    }

    const safe: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!dangerousKeys.includes(key)) {
        safe[key] = this.preventPrototypePollution(value);
      }
    }

    return safe;
  }

  // Secure local storage with encryption
  static secureStorage = {
    set: (key: string, value: any): void => {
      try {
        const encrypted = btoa(JSON.stringify(value));
        localStorage.setItem(`secure_${key}`, encrypted);
      } catch (error) {
        console.error('Failed to store data securely:', error);
      }
    },

    get: <T>(key: string): T | null => {
      try {
        const encrypted = localStorage.getItem(`secure_${key}`);
        if (!encrypted) return null;

        const decrypted = JSON.parse(atob(encrypted));
        return decrypted as T;
      } catch (error) {
        console.error('Failed to retrieve secure data:', error);
        return null;
      }
    },

    remove: (key: string): void => {
      try {
        localStorage.removeItem(`secure_${key}`);
      } catch (error) {
        console.error('Failed to remove secure data:', error);
      }
    },

    clear: (): void => {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('secure_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.error('Failed to clear secure storage:', error);
      }
    },
  };

  // CSRF protection
  static generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static verifyCSRFToken(token: string, storedToken: string): boolean {
    return token === storedToken;
  }

  // Session security
  static sessionSecurity = {
    isSessionValid: (): boolean => {
      const sessionStart = localStorage.getItem('session_start');
      if (!sessionStart) return false;

      const sessionAge = Date.now() - parseInt(sessionStart);
      const maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours

      return sessionAge < maxSessionAge;
    },

    extendSession: (): void => {
      localStorage.setItem('session_start', Date.now().toString());
    },

    invalidateSession: (): void => {
      localStorage.removeItem('session_start');
      localStorage.removeItem('auth_token');
      FrontendSecurity.secureStorage.clear();
    },
  };

  // Security event reporting
  static reportSecurityEvent(
    eventType: string,
    details?: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): void {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.warn(`Security Event [${severity}]: ${eventType}`, details);
    }

    // Report to security monitor
    void securityMonitor.monitorSecurityEvent(eventType, details?.userId, details?.tenantId, details);
  }

  // Input sanitization for user inputs
  static sanitizeInput(input: string, type: 'text' | 'email' | 'phone' | 'number' = 'text'): string {
    switch (type) {
      case 'email':
        return input.toLowerCase().trim().replace(/[<>'"&]/g, '');
      case 'phone':
        return input.replace(/[^\d\s\-\+\(\)]/g, '').trim();
      case 'number':
        return input.replace(/[^\d.-]/g, '');
      case 'text':
      default:
        return input.replace(/[<>'"&]/g, '').trim();
    }
  }

  // Password strength validation
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password should be at least 8 characters long');

    if (password.length >= 12) score += 1;
    else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    // Check for common patterns
    if (/^(.)\1+$/.test(password)) {
      score -= 2;
      feedback.push('Avoid repeating characters');
    }

    if (/123|abc|qwe/i.test(password)) {
      score -= 1;
      feedback.push('Avoid common sequences');
    }

    const isValid = score >= 4 && password.length >= 8;

    return { isValid, score: Math.max(0, score), feedback };
  }

  // Secure URL validation
  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // File upload security
  static validateFileUpload(file: File): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/csv'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      errors.push('File type not allowed');
    }

    if (file.size > maxSize) {
      errors.push('File size exceeds 5MB limit');
    }

    // Check file name for suspicious patterns
    if (/\.(exe|bat|cmd|scr|pif|com)$/i.test(file.name)) {
      errors.push('Executable files not allowed');
    }

    if (/[<>'"&]/.test(file.name)) {
      errors.push('Invalid characters in file name');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export for easy use in components
export const useSecurity = () => ({
  validateForm: FrontendSecurity.validateFormInput,
  sanitizeHtml: FrontendSecurity.sanitizeHtml,
  safeJsonParse: FrontendSecurity.safeJsonParse,
  secureStorage: FrontendSecurity.secureStorage,
  generateCSRFToken: FrontendSecurity.generateCSRFToken,
  verifyCSRFToken: FrontendSecurity.verifyCSRFToken,
  sessionSecurity: FrontendSecurity.sessionSecurity,
  reportEvent: FrontendSecurity.reportSecurityEvent,
  sanitizeInput: FrontendSecurity.sanitizeInput,
  validatePassword: FrontendSecurity.validatePasswordStrength,
  isValidUrl: FrontendSecurity.isValidUrl,
  validateFile: FrontendSecurity.validateFileUpload,
});
