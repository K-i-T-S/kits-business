interface PendingOperation {
  id: string;
  type: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export class OperationQueue {
  private static queues = new Map<string, PendingOperation[]>();
  private static processing = new Map<string, boolean>();

  static async enqueue<T>(
    queueKey: string,
    operation: () => Promise<T>,
    operationType: string = 'default',
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const pendingOp: PendingOperation = {
        id: Math.random().toString(36).substr(2, 9),
        type: operationType,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      if (!this.queues.has(queueKey)) {
        this.queues.set(queueKey, []);
      }

      const queue = this.queues.get(queueKey)!;
      queue.push(pendingOp);

      void this.processQueue(queueKey);
    });
  }

  private static async processQueue(queueKey: string): Promise<void> {
    if (this.processing.get(queueKey)) {
      return;
    }

    this.processing.set(queueKey, true);
    const queue = this.queues.get(queueKey);

    if (!queue || queue.length === 0) {
      this.processing.set(queueKey, false);
      return;
    }

    while (queue.length > 0) {
      const operation = queue.shift();
      if (!operation) break;

      try {
        const result = await this.executeOperation(operation);
        operation.resolve(result);
      } catch (error) {
        operation.reject(error);
      }
    }

    this.processing.set(queueKey, false);
  }

  private static async executeOperation(operation: PendingOperation): Promise<any> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 30000);
    });

    try {
      return await Promise.race([timeout, this.performOperation(operation)]);
    } catch (error) {
      throw error;
    }
  }

  private static async performOperation(operation: PendingOperation): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    return { success: true, operationId: operation.id };
  }

  static clearQueue(queueKey: string): void {
    const queue = this.queues.get(queueKey);
    if (queue) {
      queue.forEach(op => op.reject(new Error('Queue cleared')));
      queue.length = 0;
    }
    this.processing.delete(queueKey);
  }

  static getQueueStatus(queueKey: string): { length: number; processing: boolean } {
    const queue = this.queues.get(queueKey);
    return {
      length: queue?.length || 0,
      processing: this.processing.get(queueKey) || false,
    };
  }
}

export class StockUpdateLock {
  private static locks = new Map<string, { timestamp: number; operationId: string }>();

  static acquireLock(
    productId: string,
    variantId: string,
    timeout: number = 10000,
  ): string | null {
    const key = `${productId}-${variantId}`;
    const existing = this.locks.get(key);

    if (existing && Date.now() - existing.timestamp < timeout) {
      return null;
    }

    const operationId = Math.random().toString(36).substr(2, 9);
    this.locks.set(key, {
      timestamp: Date.now(),
      operationId,
    });

    return operationId;
  }

  static releaseLock(productId: string, variantId: string, operationId: string): boolean {
    const key = `${productId}-${variantId}`;
    const existing = this.locks.get(key);

    if (existing && existing.operationId === operationId) {
      this.locks.delete(key);
      return true;
    }

    return false;
  }

  static cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [key, lock] of this.locks.entries()) {
      if (now - lock.timestamp > 30000) {
        this.locks.delete(key);
      }
    }
  }

  static isLocked(productId: string, variantId: string): boolean {
    const key = `${productId}-${variantId}`;
    const existing = this.locks.get(key);
    return existing !== undefined && Date.now() - existing.timestamp < 30000;
  }
}

export class ConcurrentOperationGuard {
  private static operations = new Map<string, Set<string>>();

  static async executeWithGuard<T>(
    resourceKey: string,
    operationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.operations.has(resourceKey)) {
      this.operations.set(resourceKey, new Set());
    }

    const resourceOps = this.operations.get(resourceKey)!;

    if (resourceOps.has(operationId)) {
      throw new Error('Operation already in progress');
    }

    resourceOps.add(operationId);

    try {
      const result = await operation();
      return result;
    } finally {
      resourceOps.delete(operationId);

      if (resourceOps.size === 0) {
        this.operations.delete(resourceKey);
      }
    }
  }

  static getActiveOperations(resourceKey: string): string[] {
    const ops = this.operations.get(resourceKey);
    return ops ? Array.from(ops) : [];
  }

  static hasActiveOperations(resourceKey: string): boolean {
    const ops = this.operations.get(resourceKey);
    return ops ? ops.size > 0 : false;
  }
}

setInterval(() => {
  StockUpdateLock.cleanupExpiredLocks();
}, 10000);
