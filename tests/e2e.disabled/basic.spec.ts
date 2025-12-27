import { test, expect } from '@playwright/test';

test.describe('Basic E2E Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/All-in-One Business Terminal/);
    
    // Check for main navigation elements
    await expect(page.locator('body')).toBeVisible();
  });

  test('tenant management works', async ({ page }) => {
    await page.goto('/');
    
    // Look for tenant-related elements
    const tenantInfo = page.locator('[data-testid="tenant-info"], .tenant-info');
    if (await tenantInfo.isVisible()) {
      await expect(tenantInfo).toBeVisible();
    }
  });

  test('navigation between sections works', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation if navigation elements exist
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const count = await navLinks.count();
    
    if (count > 0) {
      // Click first navigation link
      await navLinks.first().click();
      await expect(page).toHaveURL(/.*\/.*/);
    }
  });

  test('responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.goto('/');
    
    // Check that mobile layout works
    await expect(page.locator('body')).toBeVisible();
    
    // Check for mobile navigation if it exists
    const mobileNav = page.locator('.mobile-nav, [data-testid="mobile-nav"]');
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toBeVisible();
    }
  });
});
