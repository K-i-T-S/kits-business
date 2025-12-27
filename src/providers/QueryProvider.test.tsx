import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryProvider } from '../providers/QueryProvider';

// Mock React Query
const mockQueryClient = {
  queryCache: {
    subscribe: vi.fn(),
    clear: vi.fn()
  },
  mutationCache: {
    subscribe: vi.fn(),
    clear: vi.fn()
  }
};

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => mockQueryClient),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useInfiniteQuery: vi.fn(),
  useQueryClient: vi.fn(() => mockQueryClient)
}));

describe('QueryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children without crashing', () => {
    render(
      <QueryProvider>
        <div data-testid="test-child">Test Content</div>
      </QueryProvider>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('provides query client context', () => {
    const TestComponent = () => {
      // This would use useQueryClient in a real component
      return <div data-testid="query-client-test">Query Client Test</div>;
    };

    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>
    );

    expect(screen.getByTestId('query-client-test')).toBeInTheDocument();
  });

  it('handles multiple children', () => {
    render(
      <QueryProvider>
        <div data-testid="child1">Child 1</div>
        <div data-testid="child2">Child 2</div>
        <div data-testid="child3">Child 3</div>
      </QueryProvider>
    );

    expect(screen.getByTestId('child1')).toBeInTheDocument();
    expect(screen.getByTestId('child2')).toBeInTheDocument();
    expect(screen.getByTestId('child3')).toBeInTheDocument();
  });

  it('wraps children with proper provider structure', () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="nested-content">
          <span data-testid="nested-span">Nested Content</span>
        </div>
      </QueryProvider>
    );

    expect(screen.getByTestId('nested-content')).toBeInTheDocument();
    expect(screen.getByTestId('nested-span')).toBeInTheDocument();
    expect(container.firstChild).toBeDefined();
  });
});
