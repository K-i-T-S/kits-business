import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Set up mock authentication in localStorage
    await page.goto('http://localhost:3000');
    
    // Set mock auth data in localStorage
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
    
    // Save storage state for reuse across tests
    await context.storageState({ 
      path: path.join(__dirname, 'auth-state.json') 
    });
    
    console.log('Authentication state created successfully');
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
