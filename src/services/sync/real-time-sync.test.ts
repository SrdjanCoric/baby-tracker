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

async function mockChannels() {
  const { supabase } = await import('@/services/supabase');
  const channels: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    status?: (status: string) => void;
  }[] = [];
  vi.mocked(supabase.channel).mockImplementation(() => {
    const channel = {
      on: vi.fn().mockReturnThis(), unsubscribe: vi.fn(),
      subscribe: vi.fn((status: (value: string) => void) => { channel.status = status; return channel; }),
      status: undefined as ((status: string) => void) | undefined,
    };
    channels.push(channel);
    return channel as never;
  });
  return channels;
}

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
    it('replaces the channel when the roster changes', async () => {
      const channels = await mockChannels();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1', 'baby-2']);
      expect(channels).toHaveLength(2);
      expect(channels[0].unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('does not resubscribe for a reordered roster with duplicates', async () => {
      const channels = await mockChannels();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1', 'baby-2']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2', 'baby-1', 'baby-1']);
      expect(channels).toHaveLength(1);
      expect(channels[0].unsubscribe).not.toHaveBeenCalled();
    });

    it('ignores CLOSED from an obsolete channel', async () => {
      const channels = await mockChannels();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      channels[1].status!('SUBSCRIBED');
      channels[0].status!('CLOSED');
      expect(realTimeSync.isConnected()).toBe(true);
    });

    it('drops events from an obsolete channel', async () => {
      const channels = await mockChannels();
      const received = vi.fn();
      realTimeSync.onRemoteChange(received);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      const oldListener = channels[0].on.mock.calls.find(call => call[1].table === 'feedings')![2];
      oldListener({ eventType: 'INSERT', new: { id: 'stale', baby_id: 'baby-1' }, old: {} });
      expect(received).not.toHaveBeenCalled();
    });

    it('uses only current baby ids in the replacement filter', async () => {
      const channels = await mockChannels();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1', 'baby-2']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      expect(channels[1].on.mock.calls.find(call => call[1].table === 'feedings')![1].filter).toBe('baby_id=in.(baby-2)');
    });

    it('ignores late SUBSCRIBED after sign-out and unsubscribes every channel', async () => {
      const channels = await mockChannels();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      channels[1].status!('SUBSCRIBED');
      realTimeSync.clearAuthContext();
      for (const channel of channels) {
        channel.status!('SUBSCRIBED');
        expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
      }
      expect(realTimeSync.isConnected()).toBe(false);
    });

    it('keeps connection telemetry steady during roster replacement but disconnects on sign-out', async () => {
      const channels = await mockChannels();
      const connection = vi.fn();
      realTimeSync.onConnectionChange(connection);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      channels[0].status!('SUBSCRIBED');
      connection.mockClear();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      expect(connection).not.toHaveBeenCalled();
      expect(realTimeSync.isConnected()).toBe(true);
      channels[1].status!('CHANNEL_ERROR');
      expect(connection).toHaveBeenLastCalledWith(false);
      channels[1].status!('SUBSCRIBED');
      connection.mockClear();
      realTimeSync.clearAuthContext();
      expect(connection).toHaveBeenCalledWith(false);
    });

    it('only reports the first activation of a same-household replacement', async () => {
      const channels = await mockChannels();
      const replaced = vi.fn();
      realTimeSync.onSubscriptionReplaced(replaced);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      channels[0].status!('SUBSCRIBED');
      channels[0].status!('CHANNEL_ERROR');
      channels[0].status!('SUBSCRIBED');
      expect(replaced).not.toHaveBeenCalled();
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-2']);
      channels[1].status!('SUBSCRIBED');
      expect(replaced).toHaveBeenCalledTimes(1);
      channels[1].status!('CHANNEL_ERROR');
      channels[1].status!('SUBSCRIBED');
      expect(replaced).toHaveBeenCalledTimes(1);
      realTimeSync.setAuthContext({ householdId: 'other', userId: mockUserId });
      await realTimeSync.subscribeToHousehold('other', ['other-baby']);
      channels[2].status!('SUBSCRIBED');
      expect(replaced).toHaveBeenCalledTimes(1);
    });

    it('delivers a household baby hard delete with an empty new record', async () => {
      const { supabase } = await import('@/services/supabase');
      const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) };
      vi.mocked(supabase.channel).mockReturnValue(channel as never);
      const received = vi.fn();
      realTimeSync.onRemoteChange(received);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ['baby-1']);
      const babyListener = channel.on.mock.calls.find(call => call[1].table === 'babies')![2];
      babyListener({ eventType: 'DELETE', new: {}, old: { id: 'baby-1', household_id: mockHouseholdId } });
      expect(received).toHaveBeenCalledWith(expect.objectContaining({ new: null, old: { id: 'baby-1', household_id: mockHouseholdId } }));
    });

    it('filters the household and chunks baby listeners at 100 ids', async () => {
      const { supabase } = await import('@/services/supabase');
      const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) };
      vi.mocked(supabase.channel).mockReturnValue(channel as never);
      const ids = Array.from({ length: 101 }, (_, i) => `baby-${String(i).padStart(3, '0')}`);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, ids);
      const registrations = channel.on.mock.calls.map(call => call[1]);
      expect(registrations).toHaveLength(25);
      expect(registrations.filter(r => r.table === 'feedings').map(r => r.filter)).toEqual([
        `baby_id=in.(${ids.slice(0, 100).join(',')})`, 'baby_id=in.(baby-100)',
      ]);
      for (const registration of registrations) {
        expect(registration.event).toBe('*');
        if (registration.table === 'users') expect(registration.filter).toBeUndefined();
        else if (registration.table === 'babies') expect(registration.filter).toBe(`household_id=eq.${mockHouseholdId}`);
        else if (registration.table === 'households') expect(registration.filter).toBe(`id=eq.${mockHouseholdId}`);
        else expect(registration.filter).toMatch(/^baby_id=in\.\(/);
      }
    });

    it('keeps only household, babies and users listeners for an empty roster', async () => {
      const { supabase } = await import('@/services/supabase');
      const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) };
      vi.mocked(supabase.channel).mockReturnValue(channel as never);
      await realTimeSync.subscribeToHousehold(mockHouseholdId, []);
      expect(channel.on.mock.calls.map(call => call[1].table).sort()).toEqual(['babies', 'households', 'users']);
    });

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

    it('should handle TIMED_OUT status correctly', async () => {
      const stateHandler = vi.fn();
      const errorHandler = vi.fn();
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.channel).mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          callback('TIMED_OUT');
          return { unsubscribe: vi.fn() };
        }),
      } as never);

      realTimeSync.onConnectionChange(stateHandler);
      realTimeSync.onError(errorHandler);
      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(stateHandler).toHaveBeenCalledWith(false);
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('TIMED_OUT'),
      }));
    });
  });

  describe('verifyChangeOwnership', () => {
    it('should accept changes for babies in auth context household', () => {
      const change: RemoteChange = {
        table: 'babies',
        eventType: 'UPDATE',
        new: { id: 'baby-1', household_id: mockHouseholdId },
        old: { id: 'baby-1', household_id: mockHouseholdId },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(true);
    });

    it('should reject changes for babies in different household', () => {
      const change: RemoteChange = {
        table: 'babies',
        eventType: 'UPDATE',
        new: { id: 'baby-1', household_id: 'other-household' },
        old: { id: 'baby-1', household_id: 'other-household' },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(false);
    });

    it('should accept user changes when joining auth context household', () => {
      const change: RemoteChange = {
        table: 'users',
        eventType: 'UPDATE',
        new: { id: 'user-1', household_id: mockHouseholdId },
        old: { id: 'user-1', household_id: null },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(true);
    });

    it('should accept user changes when leaving auth context household', () => {
      const change: RemoteChange = {
        table: 'users',
        eventType: 'UPDATE',
        new: { id: 'user-1', household_id: null },
        old: { id: 'user-1', household_id: mockHouseholdId },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(true);
    });

    it('should reject user changes for different household', () => {
      const change: RemoteChange = {
        table: 'users',
        eventType: 'UPDATE',
        new: { id: 'user-1', household_id: 'other-household' },
        old: { id: 'user-1', household_id: 'another-household' },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(false);
    });

    it('should accept changes for auth context household (households table)', () => {
      const change: RemoteChange = {
        table: 'households',
        eventType: 'UPDATE',
        new: { id: mockHouseholdId, invite_code: 'NEWCODE' },
        old: { id: mockHouseholdId, invite_code: 'OLDCODE' },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(true);
    });

    it('should reject changes for different household (households table)', () => {
      const change: RemoteChange = {
        table: 'households',
        eventType: 'UPDATE',
        new: { id: 'other-household', invite_code: 'CODE' },
        old: { id: 'other-household', invite_code: 'OLD' },
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(false);
    });

    it('should accept activity table changes (trusted via RLS)', () => {
      const activityTables = [
        'feedings',
        'sleep_sessions',
        'diapers',
        'pumping_sessions',
        'growth_measurements',
        'tummy_time_sessions',
      ];

      for (const table of activityTables) {
        const change: RemoteChange = {
          table,
          eventType: 'INSERT',
          new: { id: 'entry-1', baby_id: 'baby-1' },
          old: null,
        };

        const result = realTimeSync.__testVerifyChangeOwnership(change);

        expect(result).toBe(true);
      }
    });

    it('should return false when auth context not set', () => {
      const freshSync = new RealTimeSync();
      const change: RemoteChange = {
        table: 'babies',
        eventType: 'INSERT',
        new: { id: 'baby-1', household_id: mockHouseholdId },
        old: null,
      };

      const result = freshSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(false);
      freshSync.destroy();
    });

    it('should return false when change has no data', () => {
      const change: RemoteChange = {
        table: 'babies',
        eventType: 'DELETE',
        new: null,
        old: null,
      };

      const result = realTimeSync.__testVerifyChangeOwnership(change);

      expect(result).toBe(false);
    });
  });

  describe('isEchoFromSameDevice', () => {
    it('should detect echo via _device_id in new record', () => {
      const deviceId = realTimeSync.getDeviceId();
      const change: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'f1', _device_id: deviceId },
        old: null,
      };

      const result = realTimeSync.__testIsEchoFromSameDevice(change);

      expect(result).toBe(true);
    });

    it('should detect echo via _device_id in old record', () => {
      const deviceId = realTimeSync.getDeviceId();
      const change: RemoteChange = {
        table: 'feedings',
        eventType: 'DELETE',
        new: null,
        old: { id: 'f1', _device_id: deviceId },
      };

      const result = realTimeSync.__testIsEchoFromSameDevice(change);

      expect(result).toBe(true);
    });

    it('should not treat different device_id as echo', () => {
      const change: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'f1', _device_id: 'different-device' },
        old: null,
      };

      const result = realTimeSync.__testIsEchoFromSameDevice(change);

      expect(result).toBe(false);
    });

    it('should not treat missing _device_id as echo', () => {
      const change: RemoteChange = {
        table: 'feedings',
        eventType: 'INSERT',
        new: { id: 'f1' },
        old: null,
      };

      const result = realTimeSync.__testIsEchoFromSameDevice(change);

      expect(result).toBe(false);
    });
  });

  describe('subscribeToHousehold validation', () => {
    it('should throw when subscribing to wrong household', async () => {
      await expect(
        realTimeSync.subscribeToHousehold('wrong-household-id')
      ).rejects.toThrow('Cannot subscribe to a household the user does not belong to');
    });

    it('should throw when auth context not set', async () => {
      const freshSync = new RealTimeSync();

      await expect(
        freshSync.subscribeToHousehold(mockHouseholdId)
      ).rejects.toThrow('RealTimeSync auth context not set');

      freshSync.destroy();
    });

    it('should not resubscribe if already subscribed to same household', async () => {
      const { supabase } = await import('@/services/supabase');
      const channelMock = vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({
          unsubscribe: vi.fn(),
        }),
      });
      vi.mocked(supabase.channel).mockImplementation(channelMock);

      await realTimeSync.subscribeToHousehold(mockHouseholdId);
      await realTimeSync.subscribeToHousehold(mockHouseholdId);

      expect(channelMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('ownership verification integration', () => {
    it('should filter out changes from different household', () => {
      const changeHandler = vi.fn();
      realTimeSync.onRemoteChange(changeHandler);

      const change: RemoteChange = {
        table: 'babies',
        eventType: 'INSERT',
        new: { id: 'baby-1', household_id: 'other-household' },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(change);

      expect(changeHandler).not.toHaveBeenCalled();
    });

    it('should pass through changes from correct household', () => {
      const changeHandler = vi.fn();
      realTimeSync.onRemoteChange(changeHandler);

      const change: RemoteChange = {
        table: 'babies',
        eventType: 'INSERT',
        new: { id: 'baby-1', household_id: mockHouseholdId },
        old: null,
      };

      realTimeSync.__simulateRemoteChange(change);

      expect(changeHandler).toHaveBeenCalledWith(change);
    });
  });
});
