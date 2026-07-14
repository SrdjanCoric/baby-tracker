import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QueuedOperation,
  SyncQueuePersistence,
  DEFAULT_SYNC_CONFIG,
  OperationType,
  SyncableTable,
} from './types';
import { compareClocks, type FieldClocks } from './crdt';
import { FIELD_CLOCKS_COLUMN } from './crdt-sync';

const STORAGE_KEY = '@sync_queue';
const RECOVERY_STORAGE_KEY = '@sync_queue_recovery';
const QUEUE_VERSION = 2;

interface RestoredQueueSnapshot {
  persistence: SyncQueuePersistence;
  operations: QueuedOperation[];
  droppedInvalidEntries: boolean;
}

interface SnapshotReadResult {
  snapshot: RestoredQueueSnapshot | null;
  readError: Error | null;
}

export class SyncQueue {
  private queue: QueuedOperation[] = [];
  private config = DEFAULT_SYNC_CONFIG;
  private generation = 0;

  async enqueue(operation: QueuedOperation): Promise<void> {
    if (!operation.id) {
      operation.id = this.generateOperationId();
    }
    if (this.queue.some(queued => queued.id === operation.id)) {
      return;
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
    const generation = this.generation + 1;
    const persistence: SyncQueuePersistence = {
      operations: this.queue,
      version: QUEUE_VERSION,
      generation,
    };
    const serialized = JSON.stringify(persistence);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, serialized);
      this.generation = generation;
      try {
        await AsyncStorage.removeItem(RECOVERY_STORAGE_KEY);
      } catch (error) {
        console.warn(
          '[SyncQueue] Failed to remove a stale recovery snapshot:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } catch (error) {
      try {
        await AsyncStorage.setItem(RECOVERY_STORAGE_KEY, serialized);
        this.generation = generation;
      } catch (recoveryError) {
        console.error(
          '[SyncQueue] Failed to persist the queue recovery snapshot:',
          recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
        );
        throw error;
      }
    }
  }

  async restore(): Promise<void> {
    const [primaryRead, recoveryRead] = await Promise.all([
      this.readStoredSnapshot(STORAGE_KEY),
      this.readStoredSnapshot(RECOVERY_STORAGE_KEY),
    ]);
    const readError = primaryRead.readError ?? recoveryRead.readError;
    if (readError) {
      throw readError;
    }
    const primary = primaryRead.snapshot;
    const recovery = recoveryRead.snapshot;
    const restored = this.chooseNewestSnapshot(primary, recovery);

    if (!restored) {
      this.queue = [];
      this.generation = 0;
      return;
    }

    this.queue = restored.operations;
    this.generation = restored.persistence.generation ?? 0;
    this.sortByTimestamp();

    const recoveredFallback = restored === recovery;
    if (
      restored.persistence.version !== QUEUE_VERSION
      || restored.droppedInvalidEntries
      || recoveredFallback
    ) {
      console.warn('[SyncQueue] Restored compatible operations from non-current queue data.');
      try {
        await this.persist();
      } catch (error) {
        console.error(
          '[SyncQueue] Failed to upgrade restored queue data; retained operations in memory:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  private async readStoredSnapshot(storageKey: string): Promise<SnapshotReadResult> {
    let data: string | null;
    try {
      data = await AsyncStorage.getItem(storageKey);
    } catch (error) {
      console.error(
        '[SyncQueue] Failed to read a queue snapshot; preserving other snapshots:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return {
        snapshot: null,
        readError: error instanceof Error ? error : new Error('Failed to read queue snapshot'),
      };
    }
    return {
      snapshot: await this.parseStoredSnapshot(data, storageKey),
      readError: null,
    };
  }

  private parseSnapshot(data: string | null): RestoredQueueSnapshot | null {
    if (!data) return null;

    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Queue data must be an object');
    }

    const persistence = parsed as Partial<SyncQueuePersistence>;
    if (!Array.isArray(persistence.operations)) {
      throw new Error('Queue operations must be an array');
    }

    const operations = persistence.operations.filter(
      (operation): operation is QueuedOperation => Boolean(operation) && typeof operation === 'object'
    );
    return {
      persistence: {
        operations,
        version: persistence.version ?? 0,
        generation: persistence.generation ?? 0,
      },
      operations,
      droppedInvalidEntries: operations.length !== persistence.operations.length,
    };
  }

  private async parseStoredSnapshot(
    data: string | null,
    storageKey: string
  ): Promise<RestoredQueueSnapshot | null> {
    try {
      return this.parseSnapshot(data);
    } catch (error) {
      console.error(
        '[SyncQueue] Ignored a corrupted queue snapshot:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch (cleanupError) {
        console.error(
          '[SyncQueue] Failed to cleanup a corrupted queue snapshot:',
          cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
        );
      }
      return null;
    }
  }

  private chooseNewestSnapshot(
    primary: RestoredQueueSnapshot | null,
    recovery: RestoredQueueSnapshot | null
  ): RestoredQueueSnapshot | null {
    if (!primary) return recovery;
    if (!recovery) return primary;

    const primaryGeneration = primary.persistence.generation ?? 0;
    const recoveryGeneration = recovery.persistence.generation ?? 0;
    return recoveryGeneration > primaryGeneration ? recovery : primary;
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
        const mergedClocks: FieldClocks = {};
        for (const update of updates) {
          if (!update.data) continue;
          const { [FIELD_CLOCKS_COLUMN]: clocks, ...fields } = update.data;
          Object.assign(mergedData, fields);
          // `field_clocks` is a nested per-field map, not a scalar column — a shallow
          // Object.assign would drop clocks for fields the later update didn't touch.
          // Union the maps, keeping the greater clock per field.
          if (clocks && typeof clocks === 'object') {
            for (const [field, clock] of Object.entries(clocks as FieldClocks)) {
              const existing = mergedClocks[field];
              if (existing === undefined || compareClocks(clock, existing) > 0) {
                mergedClocks[field] = clock;
              }
            }
          }
        }
        if (Object.keys(mergedClocks).length > 0) {
          mergedData[FIELD_CLOCKS_COLUMN] = mergedClocks;
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
