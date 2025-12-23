import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, useApp } from './AppContext';

vi.mock('../utils/supabaseClient', () => {
  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe } },
  });
  const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

  return {
    supabase: {
      auth: {
        getSession,
        onAuthStateChange,
      },
    },
    api: {
      post: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ products: [], sales: [], customers: [], employees: [] }),
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  it('throws when useApp is called outside provider', () => {
    expect(() => renderHook(() => useApp())).toThrow(
      'useApp must be used within AppProvider',
    );
  });

  it('provides default values when wrapped in AppProvider', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    expect(result.current.products).toEqual([]);
    expect(typeof result.current.addProduct).toBe('function');
    expect(result.current.currentEmployee).toBeNull();
  });
});
