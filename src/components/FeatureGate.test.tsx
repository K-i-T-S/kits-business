import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock Supabase before importing providers ───────────────────────────────────
vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
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
  },
}));

vi.mock('../utils/tenantManager', () => ({
  getCurrentUserTenant: vi.fn().mockResolvedValue(null),
}));

// ── Mock toast (sonner) ───────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// ── Import SubscriptionContext so we can control plan/role ────────────────────
import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import FeatureGate from './FeatureGate';
import type { Feature } from '../types/subscription';

// Helper: wrap FeatureGate in a minimal mock SubscriptionProvider
// We spy on useSubscription to inject specific plan values.
vi.mock('../context/SubscriptionContext', () => ({
  useSubscription: vi.fn(),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseSubscription = vi.mocked(useSubscription);

function makeHasFeature(plan: 'starter' | 'growth' | 'business') {
  const PLAN_FEATURES: Record<string, string[]> = {
    starter: ['pos', 'basic_reports'],
    growth: ['pos', 'basic_reports', 'advanced_analytics', 'forecasting', 'crm', 'inventory_management'],
    business: ['pos', 'basic_reports', 'advanced_analytics', 'forecasting', 'crm',
      'inventory_management', 'enterprise_dashboard', 'monitoring', 'api_webhooks', 'multi_location'],
  };
  return (feature: Feature) => (PLAN_FEATURES[plan] ?? []).includes(feature);
}

function renderFeatureGate(
  feature: Feature,
  plan: 'starter' | 'growth' | 'business',
  props: Partial<{ showLocked: boolean; compact: boolean }> = {},
) {
  mockUseSubscription.mockReturnValue({
    plan,
    status: 'active',
    role: 'owner',
    hasFeature: makeHasFeature(plan),
    isWithinLimit: () => true,
    canPerform: () => true,
    isLoading: false,
  });

  return render(
    <FeatureGate feature={feature} {...props}>
      <div data-testid="protected-content">Protected Content</div>
    </FeatureGate>,
  );
}

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user has the required feature', () => {
    it('renders children for starter features on starter plan', () => {
      renderFeatureGate('pos', 'starter');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('renders children for growth features on growth plan', () => {
      renderFeatureGate('advanced_analytics', 'growth');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('renders children for business features on business plan', () => {
      renderFeatureGate('enterprise_dashboard', 'business');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('does not render the lock icon when feature is available', () => {
      renderFeatureGate('pos', 'starter');
      expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
    });
  });

  describe('when user lacks the required feature', () => {
    it('does not render children when plan is insufficient', () => {
      renderFeatureGate('advanced_analytics', 'starter');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('renders the lock UI with upgrade button by default (showLocked=true)', () => {
      renderFeatureGate('advanced_analytics', 'starter');
      expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    });

    it('shows the feature name and required plan in the lock UI', () => {
      renderFeatureGate('advanced_analytics', 'starter');
      // The lock UI renders "Advanced Analytics requires Growth" in a paragraph element
      // The text is split across text nodes so use getAllByText to allow partial matches
      const allText = document.body.textContent ?? '';
      expect(allText).toContain('Advanced Analytics');
      expect(allText).toContain('Growth');
    });

    it('shows enterprise_dashboard lock message for starter plan', () => {
      renderFeatureGate('enterprise_dashboard', 'starter');
      expect(screen.getByText(/enterprise dashboard/i)).toBeInTheDocument();
    });

    it('shows forecasting lock message for starter plan', () => {
      renderFeatureGate('forecasting', 'starter');
      expect(screen.getByText(/forecasting/i)).toBeInTheDocument();
    });
  });

  describe('showLocked=false', () => {
    it('renders nothing when showLocked is false and feature is unavailable', () => {
      const { container } = renderFeatureGate('advanced_analytics', 'starter', { showLocked: false });
      expect(container).toBeEmptyDOMElement();
    });

    it('still renders children when showLocked is false and feature IS available', () => {
      renderFeatureGate('pos', 'starter', { showLocked: false });
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders children in dim overlay with lock badge in compact mode', () => {
      renderFeatureGate('advanced_analytics', 'starter', { compact: true });
      // compact mode renders the children in a dimmed container
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('does not render the full upgrade button in compact mode', () => {
      renderFeatureGate('advanced_analytics', 'starter', { compact: true });
      expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
    });
  });

  describe('upgrade button interaction', () => {
    it('calls toast.info when upgrade button is clicked', async () => {
      const { toast } = await import('sonner');
      renderFeatureGate('advanced_analytics', 'starter');

      const upgradeBtn = screen.getByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeBtn);

      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining('Growth'),
      );
    });
  });
});
