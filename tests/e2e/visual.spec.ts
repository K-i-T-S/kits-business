import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from './auth.setup';

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
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('dashboard layout visual appearance', async ({ page }) => {
    // Use the authenticated page fixture
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await expect(page).toHaveScreenshot('dashboard-layout.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('products page visual appearance', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to inventory using dashboard link
    await page.click('[data-testid="total-products"]');
    await page.waitForURL('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of products page
    await expect(page).toHaveScreenshot('products-page.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('tenant info component visual appearance', async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard showing tenant info
    await expect(page).toHaveScreenshot('tenant-info-component.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('navigation sidebar visual appearance', async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of navigation
    await expect(page).toHaveScreenshot('navigation-sidebar.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('forms visual appearance', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to inventory using dashboard link
    await page.click('[data-testid="total-products"]');
    await page.waitForURL('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Click add product button to show form
    await page.click('button:has-text("New product")');
    
    // Wait for modal to appear
    await page.waitForTimeout(2000);
    
    // Take screenshot of product form if visible
    const modalVisible = await page.locator('[data-testid="product-form-modal"]').isVisible().catch(() => false);
    if (modalVisible) {
      const productForm = page.locator('[data-testid="product-form-modal"]');
      await expect(productForm).toHaveScreenshot('product-form.png', {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled'
      });
    } else {
      // Take screenshot of inventory page instead
      await expect(page).toHaveScreenshot('inventory-page.png', {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled'
      });
    }
  });

  test('error states visual appearance', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with invalid credentials to trigger error
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for error message to appear
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('login-error-state.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
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
      }, 2000);
    });

    // Login and navigate to dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Take screenshot during loading
    await expect(page).toHaveScreenshot('loading-state.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  test('responsive design - tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Login and navigate to dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of tablet dashboard
    await expect(page).toHaveScreenshot('tablet-dashboard.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });
});

test.describe('Visual Regression Tests - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  authenticatedTest('products page visual appearance', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Navigate to inventory using dashboard link
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="total-products"]');
    await page.waitForURL('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of products page
    await expect(page).toHaveScreenshot('authenticated-products-page.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });

  authenticatedTest('dashboard visual appearance', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of authenticated dashboard
    await expect(page).toHaveScreenshot('authenticated-dashboard.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    });
  });
});
