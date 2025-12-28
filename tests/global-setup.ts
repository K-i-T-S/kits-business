import { chromium, FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('Setting up visual regression tests...');
  
  // Ensure screenshot directories exist
  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  try {
    await fs.access(screenshotDir);
  } catch {
    await fs.mkdir(screenshotDir, { recursive: true });
  }
  
  // Set up any global test data or services
  console.log('Visual regression test setup complete');
}

export default globalSetup;
