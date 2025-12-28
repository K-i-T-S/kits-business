import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('login page visual appearance', async ({ page }) => {
    await page.goto('/login');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of login page
    await expect(page).toHaveScreenshot('login-page.png');
  });

  test('dashboard layout visual appearance', async ({ page }) => {
    // Mock authentication
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await expect(page).toHaveScreenshot('dashboard-layout.png');
  });

  test('products page visual appearance', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    await page.click('[data-testid="nav-products"]');
    await page.waitForURL('/products');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of products page
    await expect(page).toHaveScreenshot('products-page.png');
  });

  test('tenant info component visual appearance', async ({ page }) => {
    // Login with tenant
    await page.goto('/login');
    await page.fill('input[type="email"]', 'tenant@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Wait for tenant info to load
    await page.waitForSelector('[data-testid="tenant-info"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of tenant info component
    const tenantInfo = page.locator('[data-testid="tenant-info"]');
    await expect(tenantInfo).toHaveScreenshot('tenant-info-component.png');
  });

  test('navigation sidebar visual appearance', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of navigation sidebar
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveScreenshot('navigation-sidebar.png');
  });

  test('forms visual appearance', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    await page.click('[data-testid="nav-products"]');
    await page.waitForURL('/products');
    
    // Click add product button to show form
    await page.click('[data-testid="add-product-button"]');
    await page.waitForSelector('[data-testid="product-form"]');
    
    // Take screenshot of product form
    const productForm = page.locator('[data-testid="product-form"]');
    await expect(productForm).toHaveScreenshot('product-form.png');
  });

  test('error states visual appearance', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with invalid credentials to trigger error
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    await page.waitForSelector('[data-testid="error-message"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('login-error-state.png');
  });

  test('loading states visual appearance', async ({ page }) => {
    // Mock slow loading to capture loading state
    await page.route('**/api/**', route => {
      // Delay response to show loading state
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
      }, 1000);
    });

    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for loading indicator
    await page.waitForSelector('[data-testid="loading-indicator"]');
    
    // Take screenshot of loading state
    await expect(page).toHaveScreenshot('loading-state.png');
  });

  test('responsive design - mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of mobile login
    await expect(page).toHaveScreenshot('mobile-login.png');
  });

  test('responsive design - tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of tablet dashboard
    await expect(page).toHaveScreenshot('tablet-dashboard.png');
  });
});
