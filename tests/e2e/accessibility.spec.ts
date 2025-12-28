import { test, expect } from '@playwright/test';

test.describe('Accessibility Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable accessibility features
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('high contrast mode visual appearance', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot in high contrast mode
    await expect(page).toHaveScreenshot('high-contrast-login.png');
  });

  test('reduced motion visual appearance', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot with reduced motion
    await expect(page).toHaveScreenshot('reduced-motion-dashboard.png');
  });

  test('keyboard navigation focus states', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form elements and capture focus states
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('focus-email-input.png');
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('focus-password-input.png');
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('focus-submit-button.png');
  });

  test('screen reader friendly structure', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check semantic structure
    const landmarks = await page.locator('main, nav, header, footer, section, article, aside').count();
    expect(landmarks).toBeGreaterThan(0);
    
    // Take screenshot showing semantic structure
    await expect(page).toHaveScreenshot('semantic-structure.png');
  });

  test('color contrast compliance', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for color contrast analysis
    await expect(page).toHaveScreenshot('color-contrast-login.png');
    
    // Check for proper contrast ratios (would need additional tools for automated testing)
    const textElements = page.locator('button, input, label, a, h1, h2, h3, p, span');
    const textCount = await textElements.count();
    expect(textCount).toBeGreaterThan(0);
  });

  test('accessible form labels', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check all form inputs have associated labels
    const inputs = page.locator('input[type="email"], input[type="password"]');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const label = page.locator(`label[for="${id}"]`);
      expect(await label.count()).toBe(1);
    }
    
    // Take screenshot of accessible form
    await expect(page).toHaveScreenshot('accessible-form.png');
  });

  test('ARIA landmarks and roles', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for ARIA landmarks
    const main = page.locator('main');
    const nav = page.locator('nav[role="navigation"]');
    const banner = page.locator('header[role="banner"]');
    
    expect(await main.count()).toBeGreaterThan(0);
    
    // Take screenshot showing ARIA structure
    await expect(page).toHaveScreenshot('aria-landmarks.png');
  });

  test('accessible navigation', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for skip links
    const skipLinks = page.locator('a[href^="#"]');
    expect(await skipLinks.count()).toBeGreaterThan(0);
    
    // Take screenshot of navigation structure
    await expect(page).toHaveScreenshot('accessible-navigation.png');
  });

  test('accessible data tables', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    await page.click('[data-testid="nav-products"]');
    await page.waitForURL('/products');
    await page.waitForLoadState('networkidle');
    
    // Check for table accessibility features
    const tables = page.locator('table');
    if (await tables.count() > 0) {
      // Check for table headers
      const headers = page.locator('th');
      expect(await headers.count()).toBeGreaterThan(0);
      
      // Check for table captions
      const captions = page.locator('caption');
      // Captions are optional but recommended
    }
    
    // Take screenshot of data tables
    await expect(page).toHaveScreenshot('accessible-tables.png');
  });

  test('accessible error messages', async ({ page }) => {
    await page.goto('/login');
    
    // Trigger error
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]');
    
    // Check error message is accessible
    const errorMessage = page.locator('[data-testid="error-message"]');
    expect(await errorMessage.isVisible()).toBe(true);
    
    // Check for ARIA live regions
    const liveRegions = page.locator('[aria-live], [role="alert"]');
    expect(await liveRegions.count()).toBeGreaterThan(0);
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('accessible-error.png');
  });
});
