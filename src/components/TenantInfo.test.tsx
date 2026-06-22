// @ts-expect-error @testing-library/react exports screen, fireEvent, waitFor
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/providers';
import { createMockTenant, setupMockSession } from '../test-utils/mocks';
import { useApp } from '../context/AppContext';
import TenantInfo from './TenantInfo';

describe('TenantInfo Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when no tenant is provided', () => {
    const { container } = renderWithProviders(<TenantInfo />);
    // The component should render nothing, but we have wrapper divs from providers
    // So we check that the TenantInfo content is not present
    expect(container.querySelector('[data-testid="tenant-info"]')).toBeNull();
    expect(screen.queryByText('Test Business')).toBeNull();
    expect(screen.queryByText('owner')).toBeNull();
  });

  it('renders tenant name and role correctly', async () => {
    const mockTenant = createMockTenant();
    setupMockSession(mockTenant);
    
    const TestComponent = () => {
      const { setCurrentTenant } = useApp();
      
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return <TenantInfo />;
    };

    renderWithProviders(<TestComponent />);

    await screen.findByText('Test Business');
    await screen.findByText('owner');
  });

  it('applies custom className correctly', async () => {
    const mockTenant = createMockTenant();
    setupMockSession(mockTenant);
    
    const TestComponent = () => {
      const { setCurrentTenant } = useApp();
      
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return <TenantInfo className="custom-class" />;
    };

    const { container } = renderWithProviders(<TestComponent />);
    
    const tenantInfo = await screen.findByText('Test Business').then(el => el.parentElement);
    expect(tenantInfo?.className).toContain('custom-class');
  });

  it('displays tenant badges with correct structure', async () => {
    const mockTenant = createMockTenant();
    setupMockSession(mockTenant);
    
    const TestComponent = () => {
      const { setCurrentTenant } = useApp();
      
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return <TenantInfo />;
    };

    const { container } = renderWithProviders(<TestComponent />);

    const tenantNameEl = await screen.findByText('Test Business');
    const tenantRoleEl = await screen.findByText('owner');

    // Check that the elements exist and have the correct structure
    expect(tenantNameEl).toBeTruthy();
    expect(tenantRoleEl).toBeTruthy();
    
    // Check that they are wrapped in the correct container structure
    const tenantInfo = container.querySelector('.flex.items-center.space-x-2');
    expect(tenantInfo).toBeTruthy();
    expect(tenantInfo?.contains(tenantNameEl)).toBe(true);
    expect(tenantInfo?.contains(tenantRoleEl)).toBe(true);
  });
});
