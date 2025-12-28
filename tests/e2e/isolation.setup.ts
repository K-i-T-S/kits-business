import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

// Define test isolation fixtures
type IsolationFixtures = {
  isolatedPage: Page;
  cleanContext: BrowserContext;
};

// Extend base test with isolation fixtures
export const test = base.extend<IsolationFixtures>({
  // Isolated page with clean state
  isolatedPage: async ({ context, page }, use) => {
    // Clear all storage and cookies
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear any existing routes
    await page.unrouteAll();
    
    // Set default viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);
  },

  // Clean browser context
  cleanContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      // Clear storage on start
      storageState: undefined,
      // Ignore service workers for clean state
      serviceWorkers: 'block',
      // Ignore cache for consistent tests
      ignoreHTTPSErrors: true,
    });

    await use(context);
    await context.close();
  }
});

// Test isolation utilities
export const isolationUtils = {
  // Clean page state between tests
  async cleanPage(page: Page) {
    // Clear all storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear cookies
    const context = page.context();
    await context.clearCookies();

    // Clear all routes
    await page.unrouteAll();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  },

  // Reset mock data
  async resetMocks(page: Page) {
    await page.unrouteAll();
  },

  // Clear IndexedDB (for persistent storage)
  async clearIndexedDB(page: Page) {
    await page.evaluate(() => {
      if (window.indexedDB) {
        const databases = indexedDB.databases();
        databases.then((dbs: any[]) => {
          dbs.forEach(db => {
            indexedDB.deleteDatabase(db.name);
          });
        });
      }
    });
  },

  // Wait for network idle
  async waitForNetworkIdle(page: Page, timeout: number = 5000) {
    await page.waitForLoadState('networkidle', { timeout });
  },

  // Wait for all animations to complete
  async waitForAnimations(page: Page) {
    await page.waitForFunction(() => {
      return document.getAnimations().length === 0;
    });
  },

  // Reset form inputs
  async resetForms(page: Page) {
    await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      forms.forEach(form => form.reset());
      
      const inputs = document.querySelectorAll('input, textarea, select') as NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
      inputs.forEach(input => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  },

  // Clear any active timers/intervals
  async clearTimers(page: Page) {
    await page.evaluate(() => {
      // Use a large number to clear most common timer IDs
      const maxId = 10000;
      for (let i = 1; i <= maxId; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
    });
  },

  // Reset scroll position
  async resetScroll(page: Page) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  },

  // Full cleanup routine
  async fullCleanup(page: Page) {
    await this.cleanPage(page);
    await this.clearIndexedDB(page);
    await this.resetForms(page);
    await this.clearTimers(page);
    await this.resetScroll(page);
    await this.waitForAnimations(page);
  }
};

// Global test hooks for isolation
export const setupTestIsolation = () => {
  test.beforeEach(async ({ page }) => {
    // Clean up before each test
    await isolationUtils.fullCleanup(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await isolationUtils.fullCleanup(page);
    
    // Take screenshot on failure for debugging
    if (test.info().status !== 'passed') {
      await page.screenshot({ 
        path: `test-failures/${test.info().title.replace(/\s+/g, '-').toLowerCase()}.png`,
        fullPage: true 
      });
    }
  });

  test.beforeAll(async () => {
    // Create test-failures directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync('test-failures')) {
      fs.mkdirSync('test-failures');
    }
  });
};

export { expect };
