import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { log } from './logger';

// Enhanced caching configuration for optimal performance
export const cacheConfig = {
  // Short-lived cache for frequently changing data
  realtime: {
    staleTime: 0,
    gcTime: 1000 * 60, // 1 minute
  },
  
  // Medium cache for user-specific data
  user: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  },
  
  // Long cache for relatively static data
  static: {
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  },
  
  // Very long cache for reference data
  reference: {
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  }
}

// Prefetching strategy for common data patterns
export const prefetchStrategy = {
  // Prefetch related data when user is likely to need it
  onHover: (queryClient: QueryClient, queryKey: string[], prefetchFn: () => Promise<any>) => {
    let timeoutId: number
    
    return {
      onMouseEnter: () => {
        timeoutId = window.setTimeout(() => {
          queryClient.prefetchQuery({
            queryKey,
            queryFn: prefetchFn,
            staleTime: 1000 * 60 * 5, // 5 minutes
          })
        }, 200) // 200ms delay
      },
      onMouseLeave: () => {
        window.clearTimeout(timeoutId)
      }
    }
  },
  
  // Prefetch data on focus
  onFocus: (queryClient: QueryClient, queryKey: string[], prefetchFn: () => Promise<any>) => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn: prefetchFn,
      staleTime: 1000 * 60 * 10, // 10 minutes
    })
  }
}

// Background refetch configuration
export const refetchConfig = {
  // Refetch on window focus for critical data
  critical: {
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  },
  
  // Refetch only on reconnect for user data
  user: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
  
  // No automatic refetch for static data
  static: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  }
}

// Cache invalidation strategies
export const invalidationStrategy = {
  // Invalidate related queries when data changes
  invalidateRelated: (queryClient: QueryClient, baseQueryKey: string[]) => {
    // Invalidate all queries that start with the base key
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey
        return Array.isArray(queryKey) && 
               queryKey.length >= baseQueryKey.length &&
               baseQueryKey.every((key, index) => queryKey[index] === key)
      }
    })
  },
  
  // Optimistic updates with rollback
  optimisticUpdate: <T>(
    queryClient: QueryClient,
    queryKey: string[],
    newData: T,
    updateFn: () => Promise<T>
  ) => {
    // Cancel any outgoing refetches
    queryClient.cancelQueries({ queryKey })
    
    // Snapshot the previous value
    const previousData = queryClient.getQueryData(queryKey)
    
    // Optimistically update to the new value
    queryClient.setQueryData(queryKey, newData)
    
    // Return a rollback function
    return () => {
      queryClient.setQueryData(queryKey, previousData)
    }
  }
}

// Memory management for large datasets
export const memoryManagement = {
  // Clear old data when memory pressure is detected
  cleanup: (queryClient: QueryClient) => {
    // Remove queries older than 30 minutes
    const now = Date.now()
    queryClient.getQueryCache().getAll().forEach((query: any) => {
      if (query.state.dataUpdatedAt && (now - query.state.dataUpdatedAt) > 1000 * 60 * 30) {
        queryClient.removeQueries({ queryKey: query.queryKey })
      }
    })
  },
  
  // Limit the number of cached queries
  limitCache: (queryClient: QueryClient, maxQueries: number = 100) => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    
    if (queries.length > maxQueries) {
      // Sort by last updated time and remove oldest
      const sortedQueries = queries.sort((a: any, b: any) => 
        (a.state.dataUpdatedAt || 0) - (b.state.dataUpdatedAt || 0)
      )
      
      const toRemove = sortedQueries.slice(0, queries.length - maxQueries)
      toRemove.forEach((query: any) => {
        queryClient.removeQueries({ queryKey: query.queryKey })
      })
    }
  }
}

// Performance monitoring
export const performanceMonitor = {
  // Track query performance metrics
  trackQuery: (queryKey: string[], duration: number, success: boolean) => {
    if (import.meta.env.DEV) {
      log.debug(`Query ${queryKey.join('/')} took ${duration}ms, success: ${success}`);
    }
    
    // In production, you could send this to analytics
    if (import.meta.env.PROD && (window as any).gtag) {
      (window as any).gtag('event', 'query_performance', {
        query_key: queryKey.join('/'),
        duration,
        success
      })
    }
  },
  
  // Track cache hit/miss ratio
  trackCacheHit: (queryKey: string[], isHit: boolean) => {
    if (import.meta.env.DEV) {
      const status = isHit ? 'HIT' : 'MISS';
      log.debug(`Cache ${status} for ${queryKey.join('/')}`);
    }
  }
}

// Enhanced query client with all optimizations
export const createOptimizedQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: any) => {
          if (error?.status >= 400 && error?.status < 500) return false
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
      },
    },
  })

  // Set up periodic cleanup
  if (typeof window !== 'undefined') {
    setInterval(() => {
      memoryManagement.cleanup(queryClient)
      memoryManagement.limitCache(queryClient)
    }, 1000 * 60 * 10) // Every 10 minutes
  }

  return queryClient
}

// Custom hook for performance monitoring
export const useQueryPerformance = () => {
  const queryClient = useQueryClient()
  
  return {
    getCacheStats: () => {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()
      
      return {
        totalQueries: queries.length,
        activeQueries: queries.filter((q: any) => q.state.fetchStatus === 'fetching').length,
        staleQueries: queries.filter((q: any) => q.isStale()).length,
        inactiveQueries: queries.filter((q: any) => q.state.fetchStatus === 'idle').length,
        totalDataSize: JSON.stringify(queries.map((q: any) => q.state.data)).length,
      }
    },
    
    clearCache: () => {
      queryClient.clear()
    },
    
    prefetchCriticalData: async () => {
      // Prefetch commonly accessed data
      const criticalQueries = [
        ['products'],
        ['customers'],
        ['employees'],
      ]
      
      await Promise.all(
        criticalQueries.map(queryKey => 
          queryClient.prefetchQuery({
            queryKey,
            staleTime: 1000 * 60 * 5, // 5 minutes
          })
        )
      )
    }
  }
}
