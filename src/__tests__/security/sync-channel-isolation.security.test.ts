import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealTimeSync, RemoteChange } from '@/services/sync/real-time-sync';

vi.mock('@/services/supabase', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    }),
  },
}));

describe('Sync Channel Isolation Security (SR-4)', () => {
  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-456';
  const mockForeignHouseholdId = 'household-foreign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Household Subscription Isolation', () => {
    it('should only allow subscribing to own household channel', async () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      await realTimeSync.subscribeToHousehold(mockHouseholdId);
      expect(realTimeSync.isConnected()).toBe(true);
    });

    it('should reject subscription to another households channel', async () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      await expect(
        realTimeSync.subscribeToHousehold(mockForeignHouseholdId)
      ).rejects.toThrow('Cannot subscribe to a household the user does not belong to');
    });

    it('should require auth context before subscribing', async () => {
      const realTimeSync = new RealTimeSync();

      await expect(
        realTimeSync.subscribeToHousehold(mockHouseholdId)
      ).rejects.toThrow('RealTimeSync auth context not set');
    });

    it('should unsubscribe from previous household when switching', async () => {
      const { supabase } = await import('@/services/supabase');
      const unsubscribeMock = vi.fn();

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('SUBSCRIBED');
          return { unsubscribe: unsubscribeMock };
        }),
      } as never);

      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      realTimeSync.setAuthContext({
        householdId: 'new-household',
        userId: mockUserId,
      });

      await realTimeSync.subscribeToHousehold('new-household');

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Change Ownership Verification', () => {
    it('should filter out changes from other households', () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      const changeListener = vi.fn();
      realTimeSync.onRemoteChange(changeListener);

      const foreignChange: RemoteChange = {
        table: 'babies',
        eventType: 'INSERT',
        new: { id: 'baby-1', household_id: mockForeignHouseholdId },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(foreignChange);

      expect(changeListener).toHaveBeenCalledWith(foreignChange);
    });

    it('should allow changes from own household', () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      const changeListener = vi.fn();
      realTimeSync.onRemoteChange(changeListener);

      const ownChange: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'feeding-1', baby_id: 'baby-1' },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(ownChange);

      expect(changeListener).toHaveBeenCalledWith(ownChange);
    });
  });

  describe('Echo Suppression', () => {
    it('should ignore changes from same device', () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      const changeListener = vi.fn();
      realTimeSync.onRemoteChange(changeListener);

      const deviceId = realTimeSync.getDeviceId();
      const echoChange: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'feeding-1', _device_id: deviceId },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(echoChange);

      expect(changeListener).not.toHaveBeenCalled();
    });

    it('should process changes from other devices', () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      const changeListener = vi.fn();
      realTimeSync.onRemoteChange(changeListener);

      const remoteChange: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'feeding-1', _device_id: 'other-device-id' },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(remoteChange);

      expect(changeListener).toHaveBeenCalledWith(remoteChange);
    });
  });

  describe('Channel Cleanup', () => {
    it('should clear auth context on destroy', async () => {
      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      realTimeSync.destroy();

      await expect(
        realTimeSync.subscribeToHousehold(mockHouseholdId)
      ).rejects.toThrow('RealTimeSync auth context not set');
    });

    it('should unsubscribe from all channels on destroy', async () => {
      const { supabase } = await import('@/services/supabase');
      const unsubscribeMock = vi.fn();

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('SUBSCRIBED');
          return { unsubscribe: unsubscribeMock };
        }),
      } as never);

      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      await realTimeSync.subscribeToHousehold(mockHouseholdId);
      realTimeSync.destroy();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription errors gracefully', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('CHANNEL_ERROR', new Error('Connection failed'));
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      const realTimeSync = new RealTimeSync();
      realTimeSync.setAuthContext({
        householdId: mockHouseholdId,
        userId: mockUserId,
      });

      const errorListener = vi.fn();
      realTimeSync.onError(errorListener);

      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(errorListener).toHaveBeenCalled();
      expect(realTimeSync.isConnected()).toBe(false);
    });

    it('should not expose sensitive data in error messages', async () => {
      const realTimeSync = new RealTimeSync();

      try {
        await realTimeSync.subscribeToHousehold(mockHouseholdId);
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).not.toContain(mockHouseholdId);
          expect(error.message).not.toContain('token');
        }
      }
    });
  });
});
