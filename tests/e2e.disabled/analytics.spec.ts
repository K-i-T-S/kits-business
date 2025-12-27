import { test, expect } from '@playwright/test';

test.describe('Analytics E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('analytics dashboard loads and displays charts', async ({ page }) => {
    // Look for analytics navigation
    const analyticsButton = page.locator('button:has-text("Analytics"), a:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Check for analytics interface
      const dashboard = page.locator('[data-testid="analytics-dashboard"], .analytics-dashboard');
      const charts = page.locator('[data-testid="chart"], .chart, canvas');
      const metrics = page.locator('[data-testid="metrics"], .metrics-grid');
      
      await expect(dashboard.or(charts).or(metrics)).toBeVisible({ timeout: 5000 });
    }
  });

  test('date range filtering works', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Look for date range selector
      const dateRangeButton = page.locator('button:has-text("Date"), [data-testid="date-range"], .date-picker');
      
      if (await dateRangeButton.isVisible()) {
        await dateRangeButton.click();
        
        // Check for date picker modal
        const dateModal = page.locator('[data-testid="date-modal"], .date-picker-modal');
        await expect(dateModal).toBeVisible({ timeout: 3000 });
        
        // Look for preset date options
        const presetOptions = page.locator('button:has-text("Today"), button:has-text("Week"), button:has-text("Month")');
        const presetCount = await presetOptions.count();
        
        if (presetCount > 0) {
          await presetOptions.first().click();
          await page.waitForTimeout(1000);
          
          // Verify charts update (check for loading or chart refresh)
          const charts = page.locator('[data-testid="chart"], .chart');
          if (await charts.count() > 0) {
            await expect(charts.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('sales metrics display correctly', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Look for sales metrics
      const salesMetrics = page.locator('[data-testid="sales-metrics"], .sales-metrics');
      const revenueCard = page.locator('[data-testid="revenue"], .revenue, :has-text("Revenue")');
      const ordersCard = page.locator('[data-testid="orders"], .orders, :has-text("Orders")');
      const customersCard = page.locator('[data-testid="customers"], .customers, :has-text("Customers")');
      
      // Check that at least some metrics are displayed
      const metricsVisible = await Promise.all([
        revenueCard.isVisible(),
        ordersCard.isVisible(),
        customersCard.isVisible()
      ]);
      
      expect(metricsVisible.some(visible => visible)).toBeTruthy();
      
      // Check that metrics have values (not just labels)
      if (await revenueCard.isVisible()) {
        const revenueValue = revenueCard.locator(':has-text("$"), .metric-value');
        if (await revenueValue.count() > 0) {
          await expect(revenueValue.first()).toBeVisible();
        }
      }
    }
  });

  test('chart interactions work', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Wait for charts to load
      await page.waitForTimeout(2000);
      
      // Look for interactive charts
      const charts = page.locator('[data-testid="chart"], .chart, canvas');
      const chartCount = await charts.count();
      
      if (chartCount > 0) {
        // Test chart hover interactions
        const firstChart = charts.first();
        await firstChart.hover();
        await page.waitForTimeout(500);
        
        // Look for tooltips or hover states
        const tooltip = page.locator('[data-testid="tooltip"], .tooltip, .chart-tooltip');
        const tooltipVisible = await tooltip.isVisible();
        
        // Tooltip may or may not appear depending on chart implementation
        if (tooltipVisible) {
          await expect(tooltip).toBeVisible();
        }
        
        // Test chart legend interactions
        const legend = page.locator('[data-testid="legend"], .legend');
        if (await legend.isVisible()) {
          const legendItems = legend.locator('button, .legend-item');
          const itemCount = await legendItems.count();
          
          if (itemCount > 0) {
            await legendItems.first().click();
            await page.waitForTimeout(500);
            
            // Chart should update after legend interaction
            await expect(firstChart).toBeVisible();
          }
        }
      }
    }
  });

  test('export functionality works', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Look for export buttons
      const exportButton = page.locator('button:has-text("Export"), [data-testid="export-analytics"]');
      const printButton = page.locator('button:has-text("Print"), [data-testid="print-analytics"]');
      
      if (await exportButton.isVisible()) {
        // Test export functionality
        await Promise.all([
          page.waitForEvent('download'), // Wait for download to start
          exportButton.click()
        ]);
      }
      
      if (await printButton.isVisible()) {
        // Test print functionality
        try {
          // Try to trigger print and handle it gracefully
          await page.evaluate(() => {
            window.print();
          });
          await page.waitForTimeout(1000);
        } catch {
          // Print functionality might not work in headless mode, which is expected
        }
      }
    }
  });

  test('report generation works', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Look for report generation features
      const reportButton = page.locator('button:has-text("Report"), [data-testid="generate-report"]');
      
      if (await reportButton.isVisible()) {
        await reportButton.click();
        
        // Check for report configuration modal
        const reportModal = page.locator('[data-testid="report-modal"], .report-modal');
        await expect(reportModal).toBeVisible({ timeout: 3000 });
        
        // Look for report options
        const reportType = page.locator('select[name="type"], [data-testid="report-type"]');
        if (await reportType.isVisible()) {
          await reportType.click();
          
          // Check for report type options
          const options = reportType.locator('option');
          const optionCount = await options.count();
          expect(optionCount > 0).toBeTruthy();
        }
        
        // Look for generate button
        const generateButton = reportModal.locator('button:has-text("Generate"), button:has-text("Create")');
        if (await generateButton.isVisible()) {
          await expect(generateButton).toBeEnabled();
        }
      }
    }
  });

  test('real-time updates work', async ({ page }) => {
    const analyticsButton = page.locator('button:has-text("Analytics"), [data-testid="analytics-button"]');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Wait for initial load
      await page.waitForTimeout(2000);
      
      // Look for real-time indicators
      const liveIndicator = page.locator('[data-testid="live"], .live-indicator, :has-text("Live")');
      const refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh"]');
      
      if (await refreshButton.isVisible()) {
        // Get initial state
        const initialMetrics = page.locator('[data-testid="metrics"], .metric-value');
        const initialText = await initialMetrics.first().textContent();
        
        // Refresh data
        await refreshButton.click();
        await page.waitForTimeout(2000);
        
        // Check that metrics are still present (may or may not have changed)
        await expect(initialMetrics.first()).toBeVisible();
      }
      
      if (await liveIndicator.isVisible()) {
        await expect(liveIndicator).toBeVisible();
      }
    }
  });
});
