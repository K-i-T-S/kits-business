import { api } from './supabaseClient';
import type { Product, Sale, Customer, Employee } from '../context/AppContext';

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  entity: 'product' | 'sale' | 'customer' | 'employee' | 'stock';
  data: any;
  id?: string;
}

export interface TransactionResult {
  success: boolean;
  results: any[];
  rollbackData?: any[];
  error?: string;
}

export class TransactionManager {
  private static operations: TransactionOperation[] = [];
  private static rollbackData: any[] = [];

  static async executeTransaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    this.operations = [...operations];
    this.rollbackData = [];
    const results: any[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (!operation) continue;
        
        const result = await this.executeOperation(operation);
        
        if (operation.type !== 'delete') {
          this.rollbackData.push({
            operation: operation.type === 'create' ? 'delete' : 'update',
            entity: operation.entity,
            data: result,
            id: result.id
          });
        } else {
          this.rollbackData.push({
            operation: 'create',
            entity: operation.entity,
            data: operation.data
          });
        }
        
        results.push(result);
      }

      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Transaction failed, attempting rollback:', error);
      await this.rollback();
      return {
        success: false,
        results,
        rollbackData: this.rollbackData,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  private static async executeOperation(operation: TransactionOperation): Promise<any> {
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

  private static async executeProductOperation(operation: TransactionOperation): Promise<any> {
    switch (operation.type) {
      case 'create':
        return await api.post('/products', operation.data);
      case 'update':
        return await api.put(`/products/${operation.id}`, operation.data);
      case 'delete':
        return await api.delete(`/products/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeSaleOperation(operation: TransactionOperation): Promise<any> {
    switch (operation.type) {
      case 'create':
        return await api.post('/sales', operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeCustomerOperation(operation: TransactionOperation): Promise<any> {
    switch (operation.type) {
      case 'create':
        return await api.post('/customers', operation.data);
      case 'update':
        return await api.put(`/customers/${operation.id}`, operation.data);
      case 'delete':
        return await api.delete(`/customers/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeEmployeeOperation(operation: TransactionOperation): Promise<any> {
    switch (operation.type) {
      case 'create':
        return await api.post('/employees', operation.data);
      case 'update':
        return await api.put(`/employees/${operation.id}`, operation.data);
      case 'delete':
        return await api.delete(`/employees/${operation.id}`);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async executeStockOperation(operation: TransactionOperation): Promise<any> {
    switch (operation.type) {
      case 'update':
        return await api.post(`/products/${operation.data.productId}/variants/${operation.data.variantId}/stock`, {
          quantity: operation.data.quantity
        });
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private static async rollback(): Promise<void> {
    const rollbackOperations = [...this.rollbackData].reverse();
    
    for (const rollbackOp of rollbackOperations) {
      try {
        await this.executeOperation(rollbackOp);
      } catch (rollbackError) {
        console.error('Rollback operation failed:', rollbackError, rollbackOp);
      }
    }
  }

  static async executeSaleTransaction(saleData: any, products: Product[]): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [
      {
        type: 'create',
        entity: 'sale',
        data: saleData
      }
    ];

    for (const item of saleData.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const variant = product.variants.find(v => v.id === item.variantId);
        if (variant) {
          operations.push({
            type: 'update',
            entity: 'stock',
            data: {
              productId: item.productId,
              variantId: item.variantId,
              quantity: variant.stock - item.quantity
            }
          });
        }
      }
    }

    if (saleData.customerId) {
      operations.push({
        type: 'update',
        entity: 'customer',
        id: saleData.customerId,
        data: {
          totalPurchases: saleData.total,
          lastPurchaseDate: new Date().toISOString()
        }
      });
    }

    return this.executeTransaction(operations);
  }

  static async executeBulkStockUpdate(updates: Array<{productId: string, variantId: string, quantity: number}>): Promise<TransactionResult> {
    const operations: TransactionOperation[] = updates.map(update => ({
      type: 'update' as const,
      entity: 'stock' as const,
      data: update
    }));

    return this.executeTransaction(operations);
  }
}
