import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createSupabaseMock, tenantManagerMock } from './src/test-utils/mocks';

// Global Supabase mock
vi.mock('./src/utils/supabaseClient', () => createSupabaseMock());

// Global tenant manager mock
vi.mock('./src/utils/tenantManager', () => tenantManagerMock);
