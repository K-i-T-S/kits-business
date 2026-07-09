import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: vi.fn(),
    },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('../context/SubscriptionContext', () => ({
  useSubscription: () => ({ reloadSubscription: vi.fn() }),
}));

// vitest.setup.ts globally mocks tenantManager with a partial stub (no
// createTenant/selectActiveTenant), which would make the component's
// selectActiveTenant import undefined. Override with the real module here so
// selectActiveTenant runs for real against our local supabaseClient mock.
vi.mock('../utils/tenantManager', async () => {
  const actual = await vi.importActual<typeof import('../utils/tenantManager')>(
    '../utils/tenantManager',
  );
  return actual;
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import TenantSelection from './TenantSelection';

function seedTwoTenants() {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1', email: 'admin@kits.test' } } },
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tenant_user_details') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              { tenant_id: 't1', tenant_name: 'Business One', tenant_slug: 'one', user_role: 'admin' },
              { tenant_id: 't2', tenant_name: 'Business Two', tenant_slug: 'two', user_role: 'admin' },
            ],
            error: null,
          }),
      };
    }
    // pending_invitations
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
  });
}

function seedOneTenant() {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1', email: 'admin@kits.test' } } },
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tenant_user_details') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              { tenant_id: 't1', tenant_name: 'Business One', tenant_slug: 'one', user_role: 'admin' },
            ],
            error: null,
          }),
      };
    }
    // pending_invitations
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
  });
}

describe('TenantSelection auto-select (single tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls select_active_tenant with the sole tenant and navigates to /dashboard', async () => {
    seedOneTenant();
    mockRpc.mockResolvedValue({ data: true, error: null });

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('select_active_tenant', { p_tenant_id: 't1' });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error toast and does not navigate when the RPC fails on the auto-select path', async () => {
    seedOneTenant();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } });
    const toastSpy = vi.spyOn(toast, 'error');

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
  });
});

describe('TenantSelection handleSelectTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls select_active_tenant with the chosen tenant before navigating', async () => {
    seedTwoTenants();
    mockRpc.mockResolvedValue({ data: true, error: null });

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    const businessOne = await screen.findByText('Business One');
    await userEvent.click(businessOne);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('select_active_tenant', { p_tenant_id: 't1' });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an error toast and does not navigate when the RPC fails', async () => {
    seedTwoTenants();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } });
    const toastSpy = vi.spyOn(toast, 'error');

    render(
      <MemoryRouter>
        <TenantSelection />
      </MemoryRouter>,
    );

    const businessTwo = await screen.findByText('Business Two');
    await userEvent.click(businessTwo);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
  });
});
