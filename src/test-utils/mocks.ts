import { vi } from 'vitest';

// Centralized Supabase mock configuration
export const createSupabaseMock = () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
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
  };
};

// Mock tenant manager with session simulation
export const tenantManagerMock = {
  getCurrentUserTenant: vi.fn().mockImplementation(() => {
    // Return null by default to simulate no authenticated user
    return Promise.resolve(null);
  }),
};

// Helper to create mock tenant
export const createMockTenant = (overrides = {}) => ({
  id: 'test-tenant-id',
  name: 'Test Business',
  slug: 'test-business',
  userRole: 'owner' as const,
  settings: {},
  ...overrides,
});

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Helper to create mock session
export const createMockSession = (overrides = {}) => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    ...overrides,
  },
  access_token: 'test-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() / 1000 + 3600,
});

// Helper to mock authenticated session
export const setupMockSession = (tenant?: any) => {
  const mockSession = createMockSession();
  const mockSupabase = createSupabaseMock().supabase;
  
  // Mock getSession to return authenticated session
  mockSupabase.auth.getSession.mockResolvedValue({ 
    data: { session: mockSession }, 
    error: null 
  });
  
  // Mock tenant manager to return tenant if provided
  if (tenant) {
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(tenant);
  } else {
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(null);
  }
  
  return { mockSession, mockSupabase };
};
