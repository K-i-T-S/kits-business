import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/providers';
import { createMockTenant } from '../test-utils/mocks';
import { useApp } from '../context/AppContext';
import TenantInfo from './TenantInfo';

describe('TenantInfo Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when no tenant is provided', () => {
    const { container } = renderWithProviders(<TenantInfo />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tenant name and role correctly', async () => {
    const mockTenant = createMockTenant();
    
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

  it('displays tenant badges with correct styling', async () => {
    const mockTenant = createMockTenant();
    
    const TestComponent = () => {
      const { setCurrentTenant } = useApp();
      
      React.useEffect(() => {
        setCurrentTenant(mockTenant);
      }, [setCurrentTenant]);
      
      return <TenantInfo />;
    };

    renderWithProviders(<TestComponent />);

    const tenantNameEl = await screen.findByText('Test Business');
    const tenantRoleEl = await screen.findByText('owner');

    const tenantName = tenantNameEl.parentElement;
    const tenantRole = tenantRoleEl.parentElement;
    
    if (tenantName) {
      expect((tenantName as HTMLElement).className).toContain('bg-indigo-100');
    }
    if (tenantRole) {
      expect((tenantRole as HTMLElement).className).toContain('bg-gray-100');
    }
  });
});
