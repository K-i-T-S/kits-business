import { useState, useCallback } from 'react';

export interface OptimisticUpdate<T> {
  id: string;
  data: T;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export function useOptimisticUpdates<T extends { id: string }>(
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<T>[]>([]);

  const addOptimisticUpdate = useCallback((item: T) => {
    const update: OptimisticUpdate<T> = {
      id: item.id,
      data: item,
      status: 'pending'
    };
    
    setOptimisticUpdates(prev => [...prev, update]);
    onUpdate([...initialData, item]);
    
    return update.id;
  }, [initialData, onUpdate]);

  const updateOptimisticItem = useCallback((id: string, updates: Partial<T>) => {
    setOptimisticUpdates(prev => 
      prev.map(update => 
        update.id === id 
          ? { ...update, data: { ...update.data, ...updates } }
          : update
      )
    );
    
    onUpdate(initialData.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, [initialData, onUpdate]);

  const removeOptimisticItem = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
    onUpdate(initialData.filter(item => item.id !== id));
  }, [initialData, onUpdate]);

  const markUpdateSuccess = useCallback((id: string, finalData?: T) => {
    setOptimisticUpdates(prev => 
      prev.map(update => 
        update.id === id 
          ? { ...update, status: 'success', data: finalData || update.data }
          : update
      )
    );
    
    if (finalData) {
      onUpdate(initialData.map(item => item.id === id ? finalData : item));
    }
    
    setTimeout(() => {
      setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
    }, 1000);
  }, [initialData, onUpdate]);

  const markUpdateError = useCallback((id: string, error: string) => {
    setOptimisticUpdates(prev => 
      prev.map(update => 
        update.id === id 
          ? { ...update, status: 'error', error }
          : update
      )
    );
    
    setTimeout(() => {
      setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
    }, 3000);
  }, []);

  const getPendingUpdates = useCallback(() => {
    return optimisticUpdates.filter(update => update.status === 'pending');
  }, [optimisticUpdates]);

  const getErrorUpdates = useCallback(() => {
    return optimisticUpdates.filter(update => update.status === 'error');
  }, [optimisticUpdates]);

  const hasPendingUpdates = useCallback(() => {
    return optimisticUpdates.some(update => update.status === 'pending');
  }, [optimisticUpdates]);

  return {
    optimisticUpdates,
    addOptimisticUpdate,
    updateOptimisticItem,
    removeOptimisticItem,
    markUpdateSuccess,
    markUpdateError,
    getPendingUpdates,
    getErrorUpdates,
    hasPendingUpdates
  };
}

export function useOptimisticStockUpdates(
  products: any[],
  onUpdate: (products: any[]) => void
) {
  const [stockUpdates, setStockUpdates] = useState<Map<string, number>>(new Map());

  const updateStockOptimistically = useCallback((productId: string, variantId: string, newStock: number) => {
    const key = `${productId}-${variantId}`;
    setStockUpdates(prev => new Map(prev.set(key, newStock)));
    
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          variants: product.variants.map((variant: any) => 
            variant.id === variantId 
              ? { ...variant, stock: newStock }
              : variant
          )
        };
      }
      return product;
    });
    
    onUpdate(updatedProducts);
  }, [products, onUpdate]);

  const confirmStockUpdate = useCallback((productId: string, variantId: string) => {
    const key = `${productId}-${variantId}`;
    setStockUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const revertStockUpdate = useCallback((productId: string, variantId: string, originalStock: number) => {
    const key = `${productId}-${variantId}`;
    setStockUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
    
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          variants: product.variants.map((variant: any) => 
            variant.id === variantId 
              ? { ...variant, stock: originalStock }
              : variant
          )
        };
      }
      return product;
    });
    
    onUpdate(updatedProducts);
  }, [products, onUpdate]);

  const getOptimisticStock = useCallback((productId: string, variantId: string) => {
    const key = `${productId}-${variantId}`;
    return stockUpdates.get(key);
  }, [stockUpdates]);

  return {
    updateStockOptimistically,
    confirmStockUpdate,
    revertStockUpdate,
    getOptimisticStock,
    hasPendingUpdates: stockUpdates.size > 0
  };
}
