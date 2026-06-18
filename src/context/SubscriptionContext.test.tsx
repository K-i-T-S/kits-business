import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────
// Use vi.hoisted to ensure mock functions are initialized before vi.mock hoisting
const { mockRpc, mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}));

vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    rpc: mockRpc,
  },
}));

import { SubscriptionProvider, useSubscription } from './SubscriptionContext';

// Helper wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SubscriptionProvider>{children}</SubscriptionProvider>
);

// Helper to seed a tenant row from the RPC
function seedTenant(plan: string, status: string, role: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
  mockRpc.mockResolvedValue({
    data: [{ subscription_plan: plan, subscription_status: status, user_role: role }],
    error: null,
  });
}

describe('SubscriptionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('defaults with no session', () => {
    it('defaults to starter plan', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      // Wait for async load
      await act(async () => { await Promise.resolve(); });
      expect(result.current.plan).toBe('starter');
    });

    it('defaults to viewer role', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.role).toBe('viewer');
    });

    it('defaults to active status', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.status).toBe('active');
    });
  });

  describe('hasFeature', () => {
    it('returns true for pos on starter plan', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.hasFeature('pos')).toBe(true);
    });

    it('returns false for advanced_analytics on starter plan', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.hasFeature('advanced_analytics')).toBe(false);
    });

    it('returns true for advanced_analytics on growth plan', async () => {
      seedTenant('growth', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.hasFeature('advanced_analytics')).toBe(true);
    });

    it('returns false for enterprise_dashboard on starter plan', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.hasFeature('enterprise_dashboard')).toBe(false);
    });

    it('returns false for enterprise_dashboard on growth plan', async () => {
      seedTenant('growth', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.hasFeature('enterprise_dashboard')).toBe(false);
    });

    it('returns true for enterprise_dashboard on business plan', async () => {
      seedTenant('business', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.hasFeature('enterprise_dashboard')).toBe(true);
    });

    it('returns true for all features on business plan', async () => {
      seedTenant('business', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.hasFeature('multi_location')).toBe(true);
      expect(result.current.hasFeature('api_webhooks')).toBe(true);
      expect(result.current.hasFeature('monitoring')).toBe(true);
    });
  });

  describe('isWithinLimit', () => {
    it('returns true for products at 49 on starter (limit 50)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('products', 49)).toBe(true);
    });

    it('returns false for products at 50 on starter (limit 50, exclusive)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      // limit 50 means currentCount < 50 → 50 is NOT within limit
      expect(result.current.isWithinLimit('products', 50)).toBe(false);
    });

    it('returns false for products at 51 on starter', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('products', 51)).toBe(false);
    });

    it('returns true for any product count on growth plan (null limit)', async () => {
      seedTenant('growth', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.isWithinLimit('products', 10000)).toBe(true);
    });

    it('returns true for customers at 99 on starter (limit 100)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('customers', 99)).toBe(true);
    });

    it('returns false for customers at 100 on starter (exclusive)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('customers', 100)).toBe(false);
    });

    it('returns true for employees at 0 on starter (limit 1)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('employees', 0)).toBe(true);
    });

    it('returns false for employees at 1 on starter (exclusive)', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isWithinLimit('employees', 1)).toBe(false);
    });

    it('returns true for unlimited employees on business plan', async () => {
      seedTenant('business', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.isWithinLimit('employees', 9999)).toBe(true);
    });
  });

  describe('canPerform', () => {
    it('viewer can view_dashboard', async () => {
      seedTenant('starter', 'active', 'viewer');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('view_dashboard')).toBe(true);
    });

    it('viewer cannot delete_product (action does not exist for viewer)', async () => {
      seedTenant('starter', 'active', 'viewer');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      // edit_products is not in viewer's allowed actions
      expect(result.current.canPerform('edit_products')).toBe(false);
    });

    it('cashier can make_sales', async () => {
      seedTenant('starter', 'active', 'cashier');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('make_sales')).toBe(true);
    });

    it('cashier cannot edit_products', async () => {
      seedTenant('starter', 'active', 'cashier');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('edit_products')).toBe(false);
    });

    it('manager can edit_products', async () => {
      seedTenant('starter', 'active', 'manager');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('edit_products')).toBe(true);
    });

    it('manager cannot access_settings', async () => {
      seedTenant('starter', 'active', 'manager');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('access_settings')).toBe(false);
    });

    it('owner can access_settings and access_enterprise', async () => {
      seedTenant('starter', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('access_settings')).toBe(true);
      expect(result.current.canPerform('access_enterprise')).toBe(true);
    });

    it('viewer cannot make_sales', async () => {
      seedTenant('starter', 'active', 'viewer');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.canPerform('make_sales')).toBe(false);
    });
  });

  describe('plan coercion for invalid values', () => {
    it('coerces unknown plan to starter', async () => {
      seedTenant('enterprise', 'active', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.plan).toBe('starter');
    });

    it('coerces unknown role to owner', async () => {
      seedTenant('starter', 'active', 'superadmin');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.role).toBe('owner');
    });

    it('coerces unknown status to active', async () => {
      seedTenant('starter', 'suspended', 'owner');
      const { result } = renderHook(() => useSubscription(), { wrapper });
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(result.current.status).toBe('active');
    });
  });

  describe('useSubscription outside provider', () => {
    it('throws when used outside SubscriptionProvider', () => {
      // Suppress expected error in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useSubscription());
      }).toThrow('useSubscription must be used inside SubscriptionProvider');
      consoleSpy.mockRestore();
    });
  });
});
