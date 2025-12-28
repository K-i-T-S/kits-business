import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from './auth.setup';

test.describe('Basic Infrastructure Test', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check basic elements
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    
    // Take screenshot
    await expect(page).toHaveScreenshot('login-page-basic.png');
  });

  test('can fill login form', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Verify values
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue('test@example.com');
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('password123');
  });
});

authenticatedTest.describe('Authenticated Test', () => {
  authenticatedTest('authenticated user can access dashboard', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check dashboard elements
    await expect(page.locator('[data-testid="total-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    
    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard-authenticated-basic.png');
  });
});
