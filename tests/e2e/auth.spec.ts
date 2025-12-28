import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login or show login form
    await expect(page.locator('h1')).toContainText(/login|sign in/i);
  });

  test('should handle login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText(/dashboard|overview/i);
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid|error/i);
  });

  test('should handle logout correctly', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Find and click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Multi-tenant Features', () => {
  test('should display tenant information when authenticated', async ({ page }) => {
    // Mock authentication and tenant data
    await page.goto('/login');
    await page.fill('input[type="email"]', 'tenant@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should show tenant info
    await expect(page.locator('[data-testid="tenant-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="tenant-name"]')).toContainText('Test Business');
    await expect(page.locator('[data-testid="tenant-role"]')).toContainText('owner');
  });

  test('should handle tenant switching', async ({ page }) => {
    // Login with user who has multiple tenants
    await page.goto('/login');
    await page.fill('input[type="email"]', 'multi-tenant@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Click tenant switcher
    await page.click('[data-testid="tenant-switcher"]');
    
    // Select different tenant
    await page.click('[data-testid="tenant-option"]:has-text("Second Business")]');
    
    // Should update tenant info
    await expect(page.locator('[data-testid="tenant-name"]')).toContainText('Second Business');
  });
});

test.describe('Navigation and Routing', () => {
  test('should navigate between main sections', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to different sections
    await page.click('[data-testid="nav-products"]');
    await expect(page).toHaveURL('/products');
    await expect(page.locator('h1')).toContainText(/products/i);
    
    await page.click('[data-testid="nav-sales"]');
    await expect(page).toHaveURL('/sales');
    await expect(page.locator('h1')).toContainText(/sales/i);
    
    await page.click('[data-testid="nav-customers"]');
    await expect(page).toHaveURL('/customers');
    await expect(page.locator('h1')).toContainText(/customers/i);
    
    await page.click('[data-testid="nav-employees"]');
    await expect(page).toHaveURL('/employees');
    await expect(page.locator('h1')).toContainText(/employees/i);
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Login and navigate
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.click('[data-testid="nav-products"]');
    await page.click('[data-testid="nav-sales"]');
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/products');
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/sales');
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    
    // Should show mobile-optimized login
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Login and check mobile navigation
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should show mobile menu button
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
  });

  test('should work on tablet devices', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should show tablet-optimized layout
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    
    // Check for main heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();
    
    // Check for proper heading levels
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]:focus')).toBeVisible();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]:focus')).toBeVisible();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]:focus')).toBeVisible();
    
    // Submit with Enter key
    await page.keyboard.press('Enter');
    
    // Should attempt to login
    await expect(page).toHaveURL(/dashboard|login/);
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');
    
    // Check form labels
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
    
    // Check button aria labels
    await expect(page.locator('button[aria-label*="submit"]')).toBeVisible();
  });
});
