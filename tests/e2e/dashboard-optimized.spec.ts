import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality', () => {
  test.use({ storageState: 'tests/e2e/auth-state.json' });

  test.beforeEach(async ({ page }) => {
    // Mock all authentication and data API calls
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              aud: 'authenticated',
              role: 'authenticated',
              app_metadata: {},
              user_metadata: { name: 'Test User' }
            }
          }
        })
      });
    });

    await page.route('**/rest/v1/tenant_user_details*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tenant_id: 'test-tenant-id',
            tenant_name: 'Test Business',
            tenant_slug: 'test-business',
            user_role: 'owner',
            user_active: true,
            tenant_active: true,
            settings: {}
          }
        ])
      });
    });

    // Mock products data
    await page.route('**/rest/v1/products*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Test Product',
            sku: 'TEST-001',
            variants: [
              { id: '1-1', stock: 100, reorderLevel: 10, price: 29.99, cost: 15.00 }
            ]
          }
        ])
      });
    });

    // Mock sales data
    await page.route('**/rest/v1/sales*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            date: new Date().toISOString(),
            total: 99.99,
            paymentMethod: 'cash',
            items: [
              { price: 29.99, cost: 15.00, quantity: 2 }
            ]
          }
        ])
      });
    });

    // Mock customers data
    await page.route('**/rest/v1/customers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'Test Customer',
            debtBalance: 50.00
          }
        ])
      });
    });

    await page.goto('/dashboard');
    
    // Wait for either dashboard content or handle loading
    try {
      await page.waitForSelector('text=Welcome back', { timeout: 5000 });
    } catch (e) {
      // If dashboard doesn't load, check if we're on login page and redirect
      if (page.url().includes('/login')) {
        // Set auth token directly and navigate again
        await page.evaluate(() => {
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_at: Date.now() + 3600000,
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              aud: 'authenticated',
              role: 'authenticated',
              app_metadata: {},
              user_metadata: { name: 'Test User' }
            }
          }));
        });
        await page.goto('/dashboard');
        await page.waitForSelector('text=Welcome back', { timeout: 5000 });
      }
    }
  });

  test('should display dashboard overview', async ({ page }) => {
    // Check main dashboard heading
    await expect(page.locator('h1')).toContainText('Welcome back');
    
    // Check for key metrics cards
    await expect(page.locator('text=Total Products')).toBeVisible();
    await expect(page.locator('text=Today\'s Sales')).toBeVisible();
    await expect(page.locator('text=Customers')).toBeVisible();
    await expect(page.locator('text=Today\'s Profit')).toBeVisible();
    
    // Check for quick actions
    await expect(page.locator('text=New Sale')).toBeVisible();
    await expect(page.locator('text=Add Product')).toBeVisible();
    await expect(page.locator('text=View Reports')).toBeVisible();
    await expect(page.locator('text=Manage Team')).toBeVisible();
  });

  test('should show recent activity', async ({ page }) => {
    // Check recent sales section
    await expect(page.locator('text=Recent Sales')).toBeVisible();
    
    // Check inventory overview section
    await expect(page.locator('text=Inventory Overview')).toBeVisible();
    
    // Check operator shortcuts section
    await expect(page.locator('text=Operator shortcuts')).toBeVisible();
  });

  test('should handle navigation to other pages', async ({ page }) => {
    // Test navigation to inventory
    await page.click('text=Total Products');
    await expect(page).toHaveURL('/inventory');
    
    // Go back to dashboard
    await page.goto('/dashboard');
    await page.waitForSelector('text=Welcome back');
    
    // Test navigation to POS
    await page.click('text=New Sale');
    await expect(page).toHaveURL('/pos');
  });

  test('should handle quick actions', async ({ page }) => {
    // Test quick action buttons
    await expect(page.locator('a[href="/pos"]')).toBeVisible();
    await expect(page.locator('a[href="/inventory"]')).toBeVisible();
    await expect(page.locator('a[href="/reports"]')).toBeVisible();
    await expect(page.locator('a[href="/employees"]')).toBeVisible();
  });
});

test.describe('Products Management', () => {
  test.use({ storageState: 'auth-state.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="nav-products"]');
    await expect(page).toHaveURL('/products');
  });

  test('should display products list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/products/i);
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
    const productRows = page.locator('[data-testid="product-row"]');
    await expect(productRows.first()).toBeVisible();
    await expect(page.locator('[data-testid="product-name"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="product-price"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="product-stock"]').first()).toBeVisible();
  });

  test('should handle product search', async ({ page }) => {
    await expect(page.locator('[data-testid="product-search"]')).toBeVisible();
    await page.fill('[data-testid="product-search"]', 'Laptop');
    await page.press('[data-testid="product-search"]', 'Enter');
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({ timeout: 3000 });
    const searchResults = page.locator('[data-testid="product-row"]');
    if (await searchResults.count() > 0) {
      await expect(searchResults.first()).toContainText('Laptop');
    }
  });

  test('should handle product creation', async ({ page }) => {
    await page.click('[data-testid="add-product-button"]');
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible();
    await page.fill('[data-testid="product-name-input"]', 'Test Product');
    await page.fill('[data-testid="product-price-input"]', '29.99');
    await page.fill('[data-testid="product-description-input"]', 'Test description');
    await page.fill('[data-testid="product-stock-input"]', '100');
    await page.click('[data-testid="save-product-button"]');
    await expect(page.locator('[data-testid="product-form"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-row"]:has-text("Test Product")]')).toBeVisible();
  });

  test('should handle product editing', async ({ page }) => {
    await page.click('[data-testid="product-row"] [data-testid="edit-button"]');
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-name-input"]')).toHaveValue(/\w+/);
    await page.fill('[data-testid="product-name-input"]', 'Updated Product');
    await page.click('[data-testid="save-product-button"]');
    await expect(page.locator('[data-testid="product-form"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-row"]:has-text("Updated Product")]')).toBeVisible();
  });

  test('should handle product deletion', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="product-row"]').count();
    await page.click('[data-testid="product-row"] [data-testid="delete-button"]');
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete-button"]');
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    const finalCount = await page.locator('[data-testid="product-row"]').count();
    expect(finalCount).toBe(initialCount - 1);
  });
});

test.describe('Sales Management', () => {
  test.use({ storageState: 'auth-state.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="nav-sales"]');
    await expect(page).toHaveURL('/sales');
  });

  test('should display sales list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/sales/i);
    await expect(page.locator('[data-testid="sales-table"]')).toBeVisible();
    const saleRows = page.locator('[data-testid="sale-row"]');
    await expect(saleRows.first()).toBeVisible();
    await expect(page.locator('[data-testid="sale-id"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="sale-date"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="sale-total"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="sale-status"]').first()).toBeVisible();
  });

  test('should handle sale creation', async ({ page }) => {
    await page.click('[data-testid="new-sale-button"]');
    await expect(page.locator('[data-testid="sale-form"]')).toBeVisible();
    await page.click('[data-testid="add-product-to-sale"]');
    await expect(page.locator('[data-testid="product-selector"]')).toBeVisible();
    await page.click('[data-testid="product-option"]:first-child');
    await page.fill('[data-testid="quantity-input"]', '2');
    await page.click('[data-testid="complete-sale-button"]');
    await expect(page.locator('[data-testid="sale-receipt"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should handle sale filtering', async ({ page }) => {
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-filter"]')).toBeVisible();
    await page.click('[data-testid="status-filter"]');
    await page.click('[data-testid="status-option"]:has-text("Completed")]');
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({ timeout: 3000 });
    const completedSales = page.locator('[data-testid="sale-status"]:has-text("Completed")');
    if (await completedSales.count() > 0) {
      await expect(completedSales.first()).toBeVisible();
    }
  });
});

test.describe('Performance Tests', () => {
  test.use({ storageState: 'auth-state.json' });

  test('should load dashboard within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="total-revenue"]');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large data sets efficiently', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="nav-products"]');
    const startTime = Date.now();
    
    await page.evaluate(() => {
      const products = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 1000)
      }));
      window.dispatchEvent(new CustomEvent('load-large-dataset', { detail: products }));
    });
    
    await page.waitForTimeout(1000);
    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(2000);
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
  });
});
