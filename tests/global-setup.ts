export default async function globalSetup() {
  console.log('Setting up visual regression tests...');
  
  // Create directories for screenshots
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  const baselineDir = path.join(process.cwd(), 'test-results', 'baseline');
  
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.mkdir(baselineDir, { recursive: true });
    console.log('Screenshot directories created');
  } catch (error) {
    console.error('Error creating directories:', error);
  }
  
  // Set up any global test data or state
  process.env.VISUAL_TESTING = 'true';
  
  return async () => {
    // Global cleanup
    console.log('Cleaning up visual regression tests...');
    delete process.env.VISUAL_TESTING;
  };
}
