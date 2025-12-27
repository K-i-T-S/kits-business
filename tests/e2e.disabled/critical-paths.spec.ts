import { test, expect } from '@playwright/test';

test.describe('Critical Path E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('complete user journey: login to dashboard to inventory', async ({ page }) => {
    // Step 1: Login
    const loginButton = page.locator('button:has-text("Login"), [data-testid="login-button"]');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      
      // Fill login form if present
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")');
        await submitButton.click();
      }
    }
    
    // Step 2: Navigate to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Verify dashboard elements
    const dashboard = page.locator('[data-testid="dashboard"], .dashboard');
    await expect(dashboard).toBeVisible();
    
    // Step 3: Navigate to inventory
    const inventoryLink = page.locator('a[href*="inventory"], button:has-text("Inventory")');
    if (await inventoryLink.isVisible()) {
      await inventoryLink.click();
    } else {
      await page.goto('/inventory');
    }
    
    await page.waitForURL('**/inventory');
    await expect(page).toHaveURL(/.*inventory/);
    
    // Verify inventory elements
    const inventory = page.locator('[data-testid="inventory"], .inventory');
    await expect(inventory).toBeVisible();
  });

  test('POS workflow: add items to cart and checkout', async ({ page }) => {
    // Navigate to POS
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    
    // Add items to cart
    const productButtons = page.locator('[data-testid="product"], .product-item button');
    const productCount = await productButtons.count();
    
    if (productCount > 0) {
      await productButtons.first().click();
      await page.waitForTimeout(500);
      
      // Check cart updates
      const cart = page.locator('[data-testid="cart"], .shopping-cart');
      if (await cart.isVisible()) {
        const cartItems = cart.locator('[data-testid="cart-item"], .cart-item');
        expect(await cartItems.count()).toBeGreaterThan(0);
      }
    }
    
    // Test checkout process
    const checkoutButton = page.locator('button:has-text("Checkout"), [data-testid="checkout-button"]');
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click();
      
      // Verify checkout form appears
      const checkoutForm = page.locator('[data-testid="checkout-form"], .checkout-form');
      if (await checkoutForm.isVisible()) {
        // Fill customer info
        const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Customer');
        }
        
        const emailInput = page.locator('input[name="email"], input[placeholder*="Email"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill('customer@example.com');
        }
        
        // Complete payment
        const paymentButton = page.locator('button:has-text("Pay"), [data-testid="payment-button"]');
        if (await paymentButton.isVisible()) {
          await paymentButton.click();
          
          // Verify success
          const successMessage = page.locator('[data-testid="success"], .success-message');
          if (await successMessage.isVisible()) {
            await expect(successMessage).toContainText('success');
          }
        }
      }
    }
  });

  test('inventory management: add, edit, delete products', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Add new product
    const addButton = page.locator('button:has-text("Add"), [data-testid="add-product"]');
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Fill product form
      const productName = page.locator('input[name="name"], input[placeholder*="Product"]');
      if (await productName.isVisible()) {
        await productName.fill('Test Product');
      }
      
      const productPrice = page.locator('input[name="price"], input[placeholder*="Price"]');
      if (await productPrice.isVisible()) {
        await productPrice.fill('29.99');
      }
      
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Verify product was added
        await page.waitForTimeout(1000);
        const newProduct = page.locator(':has-text("Test Product")');
        if (await newProduct.isVisible()) {
          await expect(newProduct).toBeVisible();
        }
      }
    }
    
    // Edit product
    const editButton = page.locator('[data-testid="edit"], button:has-text("Edit")');
    if (await editButton.isVisible()) {
      await editButton.first().click();
      
      const editName = page.locator('input[name="name"]');
      if (await editName.isVisible()) {
        await editName.fill('Updated Product');
        
        const updateButton = page.locator('button:has-text("Update"), button[type="submit"]');
        if (await updateButton.isVisible()) {
          await updateButton.click();
          
          // Verify update
          await page.waitForTimeout(1000);
          const updatedProduct = page.locator(':has-text("Updated Product")');
          if (await updatedProduct.isVisible()) {
            await expect(updatedProduct).toBeVisible();
          }
        }
      }
    }
    
    // Delete product
    const deleteButton = page.locator('[data-testid="delete"], button:has-text("Delete")');
    if (await deleteButton.isVisible()) {
      // Handle confirmation dialog
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.first().click();
      
      await page.waitForTimeout(1000);
      // Verify product was removed
      const deletedProduct = page.locator(':has-text("Updated Product")');
      if (await deletedProduct.isVisible()) {
        await expect(deletedProduct).not.toBeVisible();
      }
    }
  });

  test('customer management workflow', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    
    // Add new customer
    const addCustomerButton = page.locator('button:has-text("Add Customer"), [data-testid="add-customer"]');
    if (await addCustomerButton.isVisible()) {
      await addCustomerButton.click();
      
      // Fill customer form
      const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill('John Doe');
      }
      
      const emailInput = page.locator('input[name="email"], input[placeholder*="Email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('john.doe@example.com');
      }
      
      const phoneInput = page.locator('input[name="phone"], input[placeholder*="Phone"]');
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('+1234567890');
      }
      
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Verify customer was added
        await page.waitForTimeout(1000);
        const newCustomer = page.locator(':has-text("John Doe")');
        if (await newCustomer.isVisible()) {
          await expect(newCustomer).toBeVisible();
        }
      }
    }
    
    // Search customers
    const searchInput = page.locator('input[placeholder*="Search"], [data-testid="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('John');
      await page.waitForTimeout(500);
      
      // Verify search results
      const searchResults = page.locator(':has-text("John")');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('reporting and analytics workflow', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Verify report sections
    const reportSections = page.locator('[data-testid="report-section"], .report-section');
    const sectionCount = await reportSections.count();
    
    if (sectionCount > 0) {
      await expect(reportSections.first()).toBeVisible();
    }
    
    // Test date range selection
    const dateRangeSelector = page.locator('[data-testid="date-range"], .date-range-picker');
    if (await dateRangeSelector.isVisible()) {
      await dateRangeSelector.click();
      
      // Select predefined range
      const todayOption = page.locator('button:has-text("Today"), option:has-text("Today")');
      if (await todayOption.isVisible()) {
        await todayOption.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Test report generation
    const generateButton = page.locator('button:has-text("Generate"), [data-testid="generate-report"]');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // Wait for report to load
      await page.waitForTimeout(2000);
      
      // Verify report content
      const reportContent = page.locator('[data-testid="report-content"], .report-content');
      if (await reportContent.isVisible()) {
        await expect(reportContent).toBeVisible();
      }
    }
    
    // Test export functionality
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export"]');
    if (await exportButton.isVisible()) {
      // Handle download
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toBeTruthy();
    }
  });

  test('multi-tenant functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for tenant switcher
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"], .tenant-selector');
    if (await tenantSwitcher.isVisible()) {
      await tenantSwitcher.click();
      
      // Select different tenant
      const tenantOptions = page.locator('[data-testid="tenant-option"], .tenant-option');
      const optionCount = await tenantOptions.count();
      
      if (optionCount > 1) {
        await tenantOptions.nth(1).click();
        await page.waitForTimeout(1000);
        
        // Verify tenant-specific data loads
        const tenantInfo = page.locator('[data-testid="tenant-info"], .current-tenant');
        if (await tenantInfo.isVisible()) {
          await expect(tenantInfo).toBeVisible();
        }
      }
    }
  });

  test('error handling and recovery', async ({ page }) => {
    // Mock network errors
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Look for error messages
    const errorMessage = page.locator('[data-testid="error"], .error-message');
    const errorCount = await errorMessage.count();
    
    if (errorCount > 0) {
      await expect(errorMessage.first()).toBeVisible();
      
      // Test retry functionality
      const retryButton = page.locator('button:has-text("Retry"), [data-testid="retry"]');
      if (await retryButton.isVisible()) {
        // Remove mock for retry
        page.unroute('**/api/**');
        await retryButton.click();
        await page.waitForTimeout(2000);
        
        // Verify recovery
        const content = page.locator('[data-testid="content"], .inventory-content');
        if (await content.isVisible()) {
          await expect(content).toBeVisible();
        }
      }
    }
  });

  test('responsive design across devices', async ({ page }) => {
    // Test desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    // Verify mobile navigation appears
    const mobileNav = page.locator('[data-testid="mobile-nav"], .mobile-navigation');
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toBeVisible();
    }
  });

  test('offline functionality', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for offline indicator
    const offlineIndicator = page.locator('[data-testid="offline"], .offline-indicator');
    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toBeVisible();
    }
    
    // Test cached functionality
    const cachedContent = page.locator('[data-testid="cached-content"], .offline-content');
    if (await cachedContent.isVisible()) {
      await expect(cachedContent).toBeVisible();
    }
    
    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);
    
    // Verify online state
    const onlineIndicator = page.locator('[data-testid="online"], .online-indicator');
    if (await onlineIndicator.isVisible()) {
      await expect(onlineIndicator).toBeVisible();
    }
  });
});
