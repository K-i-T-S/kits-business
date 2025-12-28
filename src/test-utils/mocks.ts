import { vi } from 'vitest';

// Types for authentication mocking
export interface MockUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface MockTenant {
  id: string;
  name: string;
  slug: string;
  userRole: 'owner' | 'manager' | 'cashier' | 'viewer';
  user_active: boolean;
  tenant_active: boolean;
  settings: Record<string, unknown>;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Centralized Supabase mock configuration
export const createSupabaseMock = () => {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };

  const mockSupabase = {
    auth: mockAuth,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  const mockApi = {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ products: [], sales: [], customers: [], employees: [] }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };

  return {
    supabase: mockSupabase,
    api: mockApi,
    auth: mockAuth,
  };
};

// Authentication state management for tests
export class AuthMockManager {
  private mockAuth: any;
  private mockTenant: any;

  constructor() {
    const { supabase, auth } = createSupabaseMock();
    this.mockAuth = auth;
    this.mockTenant = tenantManagerMock;
  }

  // Set unauthenticated state
  setUnauthenticated() {
    this.mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    this.mockTenant.getCurrentUserTenant.mockResolvedValue(null);
  }

  // Set authenticated state with user
  setAuthenticated(user?: Partial<MockUser>, tenant?: Partial<MockTenant>) {
    const mockUser = this.createMockUser(user);
    const mockSession = this.createMockSession(mockUser);
    const mockTenantData = tenant ? this.createMockTenant(tenant) : null;

    this.mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    this.mockTenant.getCurrentUserTenant.mockResolvedValue(mockTenantData);

    return { mockUser, mockSession, mockTenant: mockTenantData };
  }

  // Set multi-tenant user
  setMultiTenantUser(user?: Partial<MockUser>, tenants?: Partial<MockTenant>[]) {
    const mockUser = this.createMockUser(user);
    const mockSession = this.createMockSession(mockUser);
    const mockTenants = tenants?.map(t => this.createMockTenant(t)) || [this.createMockTenant()];

    this.mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    this.mockTenant.getCurrentUserTenant.mockResolvedValue(mockTenants[0]);

    // Mock multiple tenants for switching
    this.mockTenant.getUserTenants = vi.fn().mockResolvedValue(mockTenants);

    return { mockUser, mockSession, mockTenants };
  }

  // Simulate login success
  simulateLogin(user?: Partial<MockUser>) {
    const mockUser = this.createMockUser(user);
    const mockSession = this.createMockSession(mockUser);
    
    this.mockAuth.signInWithPassword.mockResolvedValue({ 
      data: { session: mockSession, user: mockUser }, 
      error: null 
    });

    return { mockUser, mockSession };
  }

  // Simulate login failure
  simulateLoginError(error: string = 'Invalid credentials') {
    this.mockAuth.signInWithPassword.mockResolvedValue({ 
      data: { session: null, user: null }, 
      error: { message: error } 
    });
  }

  // Simulate session expiration
  simulateSessionExpiration() {
    this.mockAuth.refreshSession.mockResolvedValue({ 
      data: { session: null }, 
      error: { message: 'Session expired' } 
    });
  }

  // Trigger auth state change (for testing auth state listeners)
  triggerAuthStateChange(session: MockSession | null, callback?: any) {
    const mockCallback = callback || vi.fn();
    const subscription = this.mockAuth.onAuthStateChange(mockCallback);
    
    // Simulate the callback being called with the new session
    if (session) {
      mockCallback('SIGNED_IN', session);
    } else {
      mockCallback('SIGNED_OUT', null);
    }

    return subscription;
  }

  // Reset all mocks
  reset() {
    vi.clearAllMocks();
    this.setUnauthenticated();
  }

  private createMockUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'authenticated',
      user_metadata: { name: 'Test User' },
      app_metadata: {},
      ...overrides,
    };
  }

  private createMockSession(user: MockUser): MockSession {
    return {
      user,
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  private createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
    return {
      id: 'test-tenant-id',
      name: 'Test Business',
      slug: 'test-business',
      userRole: 'owner',
      user_active: true,
      tenant_active: true,
      settings: {},
      ...overrides,
    };
  }
}

// Mock tenant manager with session simulation
export const tenantManagerMock = {
  getCurrentUserTenant: vi.fn().mockImplementation(() => {
    // Return null by default to simulate no authenticated user
    return Promise.resolve(null);
  }),
  getUserTenants: vi.fn().mockResolvedValue([]),
  switchTenant: vi.fn().mockResolvedValue({}),
  validateTenantAccess: vi.fn().mockResolvedValue(true),
};

// Helper to create mock tenant
export const createMockTenant = (overrides: Partial<MockTenant> = {}): MockTenant => ({
  id: 'test-tenant-id',
  name: 'Test Business',
  slug: 'test-business',
  userRole: 'owner',
  user_active: true,
  tenant_active: true,
  settings: {},
  ...overrides,
});

// Helper to create mock user
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'authenticated',
  user_metadata: { name: 'Test User' },
  app_metadata: {},
  ...overrides,
});

// Helper to create mock session
export const createMockSession = (overrides: Partial<MockUser> = {}): MockSession => ({
  user: createMockUser(overrides),
  access_token: 'test-token',
  refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});

// Helper to mock authenticated session
export const setupMockSession = (tenant?: Partial<MockTenant>) => {
  const mockSession = createMockSession();
  const { supabase: mockSupabase } = createSupabaseMock();
  
  // Mock getSession to return authenticated session
  mockSupabase.auth.getSession.mockResolvedValue({ 
    data: { session: mockSession }, 
    error: null 
  });
  
  // Mock tenant manager to return tenant if provided
  if (tenant) {
    const mockTenant = createMockTenant(tenant);
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(mockTenant);
  } else {
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(null);
  }
  
  return { mockSession, mockSupabase };
};

// Pre-configured auth scenarios
export const authScenarios = {
  // Unauthenticated user scenario
  unauthenticated: () => {
    const manager = new AuthMockManager();
    manager.setUnauthenticated();
    return manager;
  },

  // Basic authenticated user
  authenticated: (user?: Partial<MockUser>, tenant?: Partial<MockTenant>) => {
    const manager = new AuthMockManager();
    return manager.setAuthenticated(user, tenant);
  },

  // Multi-tenant user
  multiTenant: (user?: Partial<MockUser>, tenants?: Partial<MockTenant>[]) => {
    const manager = new AuthMockManager();
    return manager.setMultiTenantUser(user, tenants);
  },

  // Admin user
  admin: (user?: Partial<MockUser>, tenant?: Partial<MockTenant>) => {
    const manager = new AuthMockManager();
    return manager.setAuthenticated(user, { ...tenant, userRole: 'manager' });
  },

  // Employee user
  employee: (user?: Partial<MockUser>, tenant?: Partial<MockTenant>) => {
    const manager = new AuthMockManager();
    return manager.setAuthenticated(user, { ...tenant, userRole: 'cashier' });
  },

  // Viewer user (read-only)
  viewer: (user?: Partial<MockUser>, tenant?: Partial<MockTenant>) => {
    const manager = new AuthMockManager();
    return manager.setAuthenticated(user, { ...tenant, userRole: 'viewer' });
  },
};

// Test utilities for authentication
export const authTestUtils = {
  // Wait for auth state to settle in tests
  waitForAuth: async (timeout = 1000) => {
    await new Promise(resolve => setTimeout(resolve, timeout));
  },

  // Mock common auth errors
  errors: {
    invalidCredentials: 'Invalid login credentials',
    sessionExpired: 'Session has expired',
    emailNotConfirmed: 'Email not confirmed',
    userNotFound: 'User not found',
    tenantNotFound: 'Tenant not found',
    accessDenied: 'Access denied',
  },

  // Create mock auth error response
  createAuthError: (message: string, code?: string) => ({
    error: { message, code },
    data: { session: null, user: null },
  }),
};
