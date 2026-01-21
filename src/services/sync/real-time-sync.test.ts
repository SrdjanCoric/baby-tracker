import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RealTimeSync, RemoteChange } from './real-time-sync';

vi.mock('@/services/supabase', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

describe('RealTimeSync', () => {
  let realTimeSync: RealTimeSync;
  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    realTimeSync = new RealTimeSync();
    realTimeSync.setAuthContext({ householdId: mockHouseholdId, userId: mockUserId });
  });

  afterEach(() => {
    realTimeSync.destroy();
  });

  describe('subscription management', () => {
    it('should subscribe to household changes on initialization', async () => {
      const { supabase } = await import('@/services/supabase');

      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('household:')
      );
    });

    it('should unsubscribe when household changes', async () => {
      const unsubscribeFn = vi.fn();
      const { supabase } = await import('@/services/supabase');
      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({
          unsubscribe: unsubscribeFn,
        }),
      } as never);

      await realTimeSync.subscribeToHousehold(mockHouseholdId);
      realTimeSync.setAuthContext({ householdId: 'new-household-456', userId: mockUserId });
      await realTimeSync.subscribeToHousehold('new-household-456');

      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('should handle subscription errors gracefully', async () => {
      const { supabase } = await import('@/services/supabase');
      const errorCallback = vi.fn();
      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('CHANNEL_ERROR', new Error('Connection failed'));
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      realTimeSync.onError(errorCallback);
      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reconnect after connection loss', async () => {
      const { supabase } = await import('@/services/supabase');
      let subscribeCallback: ((status: string) => void) | null = null;

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          subscribeCallback = callback;
          callback('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      await realTimeSync.subscribeToHousehold(mockHouseholdId);
      expect(realTimeSync.isConnected()).toBe(true);

      subscribeCallback?.('CLOSED');
      expect(realTimeSync.isConnected()).toBe(false);

      subscribeCallback?.('SUBSCRIBED');
      expect(realTimeSync.isConnected()).toBe(true);
    });
  });

  describe('remote change handling', () => {
    it('should apply remote INSERT to local storage', async () => {
      const changeHandler = vi.fn();
      realTimeSync.onRemoteChange(changeHandler);

      const insertChange: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'f1', baby_id: 'b1', type: 'breast' },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(insertChange);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'feedings',
          eventType: 'INSERT',
        })
      );
    });

    it('should apply remote UPDATE to local storage', async () => {
      const changeHandler = vi.fn();
      realTimeSync.onRemoteChange(changeHandler);

      const updateChange: RemoteChange = {
        table: 'feedings',
        eventType: 'UPDATE',
        new: { id: 'f1', baby_id: 'b1', notes: 'updated' },
        old: { id: 'f1', baby_id: 'b1', notes: null },
      };

      realTimeSync.__simulateRemoteChange(updateChange);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'feedings',
          eventType: 'UPDATE',
        })
      );
    });

    it('should apply remote DELETE from local storage', async () => {
      const changeHandler = vi.fn();
      realTimeSync.onRemoteChange(changeHandler);

      const deleteChange: RemoteChange = {
        table: 'feedings',
        eventType: 'DELETE',
        new: null,
        old: { id: 'f1', baby_id: 'b1' },
      };

      realTimeSync.__simulateRemoteChange(deleteChange);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'feedings',
          eventType: 'DELETE',
        })
      );
    });

    it('should ignore changes from same device (echo suppression)', async () => {
      const changeHandler = vi.fn();
      const deviceId = realTimeSync.getDeviceId();
      realTimeSync.onRemoteChange(changeHandler);

      const echoChange: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'f1', baby_id: 'b1', _device_id: deviceId },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(echoChange);

      expect(changeHandler).not.toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('should emit connected state when subscription active', async () => {
      const stateHandler = vi.fn();
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      realTimeSync.onConnectionChange(stateHandler);
      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(stateHandler).toHaveBeenCalledWith(true);
    });

    it('should emit disconnected state on error', async () => {
      const stateHandler = vi.fn();
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('CHANNEL_ERROR', new Error('Failed'));
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      realTimeSync.onConnectionChange(stateHandler);
      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(stateHandler).toHaveBeenCalledWith(false);
    });
  });
});
