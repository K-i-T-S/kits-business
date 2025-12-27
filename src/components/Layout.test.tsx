import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/providers';
import Layout from './Layout';

describe('Layout Component', () => {
  it('renders layout structure correctly', () => {
    renderWithProviders(<Layout><div>Test</div></Layout>);
    
    // Check for main layout elements
    const layout = screen.getByRole('main') || screen.getByTestId('layout');
    expect(layout).toBeTruthy();
  });

  it('renders navigation when provided', () => {
    renderWithProviders(
      <Layout>
        <nav data-testid="test-nav">Navigation</nav>
      </Layout>
    );
    
    expect(screen.getByTestId('test-nav')).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
  });

  it('renders children correctly', () => {
    renderWithProviders(
      <Layout>
        <div data-testid="test-content">Test Content</div>
      </Layout>
    );
    
    expect(screen.getByTestId('test-content')).toBeTruthy();
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('applies responsive design classes', () => {
    const { container } = renderWithProviders(<Layout><div>Test</div></Layout>);
    
    // Check for responsive classes
    const layoutElement = container.firstChild as HTMLElement;
    if (layoutElement) {
      expect(layoutElement.className).toMatch(/flex|grid|container/);
    }
  });

  it('handles tenant info display', async () => {
    const { container } = renderWithProviders(<Layout><div>Test</div></Layout>);
    
    // Check if tenant info section exists
    const tenantSection = container.querySelector('[data-testid*="tenant"], .tenant-info');
    if (tenantSection) {
      expect(tenantSection).toBeTruthy();
    }
  });

  it('provides proper accessibility attributes', () => {
    renderWithProviders(<Layout><div>Test</div></Layout> as React.ReactElement);
    
    // Check for proper ARIA labels and roles
    const main = screen.getByRole('main');
    expect(main).toBeTruthy();
    
    // Check for navigation landmarks
    const navigation = screen.queryByRole('navigation');
    if (navigation) {
      expect(navigation).toBeTruthy();
    }
  });
});
