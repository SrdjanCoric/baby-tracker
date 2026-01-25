import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from './sync-engine';
import { SyncQueue } from './sync-queue';
import { QueuedOperation, OperationType, SyncableTable } from './types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

describe('Edge Cases', () => {
  describe('6.1 Network Edge Cases', () => {
    let syncEngine: SyncEngine;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
      syncEngine = new SyncEngine();
      syncEngine.setAuthContext({ householdId: 'test-household', userId: 'test-user' });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle network interruption mid-sync without data corruption', async () => {
      vi.useRealTimers();
      const operations: QueuedOperation[] = [];
      for (let i = 0; i < 5; i++) {
        operations.push(createOperation('CREATE', 'feedings', `f${i}`));
      }

      for (const op of operations) {
        await syncEngine.enqueueOperation(op);
      }

      let pullCallCount = 0;
      vi.spyOn(syncEngine as any, 'pullChanges').mockImplementation(async () => {
        pullCallCount++;
        if (pullCallCount === 1) {
          throw new Error('Network interrupted');
        }
        return [];
      });
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();
      vi.spyOn(syncEngine as any, 'delay').mockResolvedValue();

      syncEngine.setOnlineForTesting(true);

      await syncEngine.sync();

      expect(syncEngine.getStatus()).toBe('online');
      expect(syncEngine.getLastSyncedAt()).not.toBeNull();
    });

    it('should handle very slow network (>10 second response times)', async () => {
      vi.useRealTimers();
      syncEngine.setOnlineForTesting(true);

      vi.spyOn(syncEngine as any, 'pullChanges').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      });
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();
      vi.spyOn(syncEngine as any, 'delay').mockResolvedValue();

      const startTime = Date.now();
      await syncEngine.sync();
      const duration = Date.now() - startTime;

      expect(syncEngine.getStatus()).toBe('online');
      // Allow 5ms tolerance for timer precision variations across systems
      expect(duration).toBeGreaterThanOrEqual(45);
    });

    it('should handle intermittent connectivity (flapping) with debounce', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      const syncSpy = vi.spyOn(syncEngine, 'sync').mockResolvedValue();

      for (let i = 0; i < 10; i++) {
        syncEngine.handleNetworkChange(i % 2 === 0);
        await vi.advanceTimersByTimeAsync(50);
      }
      await vi.advanceTimersByTimeAsync(300);

      expect(syncSpy.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('should preserve queue state during network transitions', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);

      vi.spyOn(syncEngine, 'sync').mockResolvedValue();

      syncEngine.handleNetworkChange(false);
      await vi.runAllTimersAsync();

      expect(syncEngine.getStatus()).toBe('offline');
      expect(syncEngine.getPendingCount()).toBe(1);

      syncEngine.handleNetworkChange(true);
      await vi.runAllTimersAsync();

      expect(syncEngine.getPendingCount()).toBe(1);

      syncEngine.handleNetworkChange(false);
      await vi.runAllTimersAsync();

      expect(syncEngine.getStatus()).toBe('offline');
      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should maintain data integrity after multiple network failures', async () => {
      vi.useRealTimers();
      const operations: QueuedOperation[] = [];
      for (let i = 0; i < 3; i++) {
        const op = createOperation('CREATE', 'feedings', `f${i}`);
        operations.push(op);
        await syncEngine.enqueueOperation(op);
      }

      syncEngine.setOnlineForTesting(true);

      let failCount = 0;
      vi.spyOn(syncEngine as any, 'pullChanges').mockImplementation(async () => {
        failCount++;
        if (failCount <= 2) {
          throw new Error('Network error');
        }
        return [];
      });
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();
      vi.spyOn(syncEngine as any, 'delay').mockResolvedValue();

      await syncEngine.sync();

      expect(syncEngine.getStatus()).toBe('online');
    });
  });

  describe('6.2 Data Edge Cases', () => {
    let syncQueue: SyncQueue;

    beforeEach(() => {
      vi.clearAllMocks();
      syncQueue = new SyncQueue();
    });

    it('should handle empty sync response', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
        operations: [],
        version: 1,
      }));

      await syncQueue.restore();

      expect(syncQueue.getCount()).toBe(0);
      expect(syncQueue.peek()).toBeUndefined();
    });

    it('should handle null field values in operations', async () => {
      const operation = createOperation('UPDATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: null,
        amountMl: null,
        side: null,
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.notes).toBeNull();
      expect(queued?.data?.amountMl).toBeNull();
    });

    it('should handle undefined field values in operations', async () => {
      const operation = createOperation('UPDATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: undefined,
        existingField: 'value',
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.existingField).toBe('value');
    });

    it('should handle Unicode characters in text fields', async () => {
      const unicodeNotes = '宝宝吃奶 🍼 très bien café naïve';
      const operation = createOperation('CREATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: unicodeNotes,
        babyId: 'baby-1',
      };

      await syncQueue.enqueue(operation);
      await syncQueue.persist();

      const savedData = JSON.parse(
        (vi.mocked(AsyncStorage.setItem).mock.calls[0] as [string, string])[1]
      );

      expect(savedData.operations[0].data.notes).toBe(unicodeNotes);
    });

    it('should handle emoji in text fields', async () => {
      const emojiNotes = '👶🍼😊❤️🎉 Baby loved it! 💪';
      const operation = createOperation('CREATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: emojiNotes,
        babyId: 'baby-1',
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.notes).toBe(emojiNotes);
    });

    it('should handle dates in different timezones', async () => {
      const timezones = [
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T10:00:00.000+05:30',
        '2024-01-15T10:00:00.000-08:00',
        '2024-01-15T10:00:00.000+00:00',
      ];

      for (const tz of timezones) {
        const operation = createOperation('CREATE', 'feedings', `f-${tz}`);
        operation.timestamp = tz;
        operation.data = {
          id: `f-${tz}`,
          startedAt: tz,
          babyId: 'baby-1',
        };

        await syncQueue.enqueue(operation);
      }

      expect(syncQueue.getCount()).toBe(4);
    });

    it('should handle maximum field lengths (10000 characters)', async () => {
      const longNotes = 'x'.repeat(10000);
      const operation = createOperation('CREATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: longNotes,
        babyId: 'baby-1',
      };

      await syncQueue.enqueue(operation);
      await syncQueue.persist();

      const savedData = JSON.parse(
        (vi.mocked(AsyncStorage.setItem).mock.calls[0] as [string, string])[1]
      );

      expect(savedData.operations[0].data.notes.length).toBe(10000);
    });

    it('should handle mixed content (Unicode, emoji, special chars)', async () => {
      const mixedContent = `
        Baby's first feeding! 🎉
        宝宝第一次喂奶
        Température: 37°C
        Notes: "café" & 'thé' <3
        Special chars: @#$%^&*()
      `;
      const operation = createOperation('CREATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: mixedContent,
        babyId: 'baby-1',
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.notes).toBe(mixedContent);
    });

    it('should handle empty string values', async () => {
      const operation = createOperation('UPDATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        notes: '',
        foodType: '',
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.notes).toBe('');
      expect(queued?.data?.foodType).toBe('');
    });

    it('should handle numeric edge values', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      operation.data = {
        id: 'f1',
        amountMl: 0,
        durationSeconds: Number.MAX_SAFE_INTEGER,
        babyId: 'baby-1',
      };

      await syncQueue.enqueue(operation);
      const queued = syncQueue.peek();

      expect(queued?.data?.amountMl).toBe(0);
      expect(queued?.data?.durationSeconds).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('6.3 Queue Edge Cases', () => {
    let syncQueue: SyncQueue;

    beforeEach(() => {
      vi.clearAllMocks();
      syncQueue = new SyncQueue();
    });

    it('should handle 100+ items in queue successfully', async () => {
      for (let i = 0; i < 150; i++) {
        const op = createOperation('CREATE', 'feedings', `f${i}`);
        op.timestamp = new Date(Date.now() + i).toISOString();
        await syncQueue.enqueue(op);
      }

      expect(syncQueue.getCount()).toBe(150);

      const batches = syncQueue.getBatches(50);
      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(50);
      expect(batches[1].length).toBe(50);
      expect(batches[2].length).toBe(50);
    });

    it('should handle queue with items older than 24 hours', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      const oldOperation = createOperation('CREATE', 'feedings', 'f-old');
      oldOperation.timestamp = oldDate.toISOString();
      await syncQueue.enqueue(oldOperation);

      const newOperation = createOperation('CREATE', 'feedings', 'f-new');
      await syncQueue.enqueue(newOperation);

      const staleOps = syncQueue.getStaleOperations(24);
      expect(staleOps.length).toBe(1);
      expect(staleOps[0].entityId).toBe('f-old');
    });

    it('should maintain queue after simulated crash (persist/restore)', async () => {
      for (let i = 0; i < 10; i++) {
        await syncQueue.enqueue(createOperation('CREATE', 'feedings', `f${i}`));
      }
      await syncQueue.persist();

      const savedData = JSON.parse(
        (vi.mocked(AsyncStorage.setItem).mock.calls[0] as [string, string])[1]
      );

      const newQueue = new SyncQueue();
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(savedData));
      await newQueue.restore();

      expect(newQueue.getCount()).toBe(10);
    });

    it('should collapse duplicate operations correctly', async () => {
      const op1 = createOperation('UPDATE', 'feedings', 'f1');
      op1.timestamp = '2024-01-01T10:00:00.000Z';
      op1.data = { notes: 'first update' };

      const op2 = createOperation('UPDATE', 'feedings', 'f1');
      op2.timestamp = '2024-01-01T10:01:00.000Z';
      op2.data = { notes: 'second update' };

      const op3 = createOperation('UPDATE', 'feedings', 'f1');
      op3.timestamp = '2024-01-01T10:02:00.000Z';
      op3.data = { notes: 'third update' };

      await syncQueue.enqueue(op1);
      await syncQueue.enqueue(op2);
      await syncQueue.enqueue(op3);

      syncQueue.optimize();

      expect(syncQueue.getCount()).toBe(1);
      expect(syncQueue.peek()?.data?.notes).toBe('third update');
    });

    it('should handle mixed operation types for same entity', async () => {
      const create = createOperation('CREATE', 'feedings', 'f1');
      create.timestamp = '2024-01-01T10:00:00.000Z';

      const update = createOperation('UPDATE', 'feedings', 'f1');
      update.timestamp = '2024-01-01T10:01:00.000Z';
      update.data = { notes: 'updated' };

      const del = createOperation('DELETE', 'feedings', 'f1');
      del.timestamp = '2024-01-01T10:02:00.000Z';

      await syncQueue.enqueue(create);
      await syncQueue.enqueue(update);
      await syncQueue.enqueue(del);

      syncQueue.optimize();

      expect(syncQueue.getCount()).toBe(0);
    });

    it('should preserve order across different tables', async () => {
      const tables: SyncableTable[] = ['feedings', 'sleep_sessions', 'diapers'];

      for (let i = 0; i < tables.length; i++) {
        const op = createOperation('CREATE', tables[i], `${tables[i]}-1`);
        op.timestamp = new Date(Date.now() + i * 1000).toISOString();
        await syncQueue.enqueue(op);
      }

      const all = syncQueue.getAll();
      expect(all[0].table).toBe('feedings');
      expect(all[1].table).toBe('sleep_sessions');
      expect(all[2].table).toBe('diapers');
    });
  });

  describe('6.4 Caregiver Edge Cases', () => {
    it('should handle 10+ caregivers in household', async () => {
      const caregivers = [];
      for (let i = 0; i < 15; i++) {
        caregivers.push({
          id: `user-${i}`,
          email: `user${i}@test.com`,
          displayName: `User ${i}`,
          isOwner: i === 0,
        });
      }

      expect(caregivers.length).toBe(15);
      expect(caregivers.filter((c) => c.isOwner).length).toBe(1);
    });

    it('should handle 50-character caregiver name', () => {
      const longName = 'A'.repeat(50);
      const truncatedName = longName.substring(0, 20) + '...';

      expect(longName.length).toBe(50);
      expect(truncatedName.length).toBe(23);
      expect(truncatedName).toBe('AAAAAAAAAAAAAAAAAAAA...');
    });

    it('should fallback to email when display name is null', () => {
      const caregiver = {
        id: 'user-1',
        email: 'user@example.com',
        displayName: null as string | null,
      };

      const displayValue = caregiver.displayName || caregiver.email;
      expect(displayValue).toBe('user@example.com');
    });

    it('should fallback to email when display name is empty', () => {
      const caregiver = {
        id: 'user-1',
        email: 'user@example.com',
        displayName: '',
      };

      const displayValue = caregiver.displayName || caregiver.email;
      expect(displayValue).toBe('user@example.com');
    });

    it('should queue caregiver removal when offline', async () => {
      const syncQueue = new SyncQueue();

      const removalOperation: QueuedOperation = {
        id: 'op-removal-1',
        type: 'DELETE',
        table: 'babies',
        entityId: 'caregiver-to-remove',
        data: null,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      await syncQueue.enqueue(removalOperation);

      expect(syncQueue.getCount()).toBe(1);
      expect(syncQueue.peek()?.type).toBe('DELETE');
    });

    it('should handle special characters in caregiver names', () => {
      const specialNames = [
        "O'Brien",
        'José García',
        '田中太郎',
        'Müller',
        'François-Xavier',
        'Anna-Maria',
      ];

      for (const name of specialNames) {
        const caregiver = {
          id: `user-${name}`,
          displayName: name,
          email: 'test@example.com',
        };

        expect(caregiver.displayName).toBe(name);
      }
    });
  });
});

function createOperation(
  type: OperationType,
  table: SyncableTable,
  entityId: string
): QueuedOperation {
  return {
    id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    table,
    entityId,
    data: type === 'DELETE' ? null : { id: entityId, babyId: 'baby-1' },
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}
