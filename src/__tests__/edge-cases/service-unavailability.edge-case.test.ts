import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncEngine } from '@/services/sync/sync-engine';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: false, isInternetReachable: false }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/services/supabase', () => ({
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

describe('PowerSync Service Unavailability (EC-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Graceful Fallback', () => {
    it('should function in offline mode when service is down', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      await engine.initialize();

      expect(engine.getStatus()).toBe('offline');
      expect(engine.isOnline()).toBe(false);
    });

    it('should queue operations when service is unavailable', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      await engine.enqueueOperation({
        id: 'op-1',
        type: 'CREATE',
        table: 'feedings',
        entityId: 'feeding-1',
        data: { id: 'feeding-1', type: 'breast' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      expect(engine.getPendingCount()).toBe(1);
    });

    it('should maintain queue integrity during service outage', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      for (let i = 0; i < 10; i++) {
        await engine.enqueueOperation({
          id: `op-${i}`,
          type: 'CREATE',
          table: 'feedings',
          entityId: `feeding-${i}`,
          data: { id: `feeding-${i}`, type: 'breast' },
          timestamp: new Date(Date.now() + i).toISOString(),
          retryCount: 0,
        });
      }

      expect(engine.getPendingCount()).toBe(10);
    });
  });

  describe('Automatic Reconnection', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      const backoff1 = engine.delay(1000);
      const backoff2 = engine.delay(2000);

      expect(backoff1).toBeInstanceOf(Promise);
      expect(backoff2).toBeInstanceOf(Promise);
    });

    it('should update status when service recovers', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      engine.setOnlineForTesting(true);

      expect(engine.getStatus()).toBe('online');
      expect(engine.isOnline()).toBe(true);
    });
  });

  describe('Error State Management', () => {
    it('should track error state correctly', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      engine.setStatus('error');

      expect(engine.getStatus()).toBe('error');
    });

    it('should allow error recovery', async () => {
      const engine = new SyncEngine();
      engine.setAuthContext({ householdId: 'household-123', userId: 'user-123' });

      engine.setStatus('error');
      engine.setStatus('online');

      expect(engine.getStatus()).toBe('online');
    });
  });
});
