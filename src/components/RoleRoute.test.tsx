import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useSubscription } from '../context/SubscriptionContext';
import RoleRoute from './RoleRoute';
import type { RoleType } from '../types/subscription';

vi.mock('../context/SubscriptionContext', () => ({
  useSubscription: vi.fn(),
}));

const mockUseSubscription = vi.mocked(useSubscription);

function mockSubscription(role: RoleType, isLoading = false) {
  mockUseSubscription.mockReturnValue({
    plan: 'starter',
    status: 'active',
    role,
    hasFeature: () => true,
    isWithinLimit: () => true,
    canPerform: () => true,
    isLoading,
    reloadSubscription: vi.fn().mockResolvedValue(undefined),
  });
}

function renderAtRoot(allowedRoles: RoleType[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RoleRoute allowedRoles={allowedRoles}>
              <div data-testid="protected-content">Protected Content</div>
            </RoleRoute>
          }
        />
        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when the current role is allowed', () => {
    mockSubscription('owner');
    renderAtRoot(['owner', 'manager']);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when the current role is not allowed', () => {
    mockSubscription('cashier');
    renderAtRoot(['owner', 'manager']);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('renders nothing while subscription data is loading, even for a disallowed role', () => {
    mockSubscription('cashier', true);
    const { container } = renderAtRoot(['owner']);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('excludes a role not present in allowedRoles even when it is a real, valid role', () => {
    mockSubscription('viewer');
    renderAtRoot(['owner', 'manager', 'cashier']);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('allows one of the 8 canonical roles beyond the old legacy 4 (Track 1b-i widening)', () => {
    mockSubscription('supervisor');
    renderAtRoot(['owner', 'manager', 'supervisor']);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
