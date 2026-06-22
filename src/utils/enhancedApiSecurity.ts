import { securityMiddleware } from './securityMiddleware';
import { api } from './supabaseClient';

// Enhanced API security wrapper
export class ApiSecurityWrapper {
  private static instance: ApiSecurityWrapper;

  static getInstance(): ApiSecurityWrapper {
    if (!ApiSecurityWrapper.instance) {
      ApiSecurityWrapper.instance = new ApiSecurityWrapper();
    }
    return ApiSecurityWrapper.instance;
  }

  // Wrap all API calls with security middleware
  async secureApiCall<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer',
  ): Promise<T> {
    // Get current session for context
    const session = await api.get('/auth/session').catch(() => null);
    const context = {
      userId: session?.user?.id,
      tenantId: session?.tenant?.id,
      userRole: session?.tenant?.userRole,
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
    };

    // Apply security middleware
    const securityResult = await securityMiddleware.apiMiddleware(
      `${method}_${endpoint}`,
      context,
      requiredRole,
    );

    if (!securityResult.authorized) {
      throw new Error(securityResult.error || 'Unauthorized access');
    }

    // Validate and sanitize input data
    if (data && (method === 'POST' || method === 'PUT')) {
      const validation = securityMiddleware.validateInput(data, 'json');
      if (!validation.valid) {
        throw new Error(`Invalid input: ${validation.error}`);
      }
      data = validation.sanitized;
    }

    // Make the actual API call
    try {
      let result: T;
      switch (method) {
        case 'GET':
          result = await api.get(endpoint);
          break;
        case 'POST':
          result = await api.post(endpoint, data);
          break;
        case 'PUT':
          result = await api.put(endpoint, data);
          break;
        case 'DELETE':
          result = await api.delete(endpoint);
          break;
        default:
          throw new Error('Unsupported HTTP method');
      }

      // Audit sensitive operations
      await securityMiddleware.auditSensitiveOperation(
        `${method}_${endpoint}`,
        context,
        { endpoint, method, data: data ? 'present' : 'none' },
      );

      return result;
    } catch (error) {
      // Log security-relevant errors
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        await securityMiddleware.auditSensitiveOperation(
          'unauthorized_api_attempt',
          context,
          { endpoint, method, error: error.message },
        );
      }
      throw error;
    }
  }

  private getClientIP(): string {
    try {
      // In a real implementation, this would get the client IP from the request
      // For now, we'll use a placeholder
      return 'client-ip';
    } catch {
      return 'unknown';
    }
  }
}

// Export singleton instance
export const apiSecurity = ApiSecurityWrapper.getInstance();

// Enhanced API functions with security
export const secureApi = {
  get: <T>(endpoint: string, requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer') =>
    apiSecurity.secureApiCall<T>('GET', endpoint, undefined, requiredRole),

  post: <T>(endpoint: string, data: any, requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer') =>
    apiSecurity.secureApiCall<T>('POST', endpoint, data, requiredRole),

  put: <T>(endpoint: string, data: any, requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer') =>
    apiSecurity.secureApiCall<T>('PUT', endpoint, data, requiredRole),

  delete: <T>(endpoint: string, requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer') =>
    apiSecurity.secureApiCall<T>('DELETE', endpoint, undefined, requiredRole),
};
