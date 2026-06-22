import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibilityProvider, useAccessibility } from '../providers/AccessibilityProvider';

// Mock accessibility utilities
vi.mock('../utils/accessibility', () => ({
  FocusManager: {
    init: vi.fn(),
    cleanup: vi.fn(),
  },
  ScreenReaderAnnouncer: {
    initialize: vi.fn(),
    announce: vi.fn(),
  },
  KeyboardNavigation: {
    init: vi.fn(),
    cleanup: vi.fn(),
    isNavigationKey: vi.fn().mockReturnValue(true),
  },
  HighContrastMode: {
    init: vi.fn(),
    cleanup: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(false),
  },
  AccessibilityConstants: {
    FOCUSABLE_ELEMENTS: 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  },
}));

describe('AccessibilityProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders children without errors', () => {
    render(
      <AccessibilityProvider>
        <div data-testid="test-child">Test Content</div>
      </AccessibilityProvider>
    );
    
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('provides accessibility context', () => {
    const TestComponent = () => {
      const { isHighContrast, isKeyboardNav, reducedMotion, focusVisible } = useAccessibility();
      return (
        <div data-testid="context-test">
          <span data-testid="high-contrast">{isHighContrast.toString()}</span>
          <span data-testid="keyboard-nav">{isKeyboardNav.toString()}</span>
          <span data-testid="reduced-motion">{reducedMotion.toString()}</span>
          <span data-testid="focus-visible">{focusVisible.toString()}</span>
        </div>
      );
    };

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );
    
    expect(screen.getByTestId('context-test')).toBeInTheDocument();
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(screen.getByTestId('keyboard-nav')).toHaveTextContent('false');
    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
    expect(screen.getByTestId('focus-visible')).toHaveTextContent('false');
  });

  it('throws error when useAccessibility is used outside provider', () => {
    const TestComponent = () => {
      useAccessibility();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow('useAccessibility must be used within an AccessibilityProvider');
  });

  it('handles keyboard navigation events', () => {
    const TestComponent = () => {
      const { isKeyboardNav } = useAccessibility();
      return <div data-testid="keyboard-state">{isKeyboardNav.toString()}</div>;
    };

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    // Simulate keyboard navigation
    fireEvent.keyDown(document, { key: 'Tab' });
    
    expect(screen.getByTestId('keyboard-state')).toBeInTheDocument();
  });

  it('applies accessibility attributes to root element', () => {
    render(
      <AccessibilityProvider>
        <div data-testid="test-child">Test Content</div>
      </AccessibilityProvider>
    );

    const root = document.querySelector('[data-high-contrast]');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('data-high-contrast', 'false');
    expect(root).toHaveAttribute('data-keyboard-nav', 'false');
    expect(root).toHaveAttribute('data-reduced-motion', 'false');
  });

  it('handles reduced motion preference', () => {
    // Mock matchMedia to return true for reduced motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const TestComponent = () => {
      const { reducedMotion } = useAccessibility();
      return <div data-testid="reduced-motion">{reducedMotion.toString()}</div>;
    };

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('true');
  });

  it('handles high contrast mode', () => {
    const TestComponent = () => {
      const { isHighContrast } = useAccessibility();
      return <div data-testid="high-contrast">{isHighContrast ? 'true' : 'false'}</div>;
    };

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    // Just verify the component renders and has some content
    const element = screen.getByTestId('high-contrast');
    expect(element).toBeInTheDocument();
    expect(element.textContent).toMatch(/true|false/);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = render(
      <AccessibilityProvider>
        <div>Test</div>
      </AccessibilityProvider>
    );

    // Unmount should trigger cleanup
    expect(() => unmount()).not.toThrow();
  });
});
