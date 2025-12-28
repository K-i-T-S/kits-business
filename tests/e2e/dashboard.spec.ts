import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display dashboard overview', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('h1')).toContainText(/dashboard|overview/i);
    
    // Check for key metrics cards
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-customers"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-products"]')).toBeVisible();
    
    // Check for charts
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-chart"]')).toBeVisible();
  });

  test('should show recent activity', async ({ page }) => {
    // Check recent activity section
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
    
    // Should have activity items
    const activityItems = page.locator('[data-testid="activity-item"]');
    await expect(activityItems.first()).toBeVisible();
    
    // Check activity details
    await expect(page.locator('[data-testid="activity-timestamp"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="activity-description"]')).first().toBeVisible();
  });

  test('should handle date range filtering', async ({ page }) => {
    // Check date range selector
    await expect(page.locator('[data-testid="date-range-selector"]')).toBeVisible();
    
    // Select different date range
    await page.click('[data-testid="date-range-selector"]');
    await page.click('[data-testid="date-option"]:has-text("Last 7 Days")]');
    
    // Should update dashboard data
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({ timeout: 5000 });
    
    // Verify data updated
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
  });

  test('should handle real-time updates', async ({ page }) => {
    // Check for real-time indicator
    await expect(page.locator('[data-testid="real-time-indicator"]')).toBeVisible();
    
    // Simulate real-time update (this would normally come from WebSocket)
    await page.evaluate(() => {
      // Mock WebSocket message
      window.dispatchEvent(new CustomEvent('realtime-update', {
        detail: { type: 'new_order', data: { id: '123', amount: 99.99 } }
      }));
    });
    
    // Should show notification
    await expect(page.locator('[data-testid="notification"]')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Products Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.click('[data-testid="nav-products"]');
    await expect(page).toHaveURL('/products');
  });

  test('should display products list', async ({ page }) => {
    // Check products page heading
    await expect(page.locator('h1')).toContainText(/products/i);
    
    // Check for products table
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
    
    // Check for product rows
    const productRows = page.locator('[data-testid="product-row"]');
    await expect(productRows.first()).toBeVisible();
    
    // Check product columns
    await expect(page.locator('[data-testid="product-name"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="product-price"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="product-stock"]')).first().toBeVisible();
  });

  test('should handle product search', async ({ page }) => {
    // Check search input
    await expect(page.locator('[data-testid="product-search"]')).toBeVisible();
    
    // Search for product
    await page.fill('[data-testid="product-search"]', 'Laptop');
    await page.press('[data-testid="product-search"]', 'Enter');
    
    // Should filter results
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({ timeout: 5000 });
    
    // Verify search results
    const searchResults = page.locator('[data-testid="product-row"]');
    if (await searchResults.count() > 0) {
      await expect(searchResults.first()).toContainText('Laptop');
    }
  });

  test('should handle product creation', async ({ page }) => {
    // Click add product button
    await page.click('[data-testid="add-product-button"]');
    
    // Should show product form modal
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible();
    
    // Fill product form
    await page.fill('[data-testid="product-name-input"]', 'Test Product');
    await page.fill('[data-testid="product-price-input"]', '29.99');
    await page.fill('[data-testid="product-description-input"]', 'Test description');
    await page.fill('[data-testid="product-stock-input"]', '100');
    
    // Submit form
    await page.click('[data-testid="save-product-button"]');
    
    // Should close modal and refresh list
    await expect(page.locator('[data-testid="product-form"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Verify product added
    await expect(page.locator('[data-testid="product-row"]:has-text("Test Product")]')).toBeVisible();
  });

  test('should handle product editing', async ({ page }) => {
    // Click edit button on first product
    await page.click('[data-testid="product-row"] [data-testid="edit-button"]');
    
    // Should show product form with pre-filled data
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-name-input"]')).toHaveValue(/\w+/);
    
    // Update product
    await page.fill('[data-testid="product-name-input"]', 'Updated Product');
    await page.click('[data-testid="save-product-button"]');
    
    // Should update product
    await expect(page.locator('[data-testid="product-form"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-row"]:has-text("Updated Product")]')).toBeVisible();
  });

  test('should handle product deletion', async ({ page }) => {
    // Get initial product count
    const initialCount = await page.locator('[data-testid="product-row"]').count();
    
    // Click delete button on first product
    await page.click('[data-testid="product-row"] [data-testid="delete-button"]');
    
    // Should show confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Should delete product
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeHidden();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Verify product deleted
    const finalCount = await page.locator('[data-testid="product-row"]').count();
    expect(finalCount).toBe(initialCount - 1);
  });
});

test.describe('Sales Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to sales
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.click('[data-testid="nav-sales"]');
    await expect(page).toHaveURL('/sales');
  });

  test('should display sales list', async ({ page }) => {
    // Check sales page heading
    await expect(page.locator('h1')).toContainText(/sales/i);
    
    // Check for sales table
    await expect(page.locator('[data-testid="sales-table"]')).toBeVisible();
    
    // Check for sale rows
    const saleRows = page.locator('[data-testid="sale-row"]');
    await expect(saleRows.first()).toBeVisible();
    
    // Check sale columns
    await expect(page.locator('[data-testid="sale-id"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="sale-date"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="sale-total"]')).first().toBeVisible();
    await expect(page.locator('[data-testid="sale-status"]')).first().toBeVisible();
  });

  test('should handle sale creation', async ({ page }) => {
    // Click new sale button
    await page.click('[data-testid="new-sale-button"]');
    
    // Should show sale form
    await expect(page.locator('[data-testid="sale-form"]')).toBeVisible();
    
    // Add products to sale
    await page.click('[data-testid="add-product-to-sale"]');
    await expect(page.locator('[data-testid="product-selector"]')).toBeVisible();
    await page.click('[data-testid="product-option"]:first-child');
    
    // Set quantity
    await page.fill('[data-testid="quantity-input"]', '2');
    
    // Complete sale
    await page.click('[data-testid="complete-sale-button"]');
    
    // Should create sale and show receipt
    await expect(page.locator('[data-testid="sale-receipt"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should handle sale filtering', async ({ page }) => {
    // Check filter options
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-filter"]')).toBeVisible();
    
    // Filter by status
    await page.click('[data-testid="status-filter"]');
    await page.click('[data-testid="status-option"]:has-text("Completed")]');
    
    // Should filter results
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({ timeout: 5000 });
    
    // Verify filtered results show completed status
    const completedSales = page.locator('[data-testid="sale-status"]:has-text("Completed")');
    if (await completedSales.count() > 0) {
      await expect(completedSales.first()).toBeVisible();
    }
  });
});

test.describe('Performance Tests', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    // Start performance monitoring
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard');
    await page.waitForSelector('[data-testid="total-revenue"]');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle large data sets efficiently', async ({ page }) => {
    // Login and navigate to products
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.click('[data-testid="nav-products"]');
    
    // Monitor performance during data loading
    const startTime = Date.now();
    
    // Trigger large data load (simulate 1000 products)
    await page.evaluate(() => {
      // Mock large dataset
      const products = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 1000)
      }));
      
      // Simulate rendering large dataset
      window.dispatchEvent(new CustomEvent('load-large-dataset', { detail: products }));
    });
    
    // Wait for data to render
    await page.waitForTimeout(2000);
    
    const renderTime = Date.now() - startTime;
    
    // Should render within 3 seconds
    expect(renderTime).toBeLessThan(3000);
    
    // Should still be responsive
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
  });
});
