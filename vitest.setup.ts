import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createSupabaseMock, tenantManagerMock } from './src/test-utils/mocks';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Global Supabase mock
vi.mock('./src/utils/supabaseClient', () => createSupabaseMock());

// Global tenant manager mock with proper implementation
vi.mock('./src/utils/tenantManager', () => ({
  getCurrentUserTenant: tenantManagerMock.getCurrentUserTenant,
  switchTenant: vi.fn(),
  validateTenantAccess: vi.fn(),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => {
  const mockQueryClient = {
    queryCache: { clear: vi.fn() },
    mutationCache: { clear: vi.fn() },
    clear: vi.fn(),
  };
  
  function MockQueryClient(options?: any) {
    return mockQueryClient;
  }
  
  MockQueryClient.prototype = mockQueryClient;
  
  return {
    QueryClient: MockQueryClient as any,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn().mockReturnValue(mockQueryClient),
  };
});

// Mock CSS modules and Tailwind classes
vi.mock('tailwindcss', () => ({
  default: () => ({}),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock accessibility utilities
vi.mock('./src/utils/accessibility', () => ({
  FocusManager: {
    init: vi.fn(),
    cleanup: vi.fn(),
  },
  ScreenReaderAnnouncer: {
    initialize: vi.fn(),
    announce: vi.fn(),
  },
  KeyboardNavigation: {
    init: vi.fn(),
    cleanup: vi.fn(),
  },
  HighContrastMode: {
    init: vi.fn(),
    cleanup: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(false),
  },
  AccessibilityConstants: {
    FOCUSABLE_ELEMENTS: 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// Mock i18next
vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn(),
  },
  createInstance: vi.fn().mockReturnValue({
    use: vi.fn().mockReturnThis(),
    init: vi.fn(),
  }),
}));

// Mock i18next-browser-languagedetector
vi.mock('i18next-browser-languagedetector', () => ({
  default: vi.fn(),
}));

// Mock i18next-http-backend
vi.mock('i18next-http-backend', () => ({
  default: vi.fn(),
}));
