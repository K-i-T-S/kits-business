import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { createSupabaseMock, tenantManagerMock } from './mocks';

// Enhanced test wrapper with proper async handling
export const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AppProvider>
      {children}
    </AppProvider>
  </BrowserRouter>
);

// Custom render function that includes the wrapper
export const renderWithProviders = (ui: ReactNode, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Helper for async operations in tests
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));
