# Development Guide

## Getting Started

This project includes enhanced developer experience features to improve productivity and code quality.

## Storybook

Storybook is configured for component development and testing.

### Commands
- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build static Storybook for deployment

### Available Stories
- UI Components: Button, Card, Badge
- Error Boundary: Error handling examples
- Performance Monitor: Component performance tracking

## Error Boundaries

The project includes comprehensive error boundary components:

### Components
- `ErrorBoundary` - Class component for catching React errors
- `useErrorHandler` - Hook for functional components
- `withErrorBoundary` - HOC for wrapping components

### Usage
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary onError={(error, errorInfo) => console.log(error)}>
  <YourComponent />
</ErrorBoundary>
```

## Performance Monitoring

Built-in performance monitoring for development:

### Features
- Render time tracking
- Component re-render counting
- Memory usage monitoring
- Long task detection

### Usage
```tsx
import { PerformanceMonitor } from './components/PerformanceMonitor';

<PerformanceMonitor componentName="MyComponent">
  <YourComponent />
</PerformanceMonitor>
```

## Development Workflow

1. Start Storybook: `npm run storybook`
2. View components at http://localhost:6006
3. Test error boundaries and performance monitoring
4. Build for production: `npm run build`

## Scripts

- `npm run dev` - Start development server
- `npm run storybook` - Start Storybook
- `npm run build-storybook` - Build Storybook
- `npm run test` - Run tests
- `npm run typecheck` - Type checking
- `npm run verify` - Full verification
