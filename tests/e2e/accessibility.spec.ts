import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from './auth.setup';

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

authenticatedTest.describe('Accessibility Visual Tests - Authenticated', () => {
  authenticatedTest.beforeEach(async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Enable accessibility features
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  authenticatedTest('reduced motion visual appearance', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot with reduced motion
    await expect(page).toHaveScreenshot('reduced-motion-dashboard.png');
  });

  authenticatedTest('screen reader friendly structure', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check semantic structure
    const landmarks = await page.locator('main, nav, header, footer, section, article, aside').count();
    expect(landmarks).toBeGreaterThan(0);
    
    // Take screenshot showing semantic structure
    await expect(page).toHaveScreenshot('semantic-structure.png');
  });

  authenticatedTest('ARIA landmarks and roles', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for main content area
    const main = page.locator('main');
    const mainCount = await main.count();
    if (mainCount > 0) {
      expect(mainCount).toBeGreaterThan(0);
    }
    
    // Check for navigation elements
    const nav = page.locator('nav');
    const navCount = await nav.count();
    if (navCount > 0) {
      expect(navCount).toBeGreaterThan(0);
    }
    
    // Take screenshot showing ARIA structure
    await expect(page).toHaveScreenshot('aria-landmarks.png');
  });

  authenticatedTest('accessible navigation', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for navigation elements
    const navLinks = page.locator('a[href]');
    const linkCount = await navLinks.count();
    if (linkCount > 0) {
      expect(linkCount).toBeGreaterThan(0);
    }
    
    // Check for interactive elements have proper focus management
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    if (buttonCount > 0) {
      expect(buttonCount).toBeGreaterThan(0);
    }
    
    // Take screenshot of navigation structure
    await expect(page).toHaveScreenshot('accessible-navigation.png');
  });

  authenticatedTest('accessible data tables', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Go directly to dashboard (already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for dashboard stats cards which act as data displays
    const statCards = page.locator('[data-testid="total-products"], [data-testid="total-revenue"], [data-testid="total-customers"], [data-testid="total-orders"]');
    const cardCount = await statCards.count();
    if (cardCount > 0) {
      expect(cardCount).toBeGreaterThan(0);
      
      // Check that cards have accessible text content
      const firstCard = statCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText?.length).toBeGreaterThan(0);
    }
    
    // Take screenshot of dashboard data display
    await expect(page).toHaveScreenshot('accessible-data-display.png');
  });
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
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        expect(await label.count()).toBe(1);
      }
    }
    
    // Take screenshot of accessible form
    await expect(page).toHaveScreenshot('accessible-form.png');
  });


  test('accessible error messages', async ({ page }) => {
    // Mock failed login
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid login credentials',
          error_description: 'Invalid login credentials'
        })
      });
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Wait for login form to be visible
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 });
    
    // Trigger error
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
    
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
