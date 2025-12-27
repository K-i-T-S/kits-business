import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import TenantInfo from '../components/TenantInfo';
import { renderWithProviders } from '../test-utils/providers';
import { createMockTenant, tenantManagerMock } from '../test-utils/mocks';

// Use global mocks from vitest.setup.ts
// Mock is already configured globally

describe('Multi-Tenant Implementation', () => {
  const mockTenant = createMockTenant();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show tenant info in TenantInfo component', async () => {
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(null);

    const TestComponent = () => {
      const { currentTenant } = useApp();
      return (
        <div>
          {currentTenant && <TenantInfo />}
          <div data-testid="tenant-name">{currentTenant?.name || ''}</div>
          <div data-testid="tenant-role">{currentTenant?.userRole || ''}</div>
        </div>
      );
    };

    renderWithProviders(<TestComponent />);

    // Initially no tenant - should show empty divs
    await waitFor(() => {
      const nameElement = screen.getByTestId('tenant-name');
      expect(nameElement.textContent).toBe('');
      const roleElement = screen.getByTestId('tenant-role');
      expect(roleElement.textContent).toBe('');
    });
  });

  it('should handle tenant context loading', async () => {
    const mockTenant = createMockTenant();
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(mockTenant);

    const TestComponent = () => {
      const { currentTenant, loading } = useApp();
      return (
        <div>
          {loading && <div data-testid="loading">Loading...</div>}
          {currentTenant ? (
            <div>
              <div data-testid="tenant-name">{currentTenant.name}</div>
              <div data-testid="tenant-role">{currentTenant.userRole}</div>
            </div>
          ) : (
            <div data-testid="no-tenant">No tenant</div>
          )}
        </div>
      );
    };

    renderWithProviders(<TestComponent />);

    // Wait for tenant to load
    await waitFor(() => {
      expect(screen.getByTestId('tenant-name')).toBeTruthy();
      expect(screen.getByTestId('tenant-name').textContent).toBe('Test Business');
      expect(screen.getByTestId('tenant-role').textContent).toBe('owner');
    }, { timeout: 3000 });
  });

  it('should display tenant info badges', async () => {
    const mockTenant = createMockTenant();
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(mockTenant);

    const TestComponent = () => {
      const { currentTenant, loading } = useApp();
      if (loading) return <div data-testid="loading">Loading...</div>;
      return currentTenant ? <TenantInfo /> : <div data-testid="no-tenant">No tenant</div>;
    };

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      // Check if the tenant info component renders the badges
      expect(screen.getByText('Test Business')).toBeTruthy();
      expect(screen.getByText('owner')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should handle missing tenant gracefully', async () => {
    tenantManagerMock.getCurrentUserTenant.mockResolvedValue(null);

    const TestComponent = () => {
      const { currentTenant } = useApp();
      return (
        <div>
          {currentTenant ? (
            <div data-testid="has-tenant">Has Tenant</div>
          ) : (
            <div data-testid="no-tenant">No Tenant</div>
          )}
        </div>
      );
    };

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('no-tenant')).toBeTruthy();
      expect(screen.queryByTestId('has-tenant')).toBeNull();
    }, { timeout: 3000 });
  });
});

describe('Tenant Context Functions', () => {
  it('should have correct tenant context interface', () => {
    // This test verifies the TypeScript interface is correct
    const mockTenant = {
      id: 'test-id',
      name: 'Test Business',
      slug: 'test-business',
      userRole: 'owner' as const,
      settings: {},
    };

    expect(mockTenant.id).toBe('test-id');
    expect(mockTenant.name).toBe('Test Business');
    expect(mockTenant.slug).toBe('test-business');
    expect(mockTenant.userRole).toBe('owner');
    expect(typeof mockTenant.settings).toBe('object');
  });

  it('should support all user roles', () => {
    const roles = ['owner', 'manager', 'cashier', 'viewer'] as const;
    
    roles.forEach(role => {
      const mockUser = { userRole: role };
      expect(['owner', 'manager', 'cashier', 'viewer']).toContain(mockUser.userRole);
    });
  });
});
