// @ts-expect-error @testing-library/react exports screen, fireEvent, waitFor
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders default loading spinner', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    
    expect(spinner).toHaveAttribute('aria-live', 'polite');
    expect(spinner).toHaveAttribute('aria-label', 'Loading application');
  });

  it('shows default loading text when no message provided', () => {
    render(<LoadingSpinner />);
    // Should show translated loading text
    const textElement = screen.getByText(/loading/i);
    expect(textElement).toBeInTheDocument();
  });

  it('contains spinning animation element', () => {
    render(<LoadingSpinner />);
    const spinnerElement = screen.getByRole('status').querySelector('[aria-hidden="true"]');
    expect(spinnerElement).toBeInTheDocument();
    expect(spinnerElement).toHaveClass('animate-spin');
  });
});
