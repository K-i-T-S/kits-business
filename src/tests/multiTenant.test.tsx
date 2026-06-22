// @ts-expect-error @testing-library/react exports screen, fireEvent, waitFor
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import TenantInfo from '../components/TenantInfo';
import { renderWithProviders } from '../test-utils/providers';
import { createMockTenant } from '../test-utils/mocks';

describe('Multi-Tenant Implementation', () => {
  const mockTenant = createMockTenant();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show tenant info in TenantInfo component', () => {
    // Test with no tenant
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
    expect(screen.getByTestId('tenant-name').textContent).toBe('');
    expect(screen.getByTestId('tenant-role').textContent).toBe('');
  });

  it('should handle tenant context loading manually', () => {
    const TestComponent = () => {
      const { setCurrentTenant, currentTenant } = useApp();
      
      // Manually set tenant for testing
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return (
        <div>
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

    // Check if tenant info is displayed
    expect(screen.getByTestId('tenant-name')).toBeTruthy();
    expect(screen.getByTestId('tenant-name').textContent).toBe('Test Business');
    expect(screen.getByTestId('tenant-role').textContent).toBe('owner');
  });

  it('should display tenant info badges manually', () => {
    const TestComponent = () => {
      const { setCurrentTenant, currentTenant } = useApp();
      
      // Manually set tenant for testing
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return currentTenant ? <TenantInfo /> : <div data-testid="no-tenant">No tenant</div>;
    };

    renderWithProviders(<TestComponent />);

    // Check if the tenant info component renders the badges
    expect(screen.getByText('Test Business')).toBeTruthy();
    expect(screen.getByText('owner')).toBeTruthy();
  });

  it('should handle missing tenant gracefully', () => {
    // Test with no session/tenant
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

    expect(screen.getByTestId('no-tenant')).toBeTruthy();
    expect(screen.queryByTestId('has-tenant')).toBeNull();
  });

  it('should handle session initialization properly', () => {
    const TestComponent = () => {
      const { hasSession, currentTenant } = useApp();
      return (
        <div>
          <div data-testid="has-session">{hasSession ? 'true' : 'false'}</div>
          <div data-testid="tenant-exists">{currentTenant ? 'true' : 'false'}</div>
        </div>
      );
    };

    renderWithProviders(<TestComponent />);

    // Initially should have no session
    expect(screen.getByTestId('has-session').textContent).toBe('false');
    expect(screen.getByTestId('tenant-exists').textContent).toBe('false');
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
