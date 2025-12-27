import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  // Hook configuration
  async postVisit(page: any, context: any) {
    // Wait for any animations or lazy loading
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for visual regression testing
    await page.screenshot({
      path: `visual-tests/${context.title}-${context.name}.png`,
      fullPage: true
    });
    
    // Check for accessibility violations
    const violations = await page.accessibility.snapshot();
    if (violations && violations.length > 0) {
      console.warn(`Accessibility violations found in ${context.title}/${context.name}:`, violations);
    }
  },
  
  // Custom test cases
  async preRender(page: any, context: any) {
    // Set up test environment
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mock any required APIs
    await page.route('**/api/**', (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
  }
};

export default config;
