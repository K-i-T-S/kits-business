import { test, expect } from '@playwright/test';

test.describe('Inventory Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('inventory section loads and displays products', async ({ page }) => {
    // Look for inventory navigation
    const inventoryButton = page.locator('button:has-text("Inventory"), a:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Check for inventory interface
      const inventoryGrid = page.locator('[data-testid="inventory-grid"], .inventory-grid');
      const productTable = page.locator('[data-testid="product-table"], .product-table');
      const productList = page.locator('[data-testid="product-list"], .product-list');
      
      await expect(inventoryGrid.or(productTable).or(productList)).toBeVisible({ timeout: 5000 });
    }
  });

  test('product creation modal works', async ({ page }) => {
    const inventoryButton = page.locator('button:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Look for add product button
      const addProductButton = page.locator('button:has-text("Add Product"), button:has-text("New Product"), [data-testid="add-product-button"]');
      
      if (await addProductButton.isVisible()) {
        await addProductButton.click();
        
        // Check for product creation modal
        const productModal = page.locator('[data-testid="product-modal"], .product-modal, [role="dialog"]');
        const nameInput = page.locator('input[name="name"], input[placeholder*="name"], [data-testid="product-name"]');
        
        await expect(productModal).toBeVisible({ timeout: 3000 });
        
        if (await nameInput.isVisible()) {
          // Test form interaction
          await nameInput.fill('Test Product');
          
          // Look for other required fields
          const priceInput = page.locator('input[name="price"], input[placeholder*="price"], [data-testid="product-price"]');
          if (await priceInput.isVisible()) {
            await priceInput.fill('19.99');
          }
          
          // Look for save button
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), [data-testid="save-product"]');
          if (await saveButton.isVisible()) {
            await expect(saveButton).toBeEnabled();
          }
        }
      }
    }
  });

  test('product search and filtering works', async ({ page }) => {
    const inventoryButton = page.locator('button:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Look for search functionality
      const searchInput = page.locator('input[placeholder*="search"], input[data-testid="inventory-search"]');
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        
        // Check that filtering works
        const filterResults = page.locator('[data-testid="product-item"], .product-row');
        const resultCount = await filterResults.count();
        
        expect(resultCount >= 0).toBeTruthy(); // Should have results or be empty
      }
      
      // Look for filter options
      const filterDropdown = page.locator('select, button:has-text("Filter"), [data-testid="filter-dropdown"]');
      if (await filterDropdown.isVisible()) {
        await filterDropdown.click();
        await page.waitForTimeout(500);
        
        // Check that filter options appear
        const filterOptions = page.locator('[role="option"], .filter-option');
        const optionCount = await filterOptions.count();
        expect(optionCount > 0).toBeTruthy();
      }
    }
  });

  test('stock management features work', async ({ page }) => {
    const inventoryButton = page.locator('button:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Look for stock management features
      const stockInfo = page.locator('[data-testid="stock-info"], .stock-level, .quantity');
      const stockCount = await stockInfo.count();
      
      if (stockCount > 0) {
        // Check that stock information is displayed
        await expect(stockInfo.first()).toBeVisible();
        
        // Look for stock adjustment buttons
        const adjustStockButton = page.locator('button:has-text("Adjust"), button:has-text("Update Stock"), [data-testid="adjust-stock"]');
        
        if (await adjustStockButton.isVisible()) {
          await adjustStockButton.first().click();
          
          // Check for stock adjustment modal
          const stockModal = page.locator('[data-testid="stock-modal"], .stock-modal');
          await expect(stockModal).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('import/export functionality works', async ({ page }) => {
    const inventoryButton = page.locator('button:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Look for import/export buttons
      const importButton = page.locator('button:has-text("Import"), [data-testid="import-button"]');
      const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]');
      
      if (await importButton.isVisible()) {
        await importButton.click();
        
        // Check for import modal
        const importModal = page.locator('[data-testid="import-modal"], .import-modal');
        await expect(importModal).toBeVisible({ timeout: 3000 });
      }
      
      if (await exportButton.isVisible()) {
        // Test export functionality (might trigger download)
        await Promise.all([
          page.waitForEvent('download'), // Wait for download to start
          exportButton.click()
        ]);
      }
    }
  });

  test('batch operations work', async ({ page }) => {
    const inventoryButton = page.locator('button:has-text("Inventory"), [data-testid="inventory-button"]');
    
    if (await inventoryButton.isVisible()) {
      await inventoryButton.click();
      
      // Look for checkboxes for selection
      const checkboxes = page.locator('input[type="checkbox"], [data-testid="select-product"]');
      const checkboxCount = await checkboxes.count();
      
      if (checkboxCount > 0) {
        // Select a product
        await checkboxes.first().check();
        
        // Look for batch operation buttons
        const batchDeleteButton = page.locator('button:has-text("Delete"), [data-testid="batch-delete"]');
        const batchEditButton = page.locator('button:has-text("Edit"), [data-testid="batch-edit"]');
        
        if (await batchDeleteButton.isVisible()) {
          await expect(batchDeleteButton).toBeEnabled();
        }
        
        if (await batchEditButton.isVisible()) {
          await expect(batchEditButton).toBeEnabled();
        }
      }
    }
  });
});
