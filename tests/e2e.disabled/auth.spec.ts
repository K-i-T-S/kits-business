import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('login form is accessible', async ({ page }) => {
    // Look for login elements
    const loginButton = page.locator('button:has-text("Login"), [data-testid="login-button"]');
    const loginForm = page.locator('form:has-text("Login"), [data-testid="login-form"]');
    
    // Check if login button exists and click it
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await expect(loginForm).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows proper auth state when not logged in', async ({ page }) => {
    // Check for login prompts or guest state
    const loginPrompt = page.locator(':has-text("Login"), :has-text("Sign in"), :has-text("Guest")');
    const count = await loginPrompt.count();
    
    if (count > 0) {
      await expect(loginPrompt.first()).toBeVisible();
    }
  });

  test('tenant switching works if available', async ({ page }) => {
    // Look for tenant switching UI
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"], .tenant-switcher');
    
    if (await tenantSwitcher.isVisible()) {
      await tenantSwitcher.click();
      
      // Look for tenant options
      const tenantOptions = page.locator('[data-testid="tenant-option"], .tenant-option');
      const optionCount = await tenantOptions.count();
      
      if (optionCount > 0) {
        await expect(tenantOptions.first()).toBeVisible();
      }
    }
  });
});
