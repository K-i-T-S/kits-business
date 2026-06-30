import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from '../context/AppContext';
import { IndustryProvider } from '../context/IndustryContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AccessibilityProvider } from '../providers/AccessibilityProvider';
import { QueryProvider } from '../providers/QueryProvider';

// LanguageProvider/TranslationProvider omitted — i18n is mocked via vi.mock in vitest.setup.ts
export const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      <AppProvider>
        <SubscriptionProvider>
          <IndustryProvider>
            <QueryProvider>
              <NotificationProvider>
                <AccessibilityProvider>
                  {children}
                </AccessibilityProvider>
              </NotificationProvider>
            </QueryProvider>
          </IndustryProvider>
        </SubscriptionProvider>
      </AppProvider>
    </ThemeProvider>
  </BrowserRouter>
);

// Custom render function that includes the wrapper
export const renderWithProviders = (ui: ReactNode, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Helper for async operations in tests
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));
