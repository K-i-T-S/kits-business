import { test, expect, chromium } from '@playwright/test';

const ROUTES = [
  '/dashboard',
  '/pos',
  '/inventory',
  '/reports',
  '/finance',
  '/employees',
  '/inventory/batch-tracking',
  '/inventory/suppliers',
  '/inventory/purchase-orders',
  '/crm',
  '/restaurant/table-management',
  '/restaurant/kitchen',
  '/restaurant/analytics',
  '/restaurant/settings',
  '/restaurant/reservations',
  '/restaurant/eod-report',
  '/restaurant/multi-branch',
  '/qr-menu',
  '/admin',
];

const NOISE_PATTERNS = [
  'SW registration failed',
  'unsupported MIME type',
  /^undefined$/,
];

function isNoise(msg: string): boolean {
  return NOISE_PATTERNS.some(p =>
    typeof p === 'string' ? msg.includes(p) : p.test(msg)
  );
}

test('live audit — collect all console errors across pages', async ({ page }) => {
  test.setTimeout(120000);
  const errors: { route: string; msg: string }[] = [];

  for (const route of ROUTES) {
    const pageErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isNoise(text)) pageErrors.push(text);
      }
    });
    page.on('pageerror', err => {
      if (!isNoise(err.message)) pageErrors.push(err.message);
    });

    try {
      await page.goto(`http://localhost:3000${route}`, { timeout: 10000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    } catch (_) { /* navigation timeout ok */ }

    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');

    for (const msg of pageErrors) {
      errors.push({ route, msg });
    }
  }

  console.log('\n=== ERRORS BY PAGE ===');
  const byRoute: Record<string, string[]> = {};
  for (const { route, msg } of errors) {
    (byRoute[route] ??= []).push(msg);
  }
  for (const [route, msgs] of Object.entries(byRoute)) {
    console.log(`\n${route}:`);
    msgs.forEach(m => console.log('  ' + m.slice(0, 200)));
  }
  if (Object.keys(byRoute).length === 0) console.log('No errors found');

  // Don't fail the test — we just want the output
  expect(true).toBe(true);
});
