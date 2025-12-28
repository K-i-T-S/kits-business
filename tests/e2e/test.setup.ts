import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { test as authTest } from './auth.setup';
import { test as dataTest } from './test-data.setup';
import { test as isolationTest } from './isolation.setup';
import { isolationUtils } from './isolation.setup';

// Combined fixtures with all functionality
type CombinedFixtures = {
  page: Page;
  context: BrowserContext;
  authenticatedPage: Page;
  unauthenticatedPage: Page;
  adminPage: Page;
  employeePage: Page;
  viewerPage: Page;
  multiTenantPage: Page;
  isolatedPage: Page;
  cleanContext: BrowserContext;
  testProducts: any[];
  testSales: any[];
  testCustomers: any[];
  testEmployees: any[];
  testScenario: any;
};

// Create unified test setup
export const test = base.extend<CombinedFixtures>({
  // Inherit all fixtures from individual setups
  ...authTest.fixtures,
  ...dataTest.fixtures,
  ...isolationTest.fixtures,
});

// Global test configuration
export const setupGlobalTestConfig = () => {
  // Set default timeout
  test.setTimeout(30000);

  // Configure retries
  test.configure({ 
    retries: 2,
    timeout: 30000 
  });

  // Global setup
  test.beforeAll(async () => {
    // Create test-failures directory
    const fs = require('fs');
    if (!fs.existsSync('test-failures')) {
      fs.mkdirSync('test-failures');
    }
  });

  // Global cleanup and isolation
  test.beforeEach(async ({ page }) => {
    await isolationUtils.fullCleanup(page);
  });

  test.afterEach(async ({ page }) => {
    await isolationUtils.fullCleanup(page);
    
    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({ 
        path: `test-failures/${test.info().title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`,
        fullPage: true 
      });
    }
  });

  // Slow mode for debugging (uncomment when needed)
  // test.slow();
};

// Test utilities combining all functionality
export const testUtils = {
  // Authentication utilities
  auth: {
    async login(page: Page, email: string = 'test@example.com', password: string = 'password123') {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', email);
      await page.fill('[data-testid="password-input"]', password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard', { timeout: 10000 });
    },

    async logout(page: Page) {
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL('/login', { timeout: 5000 });
    },

    async waitForAuth(page: Page) {
      await page.waitForFunction(() => {
        return window.localStorage.getItem('sb-test-auth-token') !== null;
      });
    }
  },

  // Navigation utilities
  navigation: {
    async goToDashboard(page: Page) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    },

    async goToPOS(page: Page) {
      await page.goto('/pos');
      await page.waitForLoadState('networkidle');
    },

    async goToInventory(page: Page) {
      await page.goto('/inventory');
      await page.waitForLoadState('networkidle');
    },

    async goToCustomers(page: Page) {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');
    },

    async goToReports(page: Page) {
      await page.goto('/reports');
      await page.waitForLoadState('networkidle');
    }
  },

  // UI interaction utilities
  ui: {
    async waitForElement(page: Page, selector: string, timeout: number = 5000) {
      await page.waitForSelector(selector, { timeout });
    },

    async clickElement(page: Page, selector: string) {
      await page.waitForSelector(selector);
      await page.click(selector);
    },

    async fillInput(page: Page, selector: string, value: string) {
      await page.waitForSelector(selector);
      await page.fill(selector, value);
    },

    async selectOption(page: Page, selector: string, value: string) {
      await page.waitForSelector(selector);
      await page.selectOption(selector, value);
    },

    async uploadFile(page: Page, selector: string, filePath: string) {
      await page.waitForSelector(selector);
      await page.setInputFiles(selector, filePath);
    }
  },

  // Assertion utilities
  assertions: {
    async expectVisible(page: Page, selector: string) {
      await expect(page.locator(selector)).toBeVisible();
    },

    async expectHidden(page: Page, selector: string) {
      await expect(page.locator(selector)).toBeHidden();
    },

    async expectText(page: Page, selector: string, text: string) {
      await expect(page.locator(selector)).toContainText(text);
    },

    async expectValue(page: Page, selector: string, value: string) {
      await expect(page.locator(selector)).toHaveValue(value);
    },

    async expectCount(page: Page, selector: string, count: number) {
      await expect(page.locator(selector)).toHaveCount(count);
    }
  },

  // Mock utilities
  mocks: {
    async mockAPI(page: Page, endpoint: string, data: any, status: number = 200) {
      await page.route(`**/${endpoint}*`, route => {
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(data)
        });
      });
    },

    async mockError(page: Page, endpoint: string, error: string, status: number = 500) {
      await page.route(`**/${endpoint}*`, route => {
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ error })
        });
      });
    },

    async mockDelay(page: Page, endpoint: string, delay: number) {
      await page.route(`**/${endpoint}*`, async route => {
        await new Promise(resolve => setTimeout(resolve, delay));
        route.continue();
      });
    }
  },

  // Data utilities
  data: {
    async createTestData(page: Page, type: string, count: number = 1) {
      const testData = {
        products: Array(count).fill(null).map((_, i) => ({
          id: `product-${i}`,
          name: `Test Product ${i}`,
          sku: `TEST-${i}`,
          price: 100 + i,
          stock: 10 + i
        })),
        customers: Array(count).fill(null).map((_, i) => ({
          id: `customer-${i}`,
          name: `Test Customer ${i}`,
          email: `customer${i}@test.com`,
          phone: `123-456-789${i}`
        })),
        sales: Array(count).fill(null).map((_, i) => ({
          id: `sale-${i}`,
          total: 100 + i,
          date: new Date().toISOString(),
          items: [{
            productId: `product-${i}`,
            quantity: 1,
            price: 100 + i
          }]
        }))
      };

      return testData[type] || [];
    }
  }
};

// Export everything
export { expect };
export default test;
