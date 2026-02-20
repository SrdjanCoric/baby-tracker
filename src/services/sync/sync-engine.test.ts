import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from './sync-engine';
import { QueuedOperation } from './types';

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
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    },
  },
}));

describe('SyncEngine', () => {
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

  describe('initialization', () => {
    it('should check network status on init', async () => {
      const NetInfo = await import('@react-native-community/netinfo');

      await syncEngine.initialize();

      expect(NetInfo.default.fetch).toHaveBeenCalled();
    });

    it('should load pending queue from storage on init', async () => {
      const savedQueue = {
        operations: [createOperation('CREATE', 'feedings', 'f1')],
        version: 1,
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(savedQueue));

      await syncEngine.initialize();

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should establish realtime connection when online', async () => {
      const NetInfo = await import('@react-native-community/netinfo');
      vi.mocked(NetInfo.default.fetch).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      });

      await syncEngine.initialize();

      expect(syncEngine.isOnline()).toBe(true);
    });

    it('should remain in offline mode when no network', async () => {
      const NetInfo = await import('@react-native-community/netinfo');
      vi.mocked(NetInfo.default.fetch).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      await syncEngine.initialize();

      expect(syncEngine.isOnline()).toBe(false);
    });
  });

  describe('network transitions', () => {
    it('should start sync on online transition', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      const syncSpy = vi.spyOn(syncEngine, 'sync').mockResolvedValue();

      syncEngine.handleNetworkChange(true);
      await vi.runAllTimersAsync();

      expect(syncSpy).toHaveBeenCalled();
    });

    it('should pause sync on offline transition', async () => {
      await syncEngine.initialize();

      syncEngine.handleNetworkChange(false);
      await vi.runAllTimersAsync();

      expect(syncEngine.isOnline()).toBe(false);
      expect(syncEngine.getStatus()).toBe('offline');
    });

    it('should handle rapid online/offline toggles (debounce 300ms)', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      const syncSpy = vi.spyOn(syncEngine, 'sync').mockResolvedValue();

      syncEngine.handleNetworkChange(true);
      await vi.advanceTimersByTimeAsync(100);
      syncEngine.handleNetworkChange(false);
      await vi.advanceTimersByTimeAsync(100);
      syncEngine.handleNetworkChange(true);
      await vi.advanceTimersByTimeAsync(300);

      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sync operations', () => {
    beforeEach(async () => {
      syncEngine.setOnlineForTesting(true);
    });

    it('should pull all remote changes since last sync', async () => {
      const pullSpy = vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();

      await syncEngine.sync();

      expect(pullSpy).toHaveBeenCalled();
    });

    it('should push all queued local changes', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      const pushSpy = vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();
      vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);

      await syncEngine.sync();

      expect(pushSpy).toHaveBeenCalled();
    });

    it('should update last sync timestamp on success', async () => {
      vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();

      await syncEngine.sync();

      expect(syncEngine.getLastSyncedAt()).not.toBeNull();
    });

    it('should emit sync complete event', async () => {
      const listener = vi.fn();
      syncEngine.subscribe(listener);
      vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();

      await syncEngine.sync();

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        status: 'online',
      }));
    });

    it('should retry sync on transient network error', async () => {
      vi.useRealTimers();
      let callCount = 0;
      vi.spyOn(syncEngine as any, 'pullChanges').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
        return [];
      });
      vi.spyOn(syncEngine as any, 'pushChanges').mockResolvedValue();
      vi.spyOn(syncEngine as any, 'delay').mockResolvedValue();

      await syncEngine.sync();

      expect(callCount).toBe(3);
    });
  });

  describe('crash recovery', () => {
    it('should handle app crash during push phase', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      const savedQueue = {
        operations: [operation],
        version: 1,
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(savedQueue));

      await syncEngine.initialize();

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should handle app crash during pull phase', async () => {
      vi.useRealTimers();
      syncEngine.setOnlineForTesting(true);
      vi.spyOn(syncEngine as any, 'pullChanges').mockRejectedValue(new Error('Crash'));
      vi.spyOn(syncEngine as any, 'delay').mockResolvedValue();

      await expect(syncEngine.sync()).rejects.toThrow();
      expect(syncEngine.getStatus()).toBe('error');
    });

    it('should not duplicate data on resume', async () => {
      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      await syncEngine.enqueueOperation(operation);

      expect(syncEngine.getPendingCount()).toBe(1);
    });
  });

  describe('data validation', () => {
    it('should reject malformed entity data', async () => {
      const malformedOperation = {
        id: 'op-1',
        type: 'CREATE' as const,
        table: 'feedings' as const,
        entityId: 'f1',
        data: null,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      const result = syncEngine.validateOperation(malformedOperation);

      expect(result.valid).toBe(false);
    });

    it('should quarantine invalid data for review', async () => {
      const invalidOperation = createOperation('CREATE', 'feedings', 'f1');
      invalidOperation.data = { invalid: true };

      await syncEngine.quarantineOperation(invalidOperation);

      const quarantined = syncEngine.getQuarantinedOperations();
      expect(quarantined).toHaveLength(1);
    });
  });

  describe('status management', () => {
    it('should return current sync state', () => {
      const state = syncEngine.getState();

      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('pendingCount');
      expect(state).toHaveProperty('lastSyncedAt');
      expect(state).toHaveProperty('error');
      expect(state).toHaveProperty('isConnected');
    });

    it('should allow subscribing to status updates', () => {
      const listener = vi.fn();

      const unsubscribe = syncEngine.subscribe(listener);
      syncEngine.setStatus('syncing');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        status: 'syncing',
      }));

      unsubscribe();
    });
  });

  describe('auth error detection', () => {
    beforeEach(() => {
      syncEngine.setOnlineForTesting(true);
    });

    it('should call refreshSession on JWT auth error', async () => {
      vi.useRealTimers();
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: { code: 'PGRST301', message: 'JWT expired' },
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as never);

      const operation = createOperation('CREATE', 'feedings', 'f1');
      await syncEngine.enqueueOperation(operation);
      vi.spyOn(syncEngine, 'delay').mockResolvedValue();

      await syncEngine.sync();

      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should call refreshSession on 401 error code', async () => {
      vi.useRealTimers();
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { code: '401', message: 'Unauthorized' },
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as never);

      const operation = createOperation('UPDATE', 'feedings', 'f2');
      await syncEngine.enqueueOperation(operation);
      vi.spyOn(syncEngine, 'delay').mockResolvedValue();

      await syncEngine.sync();

      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should not call refreshSession on non-auth errors', async () => {
      vi.useRealTimers();
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: { code: '23503', message: 'Foreign key violation' },
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as never);

      const operation = createOperation('CREATE', 'feedings', 'f3');
      await syncEngine.enqueueOperation(operation);
      vi.spyOn(syncEngine, 'delay').mockResolvedValue();

      await syncEngine.sync();

      expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    });
  });
});

function createOperation(
  type: 'CREATE' | 'UPDATE' | 'DELETE',
  table: 'feedings' | 'sleep_sessions' | 'diapers' | 'pumping_sessions' | 'growth_measurements' | 'tummy_time_sessions' | 'babies',
  entityId: string
): QueuedOperation {
  return {
    id: `op-${entityId}`,
    type,
    table,
    entityId,
    data: type === 'DELETE' ? null : { id: entityId, babyId: 'baby-1' },
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}
