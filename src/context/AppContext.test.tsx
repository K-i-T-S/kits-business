import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, useApp } from './AppContext';
import { createSupabaseMock, tenantManagerMock } from '../test-utils/mocks';

// Use global mocks from vitest.setup.ts
// Mock is already configured globally

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when useApp is called outside provider', () => {
    expect(() => renderHook(() => useApp())).toThrow(
      'useApp must be used within AppProvider',
    );
  });

  it('provides default values when wrapped in AppProvider', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    // Wait for async initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.products).toEqual([]);
    expect(typeof result.current.addProduct).toBe('function');
    expect(result.current.currentEmployee).toBeNull();
  });

  it('initializes with correct default state', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    // Wait for async initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.user).toBeNull();
    expect(result.current.products).toEqual([]);
    expect(result.current.sales).toEqual([]);
    expect(result.current.customers).toEqual([]);
    expect(result.current.employees).toEqual([]);
    expect(result.current.currentEmployee).toBeNull();
    expect(result.current.currentTenant).toBeNull();
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasSession).toBe(false);
  });
});
