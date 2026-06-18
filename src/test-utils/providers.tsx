import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from '../context/AppContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { AccessibilityProvider } from '../providers/AccessibilityProvider';
import { QueryProvider } from '../providers/QueryProvider';

// Enhanced test wrapper with proper async handling
// Provider order mirrors App.tsx: AppProvider → SubscriptionProvider → QueryProvider → AccessibilityProvider
export const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AppProvider>
      <SubscriptionProvider>
        <QueryProvider>
          <AccessibilityProvider>
            {children}
          </AccessibilityProvider>
        </QueryProvider>
      </SubscriptionProvider>
    </AppProvider>
  </BrowserRouter>
);

// Custom render function that includes the wrapper
export const renderWithProviders = (ui: ReactNode, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Helper for async operations in tests
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));
