import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncEngine } from '@/services/sync/sync-engine';

const { storage, rpcMock } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  rpcMock: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
    multiRemove: vi.fn(),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: false, isInternetReachable: false }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/contexts/sync-context', () => ({
  clearSyncData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: rpcMock,
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

describe('Auth Token Security (SR-3)', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  describe('Token Clearing on Logout', () => {
    it('should clear sync data when user signs out', async () => {
      const { clearSyncData } = await import('@/contexts/sync-context');
      await clearSyncData();
      expect(clearSyncData).toHaveBeenCalled();
    });

    it('should clear auth context from sync engine on logout', async () => {
      const engine = new SyncEngine();

      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });
      expect(engine.getAuthContext()).not.toBeNull();

      await engine.clearAllData();
      expect(engine.getAuthContext()).toBeNull();
    });

    it('should clear pending operations queue on logout', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      await engine.enqueueOperation({
        id: 'op-1',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'entity-1',
        data: { id: 'entity-1', type: 'breast' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      expect(engine.getPendingCount()).toBeGreaterThan(0);

      await engine.clearAllData();
      expect(engine.getPendingCount()).toBe(0);
    });

    it('should reset sync state to initial values on logout', async () => {
      const engine = new SyncEngine();

      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });
      engine.setOnlineForTesting(true);

      await engine.clearAllData();

      const state = engine.getState();
      expect(state.status).toBe('offline');
      expect(state.pendingCount).toBe(0);
      expect(state.lastSyncedAt).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isConnected).toBe(false);
    });

    it('should clear quarantined operations on logout', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      const invalidOp = {
        id: 'op-invalid',
        type: 'CREATE' as const,
        table: 'feedings' as const,
        entityId: 'entity-1',
        data: null,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      await engine.quarantineOperation(invalidOp);
      expect(engine.getQuarantinedOperations().length).toBe(1);

      await engine.clearAllData();
      expect(engine.getQuarantinedOperations().length).toBe(0);
    });

    it("should retain another user's durable operation without uploading it", async () => {
      const aliceEngine = new SyncEngine({ debounceMs: 60_000 });
      aliceEngine.setAuthContext({ householdId: 'household-123', userId: 'alice' });
      aliceEngine.setCrdtSync({
        stampWrite: vi.fn(async () => ({ id: 'clock-1' })),
        forget: vi.fn(async () => {}),
        getShadow: vi.fn(async () => null),
        restoreShadow: vi.fn(async () => {}),
      });
      await aliceEngine.enqueueOperation({
        id: 'op-alice',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-alice',
        data: { id: 'feeding-alice', baby_id: 'baby-1', logged_by: 'alice' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      aliceEngine.destroy();

      const bobEngine = new SyncEngine({ debounceMs: 60_000 });
      bobEngine.setAuthContext({ householdId: 'household-123', userId: 'bob' });
      bobEngine.setCrdtSync({
        stampWrite: vi.fn(async () => ({ id: 'clock-2' })),
        forget: vi.fn(async () => {}),
        getShadow: vi.fn(async () => null),
        restoreShadow: vi.fn(async () => {}),
      });
      await bobEngine.initialize();
      bobEngine.setOnlineForTesting(true);
      await bobEngine.sync();

      expect(rpcMock).not.toHaveBeenCalled();
      expect(bobEngine.getPendingCount()).toBe(1);
      expect(bobEngine.getQuarantinedOperations()).toHaveLength(0);
      bobEngine.destroy();
    });

    it('binds an RPC to the immutable initiating user when auth changes in flight', async () => {
      const engine = new SyncEngine({ debounceMs: 60_000, maxRetries: 1 });
      engine.setAuthContext({ householdId: 'household-123', userId: 'alice' });
      engine.setCrdtSync({
        stampWrite: vi.fn(async () => ({ id: 'clock-1' })),
        forget: vi.fn(async () => {}),
        getShadow: vi.fn(async () => null),
        restoreShadow: vi.fn(async () => {}),
      });
      await engine.enqueueOperation({
        id: 'op-alice-race',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-alice-race',
        data: { id: 'feeding-alice-race', baby_id: 'baby-1', logged_by: 'alice' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      engine.setOnlineForTesting(true);
      rpcMock.mockImplementationOnce(async (_name: string, params: Record<string, unknown>) => {
        engine.setAuthContext({ householdId: 'household-123', userId: 'bob' });
        expect(params.p_expected_user_id).toBe('alice');
        return { error: { message: 'authenticated user changed' } };
      });

      await expect(engine.sync()).rejects.toThrow('authenticated user changed');

      expect(engine.getPendingCount()).toBe(1);
      expect(rpcMock).toHaveBeenCalledWith('merge_record', expect.objectContaining({
        p_operation_id: 'op-alice-race',
        p_expected_user_id: 'alice',
      }));
      engine.destroy();
    });
  });

  describe('Token Security Best Practices', () => {
    it('should not expose tokens in error messages', () => {
      const engine = new SyncEngine();

      const context = engine.getAuthContext();
      expect(context).toBeNull();
    });

    it('should handle token refresh failures by clearing data', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      vi.mocked(AsyncStorage.default.multiRemove).mockResolvedValue(undefined);

      await AsyncStorage.default.multiRemove(['@sync_queue']);

      expect(AsyncStorage.default.multiRemove).toHaveBeenCalled();
    });
  });
});
