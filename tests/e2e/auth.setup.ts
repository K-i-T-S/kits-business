import { test as base, expect, type Page } from '@playwright/test';
import { AuthMockManager, authScenarios, createMockUser, createMockTenant } from '../../src/test-utils/mocks';

// Define comprehensive fixtures type
type AuthFixtures = {
  authenticatedPage: Page;
  unauthenticatedPage: Page;
  adminPage: Page;
  employeePage: Page;
  viewerPage: Page;
  multiTenantPage: Page;
  authManager: AuthMockManager;
};

// Extend base test with comprehensive auth fixtures
export const test = base.extend<AuthFixtures>({
  // Auth manager fixture
  authManager: async ({}, use) => {
    const manager = new AuthMockManager();
    await use(manager);
    manager.reset();
  },

  // Standard authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    const { mockUser, mockSession, mockTenant } = manager.setAuthenticated();

    // Mock Supabase auth endpoints
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: mockUser }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: mockSession }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockTenant ? [mockTenant] : []
        })
      });
    });

    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: mockSession.access_token,
          refresh_token: mockSession.refresh_token,
          expires_in: 3600,
          token_type: 'bearer',
          user: mockUser
        })
      });
    });

    // Set mock auth state in localStorage
    await page.addInitScript((session) => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify(session));
    }, mockSession);

    await use(page);
  },

  // Unauthenticated page fixture
  unauthenticatedPage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    manager.setUnauthenticated();

    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid token'
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: null }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    await page.addInitScript(() => {
      localStorage.removeItem('sb-test-auth-token');
    });

    await use(page);
  },

  // Admin user page fixture
  adminPage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    const { mockUser, mockSession, mockTenant } = manager.setAuthenticated(
      { email: 'admin@example.com', name: 'Admin User', role: 'admin' },
      { user_role: 'admin', name: 'Admin Business' }
    );

    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { ...mockUser, role: 'admin' } }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: mockSession }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [mockTenant]
        })
      });
    });

    await page.addInitScript((session) => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify(session));
    }, mockSession);

    await use(page);
  },

  // Employee user page fixture
  employeePage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    const { mockUser, mockSession, mockTenant } = manager.setAuthenticated(
      { email: 'employee@example.com', name: 'Employee User', role: 'employee' },
      { user_role: 'employee', name: 'Employee Business' }
    );

    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: mockUser }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: mockSession }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [mockTenant]
        })
      });
    });

    await page.addInitScript((session) => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify(session));
    }, mockSession);

    await use(page);
  },

  // Viewer user page fixture (read-only)
  viewerPage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    const { mockUser, mockSession, mockTenant } = manager.setAuthenticated(
      { email: 'viewer@example.com', name: 'Viewer User', role: 'viewer' },
      { user_role: 'viewer', name: 'Viewer Business' }
    );

    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: mockUser }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: mockSession }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [mockTenant]
        })
      });
    });

    await page.addInitScript((session) => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify(session));
    }, mockSession);

    await use(page);
  },

  // Multi-tenant user page fixture
  multiTenantPage: async ({ page }, use) => {
    const manager = new AuthMockManager();
    const mockTenants = [
      createMockTenant({ id: 'tenant-1', name: 'First Business', slug: 'first-business' }),
      createMockTenant({ id: 'tenant-2', name: 'Second Business', slug: 'second-business' }),
    ];
    const { mockUser, mockSession } = manager.setMultiTenantUser(
      { email: 'multi-tenant@example.com', name: 'Multi-Tenant User' },
      mockTenants
    );

    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: mockUser }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: mockSession }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockTenants
        })
      });
    });

    await page.addInitScript((session) => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify(session));
    }, mockSession);

    await use(page);
  }
});

// Auth-specific test utilities
export const authTestUtils = {
  // Simulate login in Playwright tests
  async simulateLogin(page: Page, email: string = 'test@example.com', password: string = 'password123') {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  },

  // Simulate logout
  async simulateLogout(page: Page) {
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('/login', { timeout: 5000 });
  },

  // Wait for auth state to settle
  async waitForAuth(page: Page, timeout: number = 5000) {
    await page.waitForFunction(() => {
      return window.localStorage.getItem('sb-test-auth-token') !== null;
    }, { timeout });
  },

  // Mock API responses for authenticated user
  async mockAuthenticatedAPI(page: Page, userId: string = 'test-user-id') {
    await page.route('**/api/user/profile', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'owner'
          }
        })
      });
    });

    await page.route('**/api/tenant/current', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'test-tenant-id',
            name: 'Test Business',
            slug: 'test-business',
            user_role: 'owner'
          }
        })
      });
    });
  },

  // Mock API errors
  async mockAuthError(page: Page, endpoint: string, error: string = 'Unauthorized') {
    await page.route(`**/${endpoint}`, route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: error,
          message: error
        })
      });
    });
  },

  // Check if user is authenticated
  async isAuthenticated(page: Page): Promise<boolean> {
    const token = await page.evaluate(() => {
      return window.localStorage.getItem('sb-test-auth-token');
    });
    return token !== null;
  },

  // Get current user info from localStorage
  async getCurrentUser(page: Page) {
    return await page.evaluate(() => {
      const token = window.localStorage.getItem('sb-test-auth-token');
      if (token) {
        const session = JSON.parse(token);
        return session.user;
      }
      return null;
    });
  }
};

export { expect };
