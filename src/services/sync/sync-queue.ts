import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QueuedOperation,
  SyncQueuePersistence,
  DEFAULT_SYNC_CONFIG,
  OperationType,
  SyncableTable,
} from './types';

const STORAGE_KEY = '@sync_queue';
const QUEUE_VERSION = 1;

export class SyncQueue {
  private queue: QueuedOperation[] = [];
  private config = DEFAULT_SYNC_CONFIG;

  async enqueue(operation: QueuedOperation): Promise<void> {
    if (!operation.id) {
      operation.id = this.generateOperationId();
    }
    this.queue.push(operation);
    this.sortByTimestamp();
  }

  dequeue(): QueuedOperation | undefined {
    return this.queue.shift();
  }

  peek(): QueuedOperation | undefined {
    return this.queue[0];
  }

  remove(operationId: string): boolean {
    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index === -1) {
      return false;
    }
    this.queue.splice(index, 1);
    return true;
  }

  markRetry(operationId: string): void {
    const operation = this.queue.find((op) => op.id === operationId);
    if (operation) {
      operation.retryCount += 1;
    }
  }

  calculateBackoff(retryCount: number): number {
    const delay = this.config.baseRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  async persist(): Promise<void> {
    const persistence: SyncQueuePersistence = {
      operations: this.queue,
      version: QUEUE_VERSION,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistence));
  }

  async restore(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        this.queue = [];
        return;
      }

      const persistence: SyncQueuePersistence = JSON.parse(data);

      if (persistence.version !== QUEUE_VERSION) {
        console.warn(`[SyncQueue] Queue version mismatch. Expected ${QUEUE_VERSION}, got ${persistence.version}. Resetting queue.`);
        this.queue = [];
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }

      if (!Array.isArray(persistence.operations)) {
        console.warn('[SyncQueue] Invalid queue data format. Resetting queue.');
        this.queue = [];
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }

      this.queue = persistence.operations;
      this.sortByTimestamp();
    } catch (error) {
      console.error('[SyncQueue] Failed to restore queue:', error instanceof Error ? error.message : 'Unknown error');
      this.queue = [];
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch (cleanupError) {
        console.error('[SyncQueue] Failed to cleanup corrupted queue data:', cleanupError);
      }
    }
  }

  optimize(): void {
    const entityOperations = new Map<string, QueuedOperation[]>();

    for (const op of this.queue) {
      const key = `${op.table}:${op.entityId}`;
      if (!entityOperations.has(key)) {
        entityOperations.set(key, []);
      }
      entityOperations.get(key)!.push(op);
    }

    const optimized: QueuedOperation[] = [];

    for (const [, operations] of entityOperations) {
      const sorted = operations.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const hasCreate = sorted.some((op) => op.type === 'CREATE');
      const hasDelete = sorted.some((op) => op.type === 'DELETE');

      if (hasCreate && hasDelete) {
        continue;
      }

      const updates = sorted.filter((op) => op.type === 'UPDATE');
      if (updates.length > 1) {
        const mergedData: Record<string, unknown> = {};
        for (const update of updates) {
          if (update.data) {
            Object.assign(mergedData, update.data);
          }
        }
        const lastUpdate = updates[updates.length - 1];
        lastUpdate.data = mergedData;
        optimized.push(lastUpdate);

        const nonUpdates = sorted.filter((op) => op.type !== 'UPDATE');
        optimized.push(...nonUpdates);
      } else {
        optimized.push(...sorted);
      }
    }

    this.queue = optimized;
    this.sortByTimestamp();
  }

  getAll(): QueuedOperation[] {
    return [...this.queue];
  }

  getCount(): number {
    return this.queue.length;
  }

  getBatches(batchSize: number): QueuedOperation[][] {
    const batches: QueuedOperation[][] = [];
    const all = this.getAll();

    for (let i = 0; i < all.length; i += batchSize) {
      batches.push(all.slice(i, i + batchSize));
    }

    return batches;
  }

  getStaleOperations(hoursThreshold: number): QueuedOperation[] {
    const threshold = Date.now() - hoursThreshold * 60 * 60 * 1000;
    return this.queue.filter((op) => new Date(op.timestamp).getTime() < threshold);
  }

  clear(): void {
    this.queue = [];
  }

  private sortByTimestamp(): void {
    this.queue.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createOperation(
    type: OperationType,
    table: SyncableTable,
    entityId: string,
    data: Record<string, unknown> | null
  ): QueuedOperation {
    return {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      table,
      entityId,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
  }
}
