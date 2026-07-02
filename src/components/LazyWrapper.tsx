import React, { Suspense } from 'react';

import { LoadingSpinner } from './LoadingSpinner';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback = <LoadingSpinner message="Loading component..." />,
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

// Higher-order component for lazy loading with custom fallback
// eslint-disable-next-line react-refresh/only-export-components
export const withLazyLoading = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.ComponentType<any>,
  fallback?: React.ReactNode,
) => {
  const LazyComponent = React.lazy(() =>
    Promise.resolve({ default: Component }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => (
    <LazyWrapper fallback={fallback}>
      <LazyComponent {...props} />
    </LazyWrapper>
  );
};

// Preloading utility for critical components
// eslint-disable-next-line react-refresh/only-export-components, @typescript-eslint/no-explicit-any
export const preloadComponent = (componentImport: () => Promise<any>) => {
  const componentLoader = componentImport;
  void componentLoader();
};
