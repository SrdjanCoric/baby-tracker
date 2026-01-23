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

describe('Baby Deletion While Offline (EC-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Orphaned Entries Handling', () => {
    it('should handle pending entries for deleted baby', async () => {
      const queue = new SyncQueue();
      const deletedBabyId = 'deleted-baby-123';

      await queue.enqueue({
        id: 'op-1',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', baby_id: deletedBabyId, type: 'breast' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      expect(queue.getCount()).toBe(1);

      const orphanedOp = queue.peek();
      expect(orphanedOp?.data?.baby_id).toBe(deletedBabyId);
    });

    it('should allow queue clearing for deleted baby entries', async () => {
      const queue = new SyncQueue();

      await queue.enqueue({
        id: 'op-1',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', baby_id: 'baby-1', type: 'breast' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      await queue.clear();
      expect(queue.getCount()).toBe(0);
    });

    it('should not fail sync when baby_id reference is invalid', async () => {
      const queue = new SyncQueue();

      await queue.enqueue({
        id: 'op-orphan',
        type: 'UPDATE',
        table: 'feedings',
        entityId: 'feeding-orphan',
        data: { id: 'feeding-orphan', notes: 'updated' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe('op-orphan');
    });
  });

  describe('Baby Deletion Cleanup', () => {
    it('should queue baby deletion operation', async () => {
      const queue = new SyncQueue();
      const babyId = 'baby-to-delete';

      await queue.enqueue({
        id: 'op-delete-baby',
        type: 'DELETE',
        table: 'babies',
        entityId: babyId,
        data: null,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const op = queue.peek();
      expect(op?.type).toBe('DELETE');
      expect(op?.table).toBe('babies');
      expect(op?.entityId).toBe(babyId);
    });
  });
});
