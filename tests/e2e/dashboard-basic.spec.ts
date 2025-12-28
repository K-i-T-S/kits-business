import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality', () => {
  test('dashboard loads with authenticated user', async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { id: 'test-user', email: 'test@example.com', user_metadata: { name: 'Test User' } } }
        })
      });
    });

    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: { access_token: 'mock-token', user: { id: 'test-user', email: 'test@example.com' } } }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            tenant_id: 'test-tenant',
            tenant_name: 'Test Business',
            tenant_slug: 'test-business',
            user_id: 'test-user',
            user_role: 'owner',
            user_active: true,
            tenant_active: true,
            settings: {}
          }]
        })
      });
    });

    // Mock dashboard data
    await page.route('**/rest/v1/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', name: 'Test Product', sku: 'TEST-001', variants: [{ stock: 10 }] }
        ])
      });
    });

    await page.route('**/rest/v1/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', total: 100, date: new Date().toISOString(), items: [] }
        ])
      });
    });

    await page.route('**/rest/v1/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', name: 'Test Customer', email: 'customer@test.com' }
        ])
      });
    });

    // Set auth state and navigate
    await page.addInitScript(() => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check dashboard elements
    await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible();
    await expect(page.locator('[data-testid="total-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-customers"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();

    // Check navigation links work
    const posLink = page.locator('[data-testid="nav-pos"]');
    await expect(posLink).toBeVisible();
    
    const inventoryLink = page.locator('[data-testid="nav-inventory"]');
    await expect(inventoryLink).toBeVisible();

    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard-with-data.png');
  });

  test('dashboard handles empty data gracefully', async ({ page }) => {
    // Mock auth with empty data
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { id: 'test-user', email: 'test@example.com' } }
        })
      });
    });

    await page.route('**/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            tenant_id: 'test-tenant',
            tenant_name: 'Test Business',
            user_role: 'owner',
            user_active: true,
            tenant_active: true
          }]
        })
      });
    });

    // Mock empty data
    await page.route('**/rest/v1/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should still show dashboard structure
    await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible();
    await expect(page.locator('[data-testid="total-products"]')).toBeVisible();

    // Take screenshot of empty state
    await expect(page).toHaveScreenshot('dashboard-empty-data.png');
  });
});
