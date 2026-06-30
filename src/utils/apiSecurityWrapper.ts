import { logSecurityEvent } from './auditLogger';
import type { SecurityContext } from './enhancedSecurityMiddleware';
import { enhancedSecurityMiddleware } from './enhancedSecurityMiddleware';
import { supabase } from './supabaseClient';

// API Security Wrapper for all database operations
export class ApiSecurityWrapper {
  private static instance: ApiSecurityWrapper;

  private constructor() {}

  static getInstance(): ApiSecurityWrapper {
    if (!ApiSecurityWrapper.instance) {
      ApiSecurityWrapper.instance = new ApiSecurityWrapper();
    }
    return ApiSecurityWrapper.instance;
  }

  private async getContext(): Promise<SecurityContext> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    return {
      userId: user?.id,
      sessionId: session?.access_token,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      tenantId: session?.user?.user_metadata?.tenant_id,
      userRole: session?.user?.user_metadata?.role,
    };
  }

  private getClientIP(): string | null {
    try {
      // In a real implementation, you'd get this from your backend
      // For now, we'll use a placeholder
      return 'client-ip';
    } catch {
      return 'unknown';
    }
  }

  // Secure database operations
  async secureQuery<T = unknown>(
    operation: 'select' | 'insert' | 'update' | 'delete',
    table: string,
    options: {
      select?: string;
      filter?: Record<string, unknown>;
      data?: Record<string, unknown>;
      upsert?: boolean;
      inputs?: Array<{ value: unknown; type: string }>;
      requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer';
    } = {},
  ): Promise<{ data: T[] | null; error: string | null }> {
    const context = await this.getContext();

    // Security check
    const securityResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'api',
      context,
      options.inputs,
      options.requiredRole,
    );

    if (!securityResult.authorized) {
      return { data: null, error: securityResult.error || null };
    }

    try {
      let query: any = supabase.from(table);

      switch (operation) {
        case 'select':
          if (options.select) {
            query = query.select(options.select);
          }
          if (options.filter) {
            Object.entries(options.filter).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          break;

        case 'insert':
          query = query.insert(options.data || {});
          if (options.select) {
            query = query.select(options.select);
          }
          break;

        case 'update':
          query = query.update(options.data || {});
          if (options.filter) {
            Object.entries(options.filter).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          if (options.select) {
            query = query.select(options.select);
          }
          break;

        case 'delete':
          if (options.filter) {
            Object.entries(options.filter).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          break;

        default:
          return { data: null, error: 'Invalid operation' };
      }

      const { data, error } = await (query as any);

      if (error) {
        await logSecurityEvent(
          'database_error',
          `Database operation failed: ${error.message}`,
          'medium',
          {
            operation,
            table,
            error: error.message,
            userId: context.userId,
            tenantId: context.tenantId,
          },
        );
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      await logSecurityEvent(
        'database_exception',
        `Database operation exception: ${String(error)}`,
        'high',
        {
          operation,
          table,
          error: String(error),
          userId: context.userId,
          tenantId: context.tenantId,
        },
      );
      return { data: null, error: 'Database operation failed' };
    }
  }

  // Secure RPC calls
  async secureRpc<T = unknown>(
    functionName: string,
    params: Record<string, unknown>,
    options: {
      inputs?: Array<{ value: unknown; type: string }>;
      requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer';
    } = {},
  ): Promise<{ data: T | null; error: string | null }> {
    const context = await this.getContext();

    // Security check
    const securityResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'api',
      context,
      options.inputs,
      options.requiredRole,
    );

    if (!securityResult.authorized) {
      return { data: null, error: securityResult.error || null };
    }

    try {
      const { data, error } = await supabase.rpc(functionName, params);

      if (error) {
        await logSecurityEvent(
          'rpc_error',
          `RPC call failed: ${error.message}`,
          'medium',
          {
            functionName,
            params,
            error: error.message,
            userId: context.userId,
            tenantId: context.tenantId,
          },
        );
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      await logSecurityEvent(
        'rpc_exception',
        `RPC call exception: ${String(error)}`,
        'high',
        {
          functionName,
          params,
          error: String(error),
          userId: context.userId,
          tenantId: context.tenantId,
        },
      );
      return { data: null, error: 'RPC call failed' };
    }
  }

  // Secure file upload
  async secureFileUpload(
    bucket: string,
    file: File,
    path: string,
    options: {
      requiredRole?: 'owner' | 'manager' | 'cashier' | 'viewer';
    } = {},
  ): Promise<{ data: { path: string } | null; error: string | null }> {
    const context = await this.getContext();

    // Security check with file validation
    const securityResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'bulk',
      context,
      [{ value: file, type: 'file' }],
      options.requiredRole,
    );

    if (!securityResult.authorized) {
      return { data: null, error: securityResult.error || null };
    }

    try {
      // Add tenant context to path
      const tenantPath = context.tenantId ? `${context.tenantId}/${path}` : path;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(tenantPath, file, {
          upsert: false,
        });

      if (error) {
        await logSecurityEvent(
          'file_upload_error',
          `File upload failed: ${error.message}`,
          'medium',
          {
            bucket,
            path: tenantPath,
            fileName: file.name,
            fileSize: file.size,
            error: error.message,
            userId: context.userId,
            tenantId: context.tenantId,
          },
        );
        return { data: null, error: error.message };
      }

      await logSecurityEvent(
        'file_upload_success',
        `File uploaded successfully: ${file.name}`,
        'low',
        {
          bucket,
          path: tenantPath,
          fileName: file.name,
          fileSize: file.size,
          userId: context.userId,
          tenantId: context.tenantId,
        },
      );

      return { data, error: null };
    } catch (error) {
      await logSecurityEvent(
        'file_upload_exception',
        `File upload exception: ${String(error)}`,
        'high',
        {
          bucket,
          path,
          fileName: file.name,
          error: String(error),
          userId: context.userId,
          tenantId: context.tenantId,
        },
      );
      return { data: null, error: 'File upload failed' };
    }
  }

  // Secure authentication operations
  async secureAuth(
    operation: 'signIn' | 'signUp' | 'signOut' | 'updatePassword',
    credentials: {
      email?: string;
      password?: string;
      newPassword?: string;
      options?: Record<string, unknown>;
    },
  ): Promise<{ data: unknown; error: string | null }> {
    const context = await this.getContext();

    // Validate inputs
    const inputs: Array<{ value: unknown; type: string }> = [];
    if (credentials.email) inputs.push({ value: credentials.email, type: 'email' });
    if (credentials.password) inputs.push({ value: credentials.password, type: 'text' });
    if (credentials.newPassword) inputs.push({ value: credentials.newPassword, type: 'text' });

    const securityResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'login',
      context,
      inputs,
    );

    if (!securityResult.authorized) {
      return { data: null, error: securityResult.error || null };
    }

    try {
      let result;

      switch (operation) {
        case 'signIn':
          result = await supabase.auth.signInWithPassword({
            email: credentials.email!,
            password: credentials.password!,
          });
          break;

        case 'signUp':
          result = await supabase.auth.signUp({
            email: credentials.email!,
            password: credentials.password!,
            options: credentials.options,
          });
          break;

        case 'signOut':
          result = await supabase.auth.signOut();
          break;

        case 'updatePassword':
          result = await supabase.auth.updateUser({
            password: credentials.newPassword,
          });
          break;

        default:
          return { data: null, error: 'Invalid auth operation' };
      }

      if (result.error) {
        await logSecurityEvent(
          'auth_error',
          `Authentication failed: ${result.error.message}`,
          'medium',
          {
            operation,
            error: result.error.message,
            userId: context.userId,
            tenantId: context.tenantId,
            email: credentials.email,
          },
        );
        return { data: null, error: result.error.message };
      }

      // Log successful authentication
      if (operation === 'signIn' && (result as any).data?.user) {
        await logSecurityEvent(
          'auth_success',
          'User signed in successfully',
          'low',
          {
            userId: (result as any).data.user.id,
            email: (result as any).data.user.email,
            tenantId: context.tenantId,
          },
        );
      }

      return { data: (result as any).data || null, error: null };
    } catch (error) {
      await logSecurityEvent(
        'auth_exception',
        `Authentication exception: ${String(error)}`,
        'high',
        {
          operation,
          error: String(error),
          userId: context.userId,
          tenantId: context.tenantId,
          email: credentials.email,
        },
      );
      return { data: null, error: 'Authentication failed' };
    }
  }
}

// Export singleton instance
export const apiSecurityWrapper = ApiSecurityWrapper.getInstance();
