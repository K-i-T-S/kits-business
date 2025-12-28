# Authentication Mocking Documentation

This guide covers how to use the comprehensive authentication mocking utilities for testing in the Kitsaiobusinessterminal project.

## Overview

The authentication mocking system provides realistic test scenarios for different authentication states, user roles, and multi-tenant configurations. It supports both unit/integration tests (Vitest) and end-to-end tests (Playwright).

## Table of Contents

1. [Core Components](#core-components)
2. [Unit/Integration Testing](#unitintegration-testing)
3. [End-to-End Testing](#end-to-end-testing)
4. [Auth Scenarios](#auth-scenarios)
5. [Common Patterns](#common-patterns)
6. [Examples](#examples)

## Core Components

### Types

```typescript
interface MockUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface MockTenant {
  id: string;
  name: string;
  slug: string;
  user_role: 'owner' | 'admin' | 'employee' | 'viewer';
  user_active: boolean;
  tenant_active: boolean;
  settings?: Record<string, any>;
}

interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
```

### AuthMockManager

The main class for managing authentication state in tests:

```typescript
import { AuthMockManager } from '../test-utils/mocks';

const manager = new AuthMockManager();
```

Key methods:
- `setUnauthenticated()` - Sets user as logged out
- `setAuthenticated(user?, tenant?)` - Sets user as logged in
- `setMultiTenantUser(user?, tenants?)` - Sets user with multiple tenants
- `simulateLogin(user?)` - Simulates successful login
- `simulateLoginError(error?)` - Simulates login failure
- `triggerAuthStateChange(session, callback?)` - Triggers auth state changes
- `reset()` - Resets all mocks

## Unit/Integration Testing

### Basic Setup

```typescript
import { render, screen } from '@testing-library/react';
import { AuthMockManager, authScenarios } from '../test-utils/mocks';

describe('Component Tests', () => {
  let manager: AuthMockManager;

  beforeEach(() => {
    manager = new AuthMockManager();
  });

  afterEach(() => {
    manager.reset();
  });
});
```

### Using Auth Scenarios

```typescript
import { authScenarios } from '../test-utils/mocks';

// Unauthenticated user
test('shows login when not authenticated', () => {
  const manager = authScenarios.unauthenticated();
  // Test component behavior for unauthenticated state
});

// Authenticated user
test('shows dashboard when authenticated', () => {
  const { mockUser, mockTenant } = authScenarios.authenticated(
    { email: 'user@example.com' },
    { name: 'Test Business' }
  );
  // Test component behavior for authenticated state
});

// Admin user
test('shows admin features for admin user', () => {
  const { mockUser, mockTenant } = authScenarios.admin(
    { email: 'admin@example.com' }
  );
  // Test admin-specific functionality
});

// Multi-tenant user
test('handles tenant switching', () => {
  const { mockUser, mockTenants } = authScenarios.multiTenant(
    { email: 'multi@example.com' },
    [
      { name: 'Business One' },
      { name: 'Business Two' }
    ]
  );
  // Test multi-tenant functionality
});
```

### Manual Auth Management

```typescript
import { AuthMockManager } from '../test-utils/mocks';

test('handles login flow', async () => {
  const manager = new AuthMockManager();
  
  // Start unauthenticated
  manager.setUnauthenticated();
  
  // Simulate login
  const { mockUser, mockSession } = manager.simulateLogin({
    email: 'test@example.com',
    name: 'Test User'
  });
  
  // Test post-login behavior
  expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
});
```

### Testing Auth State Changes

```typescript
test('responds to auth state changes', () => {
  const manager = new AuthMockManager();
  const callback = vi.fn();
  
  // Set up auth state listener
  const subscription = manager.triggerAuthStateChange(null, callback);
  
  // Simulate user login
  const mockSession = manager.createMockSession({ email: 'user@example.com' });
  manager.triggerAuthStateChange(mockSession, callback);
  
  // Verify callback was called
  expect(callback).toHaveBeenCalledWith('SIGNED_IN', mockSession);
});
```

## End-to-End Testing

### Using Auth Fixtures

```typescript
import { test, authTestUtils } from './auth-mocks';

// Test with authenticated user
test('authenticated user can access dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.locator('h1')).toContainText('Welcome back');
});

// Test with unauthenticated user
test('unauthenticated user redirected to login', async ({ unauthenticatedPage }) => {
  await unauthenticatedPage.goto('/dashboard');
  await expect(unauthenticatedPage).toHaveURL('/login');
});

// Test with admin user
test('admin can access admin features', async ({ adminPage }) => {
  await adminPage.goto('/admin');
  await expect(adminPage.locator('[data-testid="admin-panel"]')).toBeVisible();
});

// Test with employee user
test('employee has limited access', async ({ employeePage }) => {
  await employeePage.goto('/admin');
  await expect(employeePage).toHaveURL('/unauthorized');
});

// Test multi-tenant user
test('multi-tenant user can switch tenants', async ({ multiTenantPage }) => {
  await multiTenantPage.goto('/dashboard');
  await multiTenantPage.click('[data-testid="tenant-switcher"]');
  await expect(multiTenantPage.locator('[data-testid="tenant-option"]')).toHaveCount(2);
});
```

### Manual Auth Setup

```typescript
import { test, authTestUtils } from './auth-mocks';

test('custom auth scenario', async ({ page }) => {
  // Mock custom auth endpoints
  await page.route('**/auth/v1/session', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: {
            user: { id: 'custom-user', email: 'custom@example.com' },
            access_token: 'custom-token'
          }
        }
      })
    });
  });

  // Set localStorage
  await page.addInitScript(() => {
    localStorage.setItem('sb-test-auth-token', JSON.stringify({
      user: { id: 'custom-user', email: 'custom@example.com' },
      access_token: 'custom-token'
    }));
  });

  await page.goto('/dashboard');
  // Test custom scenario
});
```

### Auth Test Utilities

```typescript
import { authTestUtils } from './auth-mocks';

test('auth utilities', async ({ page }) => {
  // Simulate login
  await authTestUtils.simulateLogin(page, 'user@example.com', 'password123');
  
  // Check if authenticated
  const isAuth = await authTestUtils.isAuthenticated(page);
  expect(isAuth).toBe(true);
  
  // Get current user
  const user = await authTestUtils.getCurrentUser(page);
  expect(user.email).toBe('user@example.com');
  
  // Simulate logout
  await authTestUtils.simulateLogout(page);
  
  // Mock API errors
  await authTestUtils.mockAuthError(page, 'api/protected', 'Access denied');
});
```

## Auth Scenarios

### Pre-configured Scenarios

1. **unauthenticated** - User is logged out
2. **authenticated** - Basic authenticated user
3. **multiTenant** - User with access to multiple tenants
4. **admin** - Admin user with elevated permissions
5. **employee** - Employee user with limited permissions
6. **viewer** - Read-only user

### Custom Scenarios

```typescript
import { AuthMockManager, createMockUser, createMockTenant } from '../test-utils/mocks';

const manager = new AuthMockManager();

// Custom user with specific metadata
const customUser = createMockUser({
  email: 'custom@example.com',
  user_metadata: { department: 'IT', role: 'developer' }
});

// Custom tenant with specific settings
const customTenant = createMockTenant({
  name: 'Custom Business',
  user_role: 'admin',
  settings: { featureFlags: { beta: true } }
});

manager.setAuthenticated(customUser, customTenant);
```

## Common Patterns

### Testing Protected Routes

```typescript
import { authScenarios } from '../test-utils/mocks';

describe('Protected Routes', () => {
  test('redirects unauthenticated users', () => {
    authScenarios.unauthenticated();
    // Test route protection
  });

  test('allows authenticated users', () => {
    authScenarios.authenticated();
    // Test route access
  });

  test('enforces role-based access', () => {
    authScenarios.viewer(); // Test with limited role
    // Test role restrictions
  });
});
```

### Testing API Calls

```typescript
import { AuthMockManager } from '../test-utils/mocks';

describe('API Integration', () => {
  let manager: AuthMockManager;

  beforeEach(() => {
    manager = new AuthMockManager();
    manager.setAuthenticated();
  });

  test('includes auth headers in API calls', async () => {
    // Test that API calls include proper authentication
    const response = await api.get('/protected-endpoint');
    expect(response).toBeDefined();
  });
});
```

### Testing Error Scenarios

```typescript
import { authTestUtils } from '../test-utils/mocks';

describe('Error Handling', () => {
  test('handles session expiration', () => {
    const manager = new AuthMockManager();
    manager.simulateSessionExpiration();
    // Test session expiration handling
  });

  test('handles login errors', () => {
    const manager = new AuthMockManager();
    manager.simulateLoginError('Invalid credentials');
    // Test error display and handling
  });
});
```

## Examples

### Complete Component Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthMockManager } from '../test-utils/mocks';
import UserProfile from '../components/UserProfile';

describe('UserProfile Component', () => {
  let manager: AuthMockManager;

  beforeEach(() => {
    manager = new AuthMockManager();
  });

  afterEach(() => {
    manager.reset();
  });

  test('shows user info when authenticated', () => {
    manager.setAuthenticated({
      email: 'john@example.com',
      name: 'John Doe'
    });

    render(<UserProfile />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  test('shows login prompt when unauthenticated', () => {
    manager.setUnauthenticated();

    render(<UserProfile />);
    
    expect(screen.getByText('Please log in')).toBeInTheDocument();
  });

  test('handles logout', () => {
    manager.setAuthenticated();
    
    render(<UserProfile />);
    
    fireEvent.click(screen.getByText('Logout'));
    
    // Verify logout behavior
    expect(screen.getByText('Please log in')).toBeInTheDocument();
  });
});
```

### Complete E2E Test

```typescript
import { test, authTestUtils } from './auth-mocks';

test.describe('Authentication Flow', () => {
  test('complete login flow', async ({ page }) => {
    // Start at login page
    await page.goto('/login');
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user info displayed
    await expect(page.locator('[data-testid="user-email"]')).toContainText('user@example.com');
    
    // Test logout
    await authTestUtils.simulateLogout(page);
    await expect(page).toHaveURL('/login');
  });

  test('handles invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });
});
```

## Best Practices

1. **Always reset mocks** in afterEach to prevent test interference
2. **Use auth scenarios** for consistent, pre-configured states
3. **Test both success and error cases** for robust coverage
4. **Mock realistic data** that matches your production schema
5. **Use TypeScript interfaces** for type safety
6. **Keep auth logic separate** from component logic for easier testing
7. **Test edge cases** like session expiration, network errors, etc.

## Troubleshooting

### Common Issues

1. **Mock not applied**: Ensure mocks are set up before component renders
2. **Type errors**: Check that you're importing from the correct path
3. **Test interference**: Always reset mocks in afterEach
4. **Async issues**: Use proper async/await patterns for auth state changes

### Debug Tips

- Use `console.log` to verify mock state
- Check that mock functions are being called with `vi.fn()`
- Verify localStorage state in browser tests
- Use browser dev tools to inspect network requests in E2E tests

## Migration Guide

### From Old Mock System

```typescript
// Old way
vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) }
  }
}));

// New way
import { AuthMockManager } from '../test-utils/mocks';
const manager = new AuthMockManager();
manager.setUnauthenticated();
```

The new system provides:
- Better TypeScript support
- More realistic scenarios
- Easier state management
- Comprehensive test utilities
- Better documentation and examples
