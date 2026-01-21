import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncQueue } from './sync-queue';
import { QueuedOperation, OperationType, SyncableTable } from './types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('SyncQueue', () => {
  let syncQueue: SyncQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    syncQueue = new SyncQueue();
  });

  describe('enqueue', () => {
    it('should add operation to queue when offline', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });

      await syncQueue.enqueue(operation);

      expect(syncQueue.getCount()).toBe(1);
    });

    it('should assign unique operation IDs', async () => {
      const op1 = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      const op2 = createOperation('CREATE', 'feedings', 'feeding-2', { id: 'feeding-2' });

      await syncQueue.enqueue(op1);
      await syncQueue.enqueue(op2);

      const all = syncQueue.getAll();
      expect(all[0].id).not.toBe(all[1].id);
    });

    it('should order queue by timestamp (FIFO)', async () => {
      const op1 = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      op1.timestamp = '2024-01-01T10:00:00.000Z';
      const op2 = createOperation('CREATE', 'feedings', 'feeding-2', { id: 'feeding-2' });
      op2.timestamp = '2024-01-01T10:01:00.000Z';

      await syncQueue.enqueue(op2);
      await syncQueue.enqueue(op1);

      const first = syncQueue.peek();
      expect(first?.entityId).toBe('feeding-1');
    });

    it('should queue CREATE operations with full entity data', async () => {
      const data = {
        id: 'feeding-1',
        babyId: 'baby-1',
        type: 'breast',
        startedAt: '2024-01-01T10:00:00.000Z',
      };
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', data);

      await syncQueue.enqueue(operation);

      const queued = syncQueue.peek();
      expect(queued?.data).toEqual(data);
    });

    it('should queue UPDATE operations with only changed fields', async () => {
      const changedFields = { notes: 'Updated notes' };
      const operation = createOperation('UPDATE', 'feedings', 'feeding-1', changedFields);

      await syncQueue.enqueue(operation);

      const queued = syncQueue.peek();
      expect(queued?.data).toEqual(changedFields);
    });

    it('should queue DELETE operations', async () => {
      const operation = createOperation('DELETE', 'feedings', 'feeding-1', null);

      await syncQueue.enqueue(operation);

      const queued = syncQueue.peek();
      expect(queued?.type).toBe('DELETE');
      expect(queued?.data).toBeNull();
    });
  });

  describe('persist', () => {
    it('should persist queue to AsyncStorage', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);

      await syncQueue.persist();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@sync_queue',
        expect.any(String)
      );
    });
  });

  describe('restore', () => {
    it('should restore queue from AsyncStorage on init', async () => {
      const savedQueue = {
        operations: [createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' })],
        version: 1,
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(savedQueue));

      await syncQueue.restore();

      expect(syncQueue.getCount()).toBe(1);
    });

    it('should handle empty storage gracefully', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      await syncQueue.restore();

      expect(syncQueue.getCount()).toBe(0);
    });

    it('should handle corrupted storage data', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue('invalid json{');

      await syncQueue.restore();

      expect(syncQueue.getCount()).toBe(0);
    });
  });

  describe('dequeue', () => {
    it('should get next operation', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);

      const dequeued = syncQueue.dequeue();

      expect(dequeued?.entityId).toBe('feeding-1');
      expect(syncQueue.getCount()).toBe(0);
    });

    it('should return undefined when queue is empty', () => {
      const dequeued = syncQueue.dequeue();

      expect(dequeued).toBeUndefined();
    });
  });

  describe('peek', () => {
    it('should view next without removing', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);

      const peeked = syncQueue.peek();

      expect(peeked?.entityId).toBe('feeding-1');
      expect(syncQueue.getCount()).toBe(1);
    });
  });

  describe('process queue when coming online', () => {
    it('should process queue when coming online', async () => {
      const op1 = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      const op2 = createOperation('UPDATE', 'feedings', 'feeding-2', { notes: 'test' });
      await syncQueue.enqueue(op1);
      await syncQueue.enqueue(op2);

      const operations = syncQueue.getAll();

      expect(operations).toHaveLength(2);
    });

    it('should process operations in order', async () => {
      const op1 = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      op1.timestamp = '2024-01-01T10:00:00.000Z';
      const op2 = createOperation('UPDATE', 'feedings', 'feeding-2', { notes: 'test' });
      op2.timestamp = '2024-01-01T10:01:00.000Z';

      await syncQueue.enqueue(op2);
      await syncQueue.enqueue(op1);

      const first = syncQueue.dequeue();
      const second = syncQueue.dequeue();

      expect(first?.entityId).toBe('feeding-1');
      expect(second?.entityId).toBe('feeding-2');
    });
  });

  describe('remove operation', () => {
    it('should remove operation from queue on success', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);

      syncQueue.remove(operation.id);

      expect(syncQueue.getCount()).toBe(0);
    });
  });

  describe('retry handling', () => {
    it('should retry failed operations with exponential backoff', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);

      syncQueue.markRetry(operation.id);
      const retried = syncQueue.peek();

      expect(retried?.retryCount).toBe(1);
    });

    it('should calculate correct backoff delay', () => {
      expect(syncQueue.calculateBackoff(0)).toBe(1000);
      expect(syncQueue.calculateBackoff(1)).toBe(2000);
      expect(syncQueue.calculateBackoff(2)).toBe(4000);
      expect(syncQueue.calculateBackoff(5)).toBe(30000);
    });
  });

  describe('optimize', () => {
    it('should collapse multiple updates to same entity', async () => {
      const op1 = createOperation('UPDATE', 'feedings', 'feeding-1', { notes: 'first' });
      op1.timestamp = '2024-01-01T10:00:00.000Z';
      const op2 = createOperation('UPDATE', 'feedings', 'feeding-1', { notes: 'second' });
      op2.timestamp = '2024-01-01T10:01:00.000Z';

      await syncQueue.enqueue(op1);
      await syncQueue.enqueue(op2);
      syncQueue.optimize();

      expect(syncQueue.getCount()).toBe(1);
      const optimized = syncQueue.peek();
      expect(optimized?.data).toEqual({ notes: 'second' });
    });

    it('should remove create+delete pair for same entity', async () => {
      const create = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      create.timestamp = '2024-01-01T10:00:00.000Z';
      const del = createOperation('DELETE', 'feedings', 'feeding-1', null);
      del.timestamp = '2024-01-01T10:01:00.000Z';

      await syncQueue.enqueue(create);
      await syncQueue.enqueue(del);
      syncQueue.optimize();

      expect(syncQueue.getCount()).toBe(0);
    });

    it('should merge consecutive updates to same entity', async () => {
      const op1 = createOperation('UPDATE', 'feedings', 'feeding-1', { notes: 'first' });
      op1.timestamp = '2024-01-01T10:00:00.000Z';
      const op2 = createOperation('UPDATE', 'feedings', 'feeding-1', { amountMl: 100 });
      op2.timestamp = '2024-01-01T10:01:00.000Z';

      await syncQueue.enqueue(op1);
      await syncQueue.enqueue(op2);
      syncQueue.optimize();

      expect(syncQueue.getCount()).toBe(1);
      const optimized = syncQueue.peek();
      expect(optimized?.data).toEqual({ notes: 'first', amountMl: 100 });
    });
  });

  describe('batch processing', () => {
    it('should handle 100+ queued items in batches of 50', async () => {
      for (let i = 0; i < 110; i++) {
        const op = createOperation('CREATE', 'feedings', `feeding-${i}`, { id: `feeding-${i}` });
        op.timestamp = new Date(Date.now() + i).toISOString();
        await syncQueue.enqueue(op);
      }

      const batches = syncQueue.getBatches(50);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(50);
      expect(batches[1]).toHaveLength(50);
      expect(batches[2]).toHaveLength(10);
    });
  });

  describe('queue integrity', () => {
    it('should maintain queue integrity on crash/interruption', async () => {
      const operation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      await syncQueue.enqueue(operation);
      await syncQueue.persist();

      const newQueue = new SyncQueue();
      const savedData = JSON.parse(
        (vi.mocked(AsyncStorage.setItem).mock.calls[0] as [string, string])[1]
      );
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(savedData));

      await newQueue.restore();

      expect(newQueue.getCount()).toBe(1);
      expect(newQueue.peek()?.entityId).toBe('feeding-1');
    });
  });

  describe('stale operations', () => {
    it('should handle items older than 24 hours with warning', async () => {
      const oldOperation = createOperation('CREATE', 'feedings', 'feeding-1', { id: 'feeding-1' });
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);
      oldOperation.timestamp = oldDate.toISOString();

      await syncQueue.enqueue(oldOperation);

      const staleOperations = syncQueue.getStaleOperations(24);
      expect(staleOperations).toHaveLength(1);
      expect(staleOperations[0].entityId).toBe('feeding-1');
    });
  });

  describe('clear', () => {
    it('should remove all items', async () => {
      await syncQueue.enqueue(createOperation('CREATE', 'feedings', 'feeding-1', { id: 'f1' }));
      await syncQueue.enqueue(createOperation('CREATE', 'feedings', 'feeding-2', { id: 'f2' }));

      syncQueue.clear();

      expect(syncQueue.getCount()).toBe(0);
    });
  });
});

function createOperation(
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
