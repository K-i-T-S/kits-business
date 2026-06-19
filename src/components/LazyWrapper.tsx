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
export const withLazyLoading = (
  Component: React.ComponentType<any>,
  fallback?: React.ReactNode,
) => {
  const LazyComponent = React.lazy(() =>
    Promise.resolve({ default: Component }),
  );

  return (props: any) => (
    <LazyWrapper fallback={fallback}>
      <LazyComponent {...props} />
    </LazyWrapper>
  );
};

// Preloading utility for critical components
export const preloadComponent = (componentImport: () => Promise<any>) => {
  const componentLoader = componentImport;
  void componentLoader();
};
