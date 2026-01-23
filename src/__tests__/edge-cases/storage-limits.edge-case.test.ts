import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncQueue } from '@/services/sync/sync-queue';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

describe('Storage Limits (EC-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Capacity Handling', () => {
    it('should handle large queue sizes gracefully', async () => {
      const queue = new SyncQueue();

      for (let i = 0; i < 100; i++) {
        await queue.enqueue({
          id: `op-${i}`,
          type: 'CREATE',
          table: 'feedings',
          entityId: `feeding-${i}`,
          data: {
            id: `feeding-${i}`,
            type: 'breast',
            notes: 'A'.repeat(1000),
          },
          timestamp: new Date(Date.now() + i).toISOString(),
          retryCount: 0,
        });
      }

      expect(queue.getCount()).toBe(100);
    });

    it('should handle storage write failures gracefully', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      vi.mocked(AsyncStorage.default.setItem).mockRejectedValueOnce(
        new Error('Storage full')
      );

      const queue = new SyncQueue();

      await expect(queue.persist()).rejects.toThrow('Storage full');
    });

    it('should maintain queue integrity after storage errors', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const queue = new SyncQueue();

      await queue.enqueue({
        id: 'op-1',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', type: 'breast' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      vi.mocked(AsyncStorage.default.setItem).mockRejectedValueOnce(
        new Error('Storage full')
      );

      try {
        await queue.persist();
      } catch {
        // Expected failure
      }

      expect(queue.getCount()).toBe(1);
    });
  });

  describe('Batch Processing Under Pressure', () => {
    it('should process large queues in batches', async () => {
      const queue = new SyncQueue();

      for (let i = 0; i < 150; i++) {
        await queue.enqueue({
          id: `op-${i}`,
          type: 'CREATE',
          table: 'feedings',
          entityId: `feeding-${i}`,
          data: { id: `feeding-${i}`, type: 'breast' },
          timestamp: new Date(Date.now() + i).toISOString(),
          retryCount: 0,
        });
      }

      const batches = queue.getBatches(50);

      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(50);
      expect(batches[1].length).toBe(50);
      expect(batches[2].length).toBe(50);
    });
  });

  describe('Queue Optimization Under Storage Pressure', () => {
    it('should collapse duplicate updates to reduce storage', async () => {
      const queue = new SyncQueue();

      await queue.enqueue({
        id: 'op-1',
        type: 'UPDATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', notes: 'First update' },
        timestamp: new Date(Date.now()).toISOString(),
        retryCount: 0,
      });

      await queue.enqueue({
        id: 'op-2',
        type: 'UPDATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', notes: 'Second update' },
        timestamp: new Date(Date.now() + 1000).toISOString(),
        retryCount: 0,
      });

      queue.optimize();

      expect(queue.getCount()).toBe(1);
      const remaining = queue.peek();
      expect(remaining?.data?.notes).toBe('Second update');
    });

    it('should remove create+delete pairs to save storage', async () => {
      const queue = new SyncQueue();

      await queue.enqueue({
        id: 'op-create',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-temp',
        data: { id: 'feeding-temp', type: 'breast' },
        timestamp: new Date(Date.now()).toISOString(),
        retryCount: 0,
      });

      await queue.enqueue({
        id: 'op-delete',
        type: 'DELETE',
        table: 'feedings',
        entityId: 'feeding-temp',
        data: null,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        retryCount: 0,
      });

      queue.optimize();

      expect(queue.getCount()).toBe(0);
    });
  });
});
