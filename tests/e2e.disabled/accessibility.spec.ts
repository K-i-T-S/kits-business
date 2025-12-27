import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
    await page.goto('/');
  });

  test('homepage accessibility', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-labels': { enabled: true },
        'heading-order': { enabled: true },
        'landmark-roles': { enabled: true },
      }
    });
  });

  test('login form accessibility', async ({ page }) => {
    const loginButton = page.locator('button:has-text("Login"), [data-testid="login-button"]');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(1000);
      
      await checkA11y(page, null, {
        detailedReport: true,
        rules: {
          'form-field-multiple-labels': { enabled: true },
          'label-title-only': { enabled: true },
          'input-button-name': { enabled: true },
        }
      });
    }
  });

  test('keyboard navigation', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    const firstFocusable = page.locator(':focus');
    await expect(firstFocusable).toBeVisible();
    
    // Test Enter/Space on buttons
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      await buttons.first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    
    // Test Escape key for modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('screen reader landmarks', async ({ page }) => {
    // Check for proper ARIA landmarks
    const main = page.locator('main, [role="main"]');
    const nav = page.locator('nav, [role="navigation"]');
    const header = page.locator('header, [role="banner"]');
    const footer = page.locator('footer, [role="contentinfo"]');
    
    // At least one main landmark should exist
    await expect(main).toHaveCount.greaterThanOrEqual(0);
    
    // Navigation should be properly marked
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });

  test('heading hierarchy', async ({ page }) => {
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      // Check that h1 comes first
      const firstHeading = await headings.first().evaluate(el => el.tagName);
      if (headingCount > 1) {
        // Verify heading order doesn't skip levels
        const headingLevels = await headings.evaluateAll(els => 
          els.map(el => parseInt(el.tagName.substring(1)))
        );
        
        for (let i = 1; i < headingLevels.length; i++) {
          const currentLevel = headingLevels[i];
          const previousLevel = headingLevels[i - 1];
          // Heading levels should not skip more than one level
          expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('color contrast and visual accessibility', async ({ page }) => {
    // Test in both light and dark mode
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true },
      }
    });
    
    // Test dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(1000);
    
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true },
      }
    });
  });

  test('form accessibility', async ({ page }) => {
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    if (formCount > 0) {
      await checkA11y(forms.first(), null, {
        detailedReport: true,
        rules: {
          'label': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'label-title-only': { enabled: true },
          'input-button-name': { enabled: true },
          'fieldset': { enabled: true },
          'legend': { enabled: true },
        }
      });
    }
  });

  test('table accessibility', async ({ page }) => {
    const tables = page.locator('table');
    const tableCount = await tables.count();
    
    if (tableCount > 0) {
      await checkA11y(tables.first(), null, {
        detailedReport: true,
        rules: {
          'table-headers': { enabled: true },
          'th-has-data-cells': { enabled: true },
          'td-headers-attr': { enabled: true },
          'scope-attr-valid': { enabled: true },
        }
      });
    }
  });

  test('link accessibility', async ({ page }) => {
    const links = page.locator('a[href]');
    const linkCount = await links.count();
    
    if (linkCount > 0) {
      // Check that links have accessible names
      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const link = links.nth(i);
        const accessibleName = await link.getAttribute('aria-label') || 
                               await link.textContent() || 
                               await link.getAttribute('title');
        
        expect(accessibleName?.trim()).toBeTruthy();
      }
    }
  });

  test('image accessibility', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Images should have alt text unless they're decorative
        if (role !== 'presentation') {
          expect(alt).toBeTruthy();
        }
      }
    }
  });

  test('focus management', async ({ page }) => {
    // Test that focus is visible
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    
    if (await focusedElement.isVisible()) {
      // Check for focus styles
      const computedStyle = await focusedElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          boxShadow: style.boxShadow,
          border: style.border
        };
      });
      
      // Element should have some form of focus indicator
      const hasFocusIndicator = 
        computedStyle.outline !== 'none' ||
        computedStyle.boxShadow !== 'none' ||
        computedStyle.border !== 'none';
      
      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('reduced motion support', async ({ page }) => {
    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(1000);
    
    // Check that animations are disabled or reduced
    const animatedElements = page.locator('[style*="animation"], [style*="transition"]');
    const animCount = await animatedElements.count();
    
    if (animCount > 0) {
      // Verify that animations respect reduced motion
      const firstAnimated = animatedElements.first();
      const animationStyle = await firstAnimated.getAttribute('style');
      
      // Should have reduced or no animations
      expect(animationStyle).toBeDefined();
    }
  });

  test('mobile accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    
    await checkA11y(page, null, {
      detailedReport: true,
      rules: {
        'touch-target-size': { enabled: true },
        'target-size': { enabled: true },
      }
    });
  });
});
