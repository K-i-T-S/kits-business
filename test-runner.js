const { TestRunner } = require('@storybook/test-runner');

const config = {
  // URL pattern for Storybook
  url: 'http://localhost:6006',
  
  // Configuration for visual testing
  configDir: '.storybook',
  
  // Output directory for test results
  outputDir: 'test-results',
  
  // Browsers to test
  browsers: ['chromium'],
  
  // Stories to test
  stories: ['**/*.stories.@(js|jsx|ts|tsx)'],
  
  // Skip stories with these tags
  skipStoriesWithTags: ['dev-only', 'no-visual-test'],
  
  // Timeout for each story
  timeout: 5000,
  
  // Number of retries for failed tests
  retries: 2,
  
  // Viewports to test
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 1024 }
  ]
};

const runner = new TestRunner(config);
module.exports = runner;
