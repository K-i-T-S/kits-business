import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality - Simple', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Wait for the h1 element to be visible and contain the expected text
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Kits - Khoder\'s IT Solutions');
  });

  test('should have login form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check for email input with ID
    await expect(page.locator('#email-input')).toBeVisible();
    
    // Check for password input with ID
    await expect(page.locator('#password-input')).toBeVisible();
    
    // Check for sign in button
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Mock authentication by intercepting the auth check
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              aud: 'authenticated',
              role: 'authenticated',
              app_metadata: {},
              user_metadata: { name: 'Test User' }
            }
          }
        })
      });
    });

    // Set auth token and navigate to dashboard
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: { name: 'Test User' }
        }
      }));
    });
    
    await page.goto('/dashboard');
    
    // Should either load dashboard or redirect to tenant selection
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/dashboard|\/tenant-selection/);
  });

  test('should handle responsive design', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();
  });
});
