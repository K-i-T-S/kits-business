import { PowerSyncContext } from '@powersync/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from '../context/AppContext';
import { IndustryProvider } from '../context/IndustryContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { ThemeProvider } from '../context/ThemeContext';
import { powerSyncDb } from '../powersync/db';
import { AccessibilityProvider } from '../providers/AccessibilityProvider';
import { QueryProvider } from '../providers/QueryProvider';

// LanguageProvider/TranslationProvider omitted — i18n is mocked via vi.mock in vitest.setup.ts
// PowerSyncContext.Provider uses the real module-scope singleton -- it's
// just a plain object reference here (no live connection needed to
// satisfy useStatus()/usePowerSync() in a test render).
export const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <PowerSyncContext.Provider value={powerSyncDb}>
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
    </PowerSyncContext.Provider>
  </BrowserRouter>
);

// Custom render function that includes the wrapper
// eslint-disable-next-line react-refresh/only-export-components
export const renderWithProviders = (ui: ReactNode, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Helper for async operations in tests
// eslint-disable-next-line react-refresh/only-export-components
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));
