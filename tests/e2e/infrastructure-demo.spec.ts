import { test, expect } from './test.setup';
import { testUtils } from './test.setup';

// Example test demonstrating the new infrastructure
test.describe('Testing Infrastructure Demo', () => {
  test.beforeEach(async ({ page }) => {
    // Set up consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('unauthenticated user sees login page', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check login form elements
    await testUtils.assertions.expectVisible(page, '[data-testid="email-input"]');
    await testUtils.assertions.expectVisible(page, '[data-testid="password-input"]');
    await testUtils.assertions.expectVisible(page, '[data-testid="login-button"]');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('login-page.png');
  });

  test('authenticated user sees dashboard', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Check dashboard elements
    await testUtils.assertions.expectVisible(page, '[data-testid="total-products"]');
    await testUtils.assertions.expectVisible(page, '[data-testid="total-revenue"]');
    await testUtils.assertions.expectVisible(page, '[data-testid="total-customers"]');
    await testUtils.assertions.expectVisible(page, '[data-testid="total-orders"]');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('dashboard-authenticated.png');
  });

  test('admin user has elevated access', async ({ adminPage }) => {
    const page = adminPage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Check admin-specific elements
    await testUtils.assertions.expectVisible(page, '[data-testid="nav-employees"]');
    
    // Take visual snapshot of admin dashboard
    await expect(page).toHaveScreenshot('dashboard-admin.png');
  });

  test('employee user has limited access', async ({ employeePage }) => {
    const page = employeePage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Employee should see dashboard but not admin features
    await testUtils.assertions.expectVisible(page, '[data-testid="total-products"]');
    
    // Take visual snapshot of employee dashboard
    await expect(page).toHaveScreenshot('dashboard-employee.png');
  });

  test('viewer user has read-only access', async ({ viewerPage }) => {
    const page = viewerPage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Viewer should see dashboard but with limited interactions
    await testUtils.assertions.expectVisible(page, '[data-testid="total-products"]');
    
    // Take visual snapshot of viewer dashboard
    await expect(page).toHaveScreenshot('dashboard-viewer.png');
  });

  test('multi-tenant user can switch contexts', async ({ multiTenantPage }) => {
    const page = multiTenantPage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Multi-tenant user should see tenant switching options
    await testUtils.assertions.expectVisible(page, '[data-testid="total-products"]');
    
    // Take visual snapshot of multi-tenant dashboard
    await expect(page).toHaveScreenshot('dashboard-multi-tenant.png');
  });
});

test.describe('Authenticated Tests with Data', () => {
  test('dashboard displays test data correctly', async ({ authenticatedPage, testScenario }) => {
    const page = authenticatedPage;
    
    // Navigate to dashboard
    await testUtils.navigation.goToDashboard(page);

    // Wait for data to load
    await page.waitForSelector('[data-testid="total-products"]', { timeout: 5000 });

    // Check that test data is displayed
    const productsCard = page.locator('[data-testid="total-products"]');
    await expect(productsCard).toBeVisible();
    
    const revenueCard = page.locator('[data-testid="total-revenue"]');
    await expect(revenueCard).toBeVisible();

    // Take visual snapshot with test data
    await expect(page).toHaveScreenshot('dashboard-with-test-data.png');
  });

  test('POS page loads with test products', async ({ authenticatedPage, testProducts }) => {
    const page = authenticatedPage;
    
    // Navigate to POS
    await testUtils.navigation.goToPOS(page);

    // Wait for products to load
    await page.waitForLoadState('networkidle');

    // Check that products are displayed
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // Take visual snapshot of POS with products
    await expect(page).toHaveScreenshot('pos-with-products.png');
  });

  test('inventory page shows test data', async ({ authenticatedPage, testProducts }) => {
    const page = authenticatedPage;
    
    // Navigate to inventory
    await testUtils.navigation.goToInventory(page);

    // Wait for inventory to load
    await page.waitForLoadState('networkidle');

    // Check that inventory is displayed
    await expect(page.locator('[data-testid="inventory-table"]')).toBeVisible();

    // Take visual snapshot of inventory
    await expect(page).toHaveScreenshot('inventory-with-data.png');
  });

  test('customers page displays test customers', async ({ authenticatedPage, testCustomers }) => {
    const page = authenticatedPage;
    
    // Navigate to customers
    await testUtils.navigation.goToCustomers(page);

    // Wait for customers to load
    await page.waitForLoadState('networkidle');

    // Check that customers are displayed
    await expect(page.locator('[data-testid="customer-list"]')).toBeVisible();

    // Take visual snapshot of customers
    await expect(page).toHaveScreenshot('customers-with-data.png');
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('handles network errors gracefully', async ({ page }) => {
    // Mock network error
    await testUtils.mocks.mockError(page, 'auth/v1/user', 'Network Error', 500);
    
    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Should still show login form despite auth error
    await testUtils.assertions.expectVisible(page, '[data-testid="email-input"]');
    
    // Take visual snapshot of error state
    await expect(page).toHaveScreenshot('login-network-error.png');
  });

  test('handles empty data states', async ({ page }) => {
    // Mock empty data
    await testUtils.mocks.mockAPI(page, 'products', { data: [] });
    await testUtils.mocks.mockAPI(page, 'sales', { data: [] });
    await testUtils.mocks.mockAPI(page, 'customers', { data: [] });

    // Navigate to dashboard (will need to mock auth first)
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Mock successful auth
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'test-user', email: 'test@example.com' }
        })
      });
    });

    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should show empty state
    await testUtils.assertions.expectVisible(page, '[data-testid="total-products"]');
    
    // Take visual snapshot of empty state
    await expect(page).toHaveScreenshot('dashboard-empty-state.png');
  });

  test('handles slow loading states', async ({ page }) => {
    // Mock slow API responses
    await testUtils.mocks.mockDelay(page, 'products', 3000);
    await testUtils.mocks.mockDelay(page, 'sales', 3000);

    // Navigate to dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Mock successful auth
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'test-user', email: 'test@example.com' }
        })
      });
    });

    await page.waitForURL('/dashboard');
    
    // Should show loading state
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // Take visual snapshot of loading state
    await expect(page).toHaveScreenshot('dashboard-loading-state.png');
  });
});

test.describe('Accessibility Tests', () => {
  test('login form is accessible', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check form accessibility
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('aria-label');
    
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('aria-label');

    // Take accessibility screenshot
    await expect(page).toHaveScreenshot('login-accessibility.png');
  });

  test('dashboard is accessible', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await testUtils.navigation.goToDashboard(page);

    // Check semantic structure
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Check navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Take accessibility screenshot
    await expect(page).toHaveScreenshot('dashboard-accessibility.png');
  });
});
