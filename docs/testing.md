# Testing Infrastructure Guide

This guide covers the comprehensive testing infrastructure implemented for the All-in-One Business Terminal project.

## Overview

The testing infrastructure includes:
- **Unit Tests**: Component and utility testing with Vitest
- **E2E Tests**: End-to-end testing with Playwright  
- **Visual Testing**: Visual regression testing with Storybook
- **Coverage Reporting**: Code coverage tracking with thresholds

## Test Structure

### Unit Tests (`src/**/*.test.{ts,tsx}`)

Unit tests use Vitest and React Testing Library for component and utility testing.

#### Key Files:
- `src/context/AppContext.test.tsx` - Context provider tests
- `src/tests/multiTenant.test.tsx` - Multi-tenant functionality tests
- `src/components/ui/button.test.tsx` - UI component tests
- `src/utils/dataValidation.test.ts` - Utility function tests

#### Running Unit Tests:
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### E2E Tests (`tests/e2e/*.spec.ts`)

E2E tests use Playwright for full application testing across multiple browsers.

#### Key Files:
- `tests/e2e/basic.spec.ts` - Basic functionality tests
- `tests/e2e/auth.spec.ts` - Authentication flow tests

#### Configuration:
- `playwright.config.ts` - Playwright configuration
- Supports Chrome, Firefox, Safari, and mobile viewports

#### Running E2E Tests:
```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

### Visual Testing (`test-runner.js`)

Visual regression testing uses Storybook Test Runner.

#### Configuration:
- `test-runner.js` - Visual test configuration
- Tests across multiple viewports (mobile, tablet, desktop)

#### Running Visual Tests:
```bash
# Run visual regression tests
npm run test:visual
```

## Test Utilities

### Mocks (`src/test-utils/mocks.ts`)

Centralized mocking for:
- Supabase client
- Tenant manager
- User sessions
- Test data generation

### Test Providers (`src/test-utils/providers.tsx`)

Test wrapper components providing:
- React Router context
- App context with mocked data
- Consistent test environment

## Coverage Configuration

Coverage is configured in `vite.config.ts` with:
- **Provider**: v8
- **Reporters**: text, json, html
- **Thresholds**: 90% across all metrics (updated from 80%)
- **Exclusions**: Test files, config files, node_modules

### Current Coverage Status:
- **Overall**: 65.33% statements, 70% branches, 58.82% functions, 68.05% lines
- **Target**: 90%+ across all metrics
- **UI Components**: 94.73% coverage
- **Stories**: 85.71% coverage
- **Test Utils**: 45.45% coverage

### Coverage Enforcement:
- CI pipeline checks for 90% minimum coverage
- Build fails if coverage threshold not met
- Coverage reports uploaded to Codecov for tracking

## CI/CD Integration

GitHub Actions workflow (`.github/workflows/test.yml`) includes:

### Jobs:
1. **Unit Tests**: Type checking + unit tests + coverage reporting
2. **E2E Tests**: Browser automation testing
3. **Visual Tests**: Storybook visual regression testing
4. **Integration**: Combined test verification

### Features:
- Matrix testing across Node.js versions
- Artifact upload for test results
- Coverage reporting to Codecov
- Parallel execution for faster CI

## Best Practices

### Writing Tests:
1. **Unit Tests**: Test individual components/functions in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test user workflows end-to-end
4. **Visual Tests**: Catch UI regressions automatically

### Test Organization:
- Group related tests with `describe`
- Use descriptive test names with `it`
- Mock external dependencies
- Test both happy path and edge cases

### Coverage Goals:
- **Target**: 90%+ coverage across all metrics (updated from 80%)
- Focus on critical business logic
- Maintain test quality over quantity
- CI enforces minimum coverage thresholds

## Troubleshooting

### Common Issues:

#### CSS Import Errors:
- Ensure all CSS files exist in `src/styles/`
- Check Tailwind CSS configuration

#### Playwright Browser Issues:
- Run `npx playwright install` to download browsers
- Check browser dependencies in CI

#### Storybook Test Issues:
- Verify Storybook is running on port 6006
- Check story exports and configuration

#### Coverage Issues:
- Review excluded files in configuration
- Check for untested critical paths
- Consider adding tests for low-coverage areas

## Next Steps

To improve testing coverage and quality:

1. **Add More Unit Tests**: Cover remaining components and utilities
2. **Expand E2E Tests**: Add comprehensive user journey tests
3. **Improve Visual Tests**: Add more component stories
4. **Increase Coverage**: Target 90%+ coverage across all metrics
5. **Add Performance Tests**: Include performance regression testing

## Scripts Reference

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run typecheck        # TypeScript type checking

# Testing
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e:headed  # Run E2E tests in headed mode
npm run test:visual      # Run visual regression tests

# Storybook
npm run storybook        # Start Storybook
npm run build-storybook  # Build Storybook

# Verification
npm run verify           # Type check + build
```
