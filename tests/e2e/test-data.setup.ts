import { test as base, expect, type Page } from '@playwright/test';
import { testFixtures, createTestScenario } from '../fixtures/test-data';

// Define test data fixtures type
type TestDataFixtures = {
  testProducts: any[];
  testSales: any[];
  testCustomers: any[];
  testEmployees: any[];
  testScenario: any;
};

// Extend base test with test data fixtures
export const test = base.extend<TestDataFixtures>({
  // Standard test products fixture
  testProducts: async ({ page }, use) => {
    // Mock products API endpoint
    await page.route('**/api/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: testFixtures.products,
          error: null
        })
      });
    });

    await page.route('**/rest/v1/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testFixtures.products)
      });
    });

    await use(testFixtures.products);
  },

  // Standard test sales fixture
  testSales: async ({ page }, use) => {
    // Mock sales API endpoint
    await page.route('**/api/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: testFixtures.sales,
          error: null
        })
      });
    });

    await page.route('**/rest/v1/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testFixtures.sales)
      });
    });

    await use(testFixtures.sales);
  },

  // Standard test customers fixture
  testCustomers: async ({ page }, use) => {
    // Mock customers API endpoint
    await page.route('**/api/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: testFixtures.customers,
          error: null
        })
      });
    });

    await page.route('**/rest/v1/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testFixtures.customers)
      });
    });

    await use(testFixtures.customers);
  },

  // Standard test employees fixture
  testEmployees: async ({ page }, use) => {
    // Mock employees API endpoint
    await page.route('**/api/employees*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: testFixtures.employees,
          error: null
        })
      });
    });

    await page.route('**/rest/v1/employees*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testFixtures.employees)
      });
    });

    await use(testFixtures.employees);
  },

  // Complete test scenario fixture
  testScenario: async ({ page }: { page: Page }, use) => {
    const scenario = createTestScenario('admin-with-products');
    
    // Mock all API endpoints for the scenario
    await page.route('**/api/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: scenario.products,
          error: null
        })
      });
    });

    await page.route('**/api/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: scenario.sales,
          error: null
        })
      });
    });

    await page.route('**/api/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: scenario.customers,
          error: null
        })
      });
    });

    await page.route('**/rest/v1/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scenario.products)
      });
    });

    await page.route('**/rest/v1/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scenario.sales)
      });
    });

    await page.route('**/rest/v1/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scenario.customers)
      });
    });

    await use(scenario);
  }
});

// Test data utilities
export const testDataUtils = {
  // Mock API responses for specific data types
  async mockProducts(page: Page, products: any[] = testFixtures.products) {
    await page.route('**/api/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: products,
          error: null
        })
      });
    });
  },

  async mockSales(page: Page, sales: any[] = testFixtures.sales) {
    await page.route('**/api/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: sales,
          error: null
        })
      });
    });
  },

  async mockCustomers(page: Page, customers: any[] = testFixtures.customers) {
    await page.route('**/api/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: customers,
          error: null
        })
      });
    });
  },

  async mockEmployees(page: Page, employees: any[] = testFixtures.employees) {
    await page.route('**/api/employees*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: employees,
          error: null
        })
      });
    });
  },

  // Mock empty responses for testing empty states
  async mockEmptyData(page: Page) {
    const endpoints = ['products', 'sales', 'customers', 'employees'];
    for (const endpoint of endpoints) {
      await page.route(`**/api/${endpoint}*`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            error: null
          })
        });
      });
    }
  },

  // Mock API errors
  async mockApiError(page: Page, endpoint: string, error: string = 'API Error') {
    await page.route(`**/api/${endpoint}*`, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: error
        })
      });
    });
  },

  // Mock loading states
  async mockLoadingState(page: Page, endpoint: string, delay: number = 2000) {
    await page.route(`**/api/${endpoint}*`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          error: null
        })
      });
    });
  },

  // Create specific test scenarios
  createScenario: (scenarioName: string) => {
    return createTestScenario(scenarioName);
  },

  // Validate test data
  validateData: (type: string, data: any) => {
    const validators: Record<string, (data: any) => boolean> = {
      product: (product) => product.id && product.name && product.sku,
      sale: (sale) => sale.id && sale.total && sale.items,
      customer: (customer) => customer.id && customer.name && customer.email,
      employee: (employee) => employee.id && employee.name && employee.email
    };
    
    return validators[type]?.(data) || false;
  }
};

export { expect };
