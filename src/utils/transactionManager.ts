import type { Product } from '../context/AppContext';

import { api } from './supabaseClient';

export interface SaleTransactionData {
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  customerId?: string;
  total: number;
}

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  entity: 'product' | 'sale' | 'customer' | 'employee' | 'stock';
  data: unknown;
  id?: string;
}

export interface TransactionResult {
  success: boolean;
  results: unknown[];
  rollbackData?: unknown[];
  error?: string;
}

export class TransactionManager {
  private static operations: TransactionOperation[] = [];
  private static rollbackData: unknown[] = [];

  static async executeTransaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    this.operations = [...operations];
    this.rollbackData = [];
    const results: unknown[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (!operation) continue;

        const result = await this.executeOperation(operation);
        const apiResult = result as { id?: string };

        if (operation.type !== 'delete') {
          this.rollbackData.push({
            operation: operation.type === 'create' ? 'delete' : 'update',
            entity: operation.entity,
            data: result,
            id: apiResult.id,
          });
        } else {
          this.rollbackData.push({
            operation: 'create',
            entity: operation.entity,
            data: operation.data,
          });
        }

        results.push(result);
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('Transaction failed, attempting rollback:', error);
      await this.rollback();
      return {
        success: false,
        results,
        rollbackData: this.rollbackData,
        error: error instanceof Error ? error.message : 'Transaction failed',
      };
    }
  }

  private static async executeOperation(operation: TransactionOperation): Promise<unknown> {
    switch (operation.entity) {
      case 'product':
        return this.executeProductOperation(operation);
      case 'sale':
        return this.executeSaleOperation(operation);
      case 'customer':
        return this.executeCustomerOperation(operation);
      case 'employee':
        return this.executeEmployeeOperation(operation);
      case 'stock':
        return this.executeStockOperation(operation);
      default:
        throw new Error(`Unknown entity type: ${operation.entity}`);
    }
  }

  private static async executeProductOperation(operation: TransactionOperation): Promise<unknown> {
    switch (operation.type) {
      case 'create':
        return api.post('/products', operation.data);
      case 'update':
        return api.put(`/products/${operation.id}`, operation.data);
      case 'delete':
        return api.delete(`/products/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeSaleOperation(operation: TransactionOperation): Promise<unknown> {
    switch (operation.type) {
      case 'create':
        return api.post('/sales', operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeCustomerOperation(operation: TransactionOperation): Promise<unknown> {
    switch (operation.type) {
      case 'create':
        return api.post('/customers', operation.data);
      case 'update':
        return api.put(`/customers/${operation.id}`, operation.data);
      case 'delete':
        return api.delete(`/customers/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeEmployeeOperation(operation: TransactionOperation): Promise<unknown> {
    switch (operation.type) {
      case 'create':
        return api.post('/employees', operation.data);
      case 'update':
        return api.put(`/employees/${operation.id}`, operation.data);
      case 'delete':
        return api.delete(`/employees/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeStockOperation(operation: TransactionOperation): Promise<unknown> {
    const data = operation.data as { productId: string; variantId: string; quantity: number };
    switch (operation.type) {
      case 'update':
        return api.post(`/products/${data.productId}/variants/${data.variantId}/stock`, {
          quantity: data.quantity,
        });
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async rollback(): Promise<void> {
    const rollbackOperations = [...this.rollbackData].reverse();

    for (const rollbackOp of rollbackOperations) {
      try {
        if (!rollbackOp || typeof rollbackOp !== 'object' ||
            !('type' in rollbackOp) || !('entity' in rollbackOp)) {
          console.warn('Skipping invalid rollback operation:', rollbackOp);
          continue;
        }
        await this.executeOperation(rollbackOp as TransactionOperation);
      } catch (rollbackError) {
        console.error('Rollback operation failed:', rollbackError, rollbackOp);
      }
    }
  }

  static async executeSaleTransaction(saleData: SaleTransactionData, products: Product[]): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [
      {
        type: 'create',
        entity: 'sale',
        data: saleData,
      },
    ];

    for (const item of saleData.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        console.error('Available products:', products.map(p => ({ id: p.id, name: p.name })));
        console.error('Looking for product ID:', item.productId);
        throw new Error(`Product not found: ${item.productId}`);
      }

      const variant = product.variants.find(v => v.id === item.variantId);
      if (variant) {
        operations.push({
          type: 'update',
          entity: 'stock',
          data: {
            productId: item.productId,
            variantId: item.variantId,
            quantity: -item.quantity, // Negative to subtract from stock
          },
        });
      }
    }

    if (saleData.customerId) {
      operations.push({
        type: 'update',
        entity: 'customer',
        id: saleData.customerId,
        data: {
          total_purchases: saleData.total,
          last_visit: new Date().toISOString(),
        },
      });
    }

    return this.executeTransaction(operations);
  }

  static async executeBulkStockUpdate(updates: Array<{productId: string, variantId: string, quantity: number}>): Promise<TransactionResult> {
    const operations: TransactionOperation[] = updates.map(update => ({
      type: 'update' as const,
      entity: 'stock' as const,
      data: update,
    }));

    return this.executeTransaction(operations);
  }
}
