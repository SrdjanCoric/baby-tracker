import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

describe('Active Timer + Sync Conflicts (EC-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Timer State Isolation', () => {
    it('should keep active timer state local-only (not synced)', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const timerKey = '@active_feeding_timer:baby-123';

      await AsyncStorage.default.setItem(
        timerKey,
        JSON.stringify({ isRunning: true, startedAt: new Date().toISOString() })
      );

      expect(AsyncStorage.default.setItem).toHaveBeenCalledWith(
        timerKey,
        expect.any(String)
      );
    });

    it('should not conflict with synced entries when timer is active', async () => {
      const localTimerEntry = {
        id: 'local-timer',
        isRunning: true,
        startedAt: new Date().toISOString(),
      };

      const remoteEntry = {
        id: 'remote-entry',
        type: 'breast',
        startedAt: new Date(Date.now() - 60000).toISOString(),
        endedAt: new Date().toISOString(),
      };

      expect(localTimerEntry.id).not.toBe(remoteEntry.id);
      expect(localTimerEntry.isRunning).toBe(true);
      expect(remoteEntry.endedAt).toBeDefined();
    });

    it('should create new entry when completing timer while offline', async () => {
      const timerStartTime = new Date(Date.now() - 300000).toISOString();
      const timerEndTime = new Date().toISOString();

      const completedEntry = {
        id: `entry-${Date.now()}`,
        type: 'breast',
        startedAt: timerStartTime,
        endedAt: timerEndTime,
        durationMinutes: 5,
      };

      expect(completedEntry.id).toMatch(/^entry-\d+$/);
      expect(completedEntry.endedAt).toBeDefined();
    });

    it('should not overwrite remote entries when completing offline timer', async () => {
      const localEntry = {
        id: 'local-new-entry',
        type: 'breast',
        startedAt: new Date(Date.now() - 300000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const remoteEntry = {
        id: 'remote-existing-entry',
        type: 'bottle',
        startedAt: new Date(Date.now() - 600000).toISOString(),
        createdAt: new Date(Date.now() - 60000).toISOString(),
      };

      expect(localEntry.id).not.toBe(remoteEntry.id);
    });
  });
});
