import { test, expect } from '@playwright/test';

test.describe('Simple Login Test', () => {
  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Check the page loads
    await expect(page.locator('h1')).toContainText('Kits - Khoder\'s IT Solutions');
    
    // Check form elements exist
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    
    // Take a screenshot
    await expect(page).toHaveScreenshot('login-page-simple.png');
  });

  test('can fill and submit login form', async ({ page }) => {
    await page.goto('/login');
    
    // Mock successful auth response and tenant data
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'test-user',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' }
          }
        })
      });
    });

    // Mock tenant data to prevent redirect
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
    
    // Fill the form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Check dashboard loads
    await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible();
    
    // Take screenshot of dashboard
    await expect(page).toHaveScreenshot('dashboard-after-login.png');
  });
});
