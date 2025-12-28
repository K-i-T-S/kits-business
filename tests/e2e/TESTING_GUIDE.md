# Testing Infrastructure Guide

## Overview

The testing infrastructure has been completely overhauled to provide comprehensive, reliable, and maintainable tests. This guide covers the new setup and how to use it effectively.

## New Architecture

### 1. Unified Authentication Mocking (`auth.setup.ts`)
- **Multiple user roles**: admin, employee, viewer, multi-tenant
- **Consistent auth state**: Proper localStorage mocking and API route handling
- **Test utilities**: Helper functions for login, logout, and auth verification

### 2. Comprehensive Test Data Fixtures (`test-data.setup.ts`)
- **Realistic test data**: Products, sales, customers, employees
- **API mocking**: Automatic endpoint mocking with test data
- **Scenario builders**: Pre-configured test scenarios for different use cases

### 3. Proper Test Isolation (`isolation.setup.ts`)
- **Clean state**: Automatic cleanup between tests
- **Storage clearing**: localStorage, sessionStorage, cookies, IndexedDB
- **Mock reset**: Clean API routes and prevent test interference

### 4. Visual Testing Support
- **Consistent viewports**: Standardized screen sizes
- **Screenshot capture**: Automatic screenshots on failures
- **Visual regression**: Baseline images for comparison

## Usage Examples

### Basic Authentication Test
```typescript
import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from './auth.setup';

test('unauthenticated user sees login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
});

authenticatedTest('authenticated user sees dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.locator('[data-testid="total-products"]')).toBeVisible();
});
```

### Role-Based Testing
```typescript
import { test as adminTest } from './auth.setup';

adminTest('admin can access employee management', async ({ adminPage }) => {
  await adminPage.goto('/employees');
  await expect(adminPage.locator('[data-testid="employee-list"]')).toBeVisible();
});
```

### Test Data Integration
```typescript
import { test as dataTest } from './test-data.setup';

dataTest('dashboard displays test data', async ({ page, testScenario }) => {
  await page.goto('/dashboard');
  // Test data is automatically mocked
  await expect(page.locator('[data-testid="total-products"]')).toBeVisible();
});
```

## Test Fixtures

### Authentication Fixtures
- `authenticatedPage`: Standard authenticated user
- `unauthenticatedPage`: Logged out user
- `adminPage`: Admin role user
- `employeePage`: Employee role user
- `viewerPage`: Read-only user
- `multiTenantPage`: Multi-tenant context user

### Data Fixtures
- `testProducts`: Array of test products
- `testSales`: Array of test sales
- `testCustomers`: Array of test customers
- `testEmployees`: Array of test employees
- `testScenario`: Complete test scenario with all data

### Isolation Fixtures
- `isolatedPage`: Clean page with reset state
- `cleanContext`: Fresh browser context

## UI Selectors

All tests use consistent `data-testid` selectors:
- Login: `[data-testid="email-input"]`, `[data-testid="password-input"]`, `[data-testid="login-button"]`
- Dashboard: `[data-testid="total-products"]`, `[data-testid="total-revenue"]`, etc.
- Error states: `[data-testid="error-message"]`
- Navigation: `[data-testid="nav-{page}"]`

## Best Practices

### 1. Test Isolation
- Each test runs in a clean environment
- No shared state between tests
- Automatic cleanup before and after each test

### 2. Data Management
- Use test fixtures instead of hardcoded data
- Mock API responses consistently
- Validate data structure in tests

### 3. Visual Testing
- Take screenshots at key points
- Use consistent viewports
- Update snapshots when UI changes

### 4. Error Handling
- Test both success and failure scenarios
- Mock network errors and edge cases
- Verify error messages are accessible

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Specific Test File
```bash
npx playwright test tests/e2e/infrastructure-demo.spec.ts
```

### With UI Mode
```bash
npx playwright test --ui
```

### Update Snapshots
```bash
npx playwright test --update-snapshots
```

## Debugging

### Screenshots on Failure
Automatic screenshots are saved to `test-failures/` directory with descriptive names.

### Trace Files
Enable trace viewing for detailed debugging:
```bash
npx playwright test --trace on
```

### Slow Mode
For debugging, uncomment the slow mode in test setup:
```typescript
test.slow();
```

## Migration Guide

### From Old Tests
1. Replace old auth imports with new `auth.setup`
2. Update selectors to use `data-testid`
3. Add test data fixtures instead of manual mocking
4. Ensure proper test isolation

### Common Issues
- **Missing fixtures**: Import the correct setup file
- **Selector failures**: Update to use `data-testid` attributes
- **Test interference**: Ensure proper isolation setup
- **Flaky tests**: Check for timing issues and add proper waits

## Maintenance

### Updating Test Data
Edit `tests/fixtures/test-data.ts` to modify test scenarios and data.

### Adding New Fixtures
Create new setup files following the established patterns.

### Visual Regression Updates
When UI changes intentionally, update snapshots:
```bash
npx playwright test --update-snapshots
```

## Performance Considerations

- Tests run in parallel by default
- Use proper waits instead of fixed timeouts
- Mock external APIs to avoid network dependencies
- Clean up resources between tests

This infrastructure provides a solid foundation for reliable, maintainable tests that catch bugs early and prevent regressions.
