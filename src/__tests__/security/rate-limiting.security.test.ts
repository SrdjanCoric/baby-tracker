import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  recordAttempt,
  clearRateLimitRecord,
  CAREGIVER_REMOVAL_LIMIT,
  INVITE_CODE_ATTEMPT_LIMIT,
} from '@/utils/rate-limiter';

vi.mock('@react-native-async-storage/async-storage', () => {
  const storage: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(storage[key] || null)),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
        return Promise.resolve();
      }),
    },
  };
});

describe('Rate Limiting Security (SR-5)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(null);
  });

  describe('Caregiver Removal Rate Limiting', () => {
    it('should allow first removal attempt', async () => {
      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(3);
      expect(result.error).toBeUndefined();
    });

    it('should track remaining attempts', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({ attempts: [now - 1000, now - 2000] })
      );

      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(1);
    });

    it('should block after max attempts reached', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({
          attempts: [now - 1000, now - 2000, now - 3000],
        })
      );

      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.error).toBe('rateLimitExceeded');
    });

    it('should provide reset time when rate limited', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();
      const oldestAttempt = now - 30 * 60 * 1000;

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({
          attempts: [oldestAttempt, now - 20 * 60 * 1000, now - 10 * 60 * 1000],
        })
      );

      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.resetAt).toBeDefined();
      expect(result.resetAt).toBeGreaterThan(now);
    });

    it('should reset after window expires', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();
      const expiredAttempt = now - 2 * 60 * 60 * 1000;

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({
          attempts: [expiredAttempt, expiredAttempt + 1000, expiredAttempt + 2000],
        })
      );

      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(3);
    });

    it('should record attempts correctly', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      await recordAttempt('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(AsyncStorage.default.setItem).toHaveBeenCalled();
      const call = vi.mocked(AsyncStorage.default.setItem).mock.calls[0];
      expect(call[0]).toBe('@rate_limit:test-household');

      const record = JSON.parse(call[1]);
      expect(record.attempts).toHaveLength(1);
    });

    it('should clear rate limit records', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      await clearRateLimitRecord('test-household');

      expect(AsyncStorage.default.removeItem).toHaveBeenCalledWith(
        '@rate_limit:test-household'
      );
    });
  });

  describe('Invite Code Rate Limiting', () => {
    it('should limit invite code attempts to 5 per minute', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({
          attempts: [now - 10000, now - 20000, now - 30000, now - 40000, now - 50000],
        })
      );

      const result = await checkRateLimit('invite-attempts', INVITE_CODE_ATTEMPT_LIMIT);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('rateLimitExceeded');
    });

    it('should reset invite code limit after 1 hour', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const now = Date.now();
      const expiredAttempt = now - 2 * 60 * 60 * 1000;

      vi.mocked(AsyncStorage.default.getItem).mockResolvedValue(
        JSON.stringify({
          attempts: Array(5).fill(expiredAttempt),
        })
      );

      const result = await checkRateLimit('invite-attempts', INVITE_CODE_ATTEMPT_LIMIT);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should allow operation when storage fails', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      vi.mocked(AsyncStorage.default.getItem).mockRejectedValue(
        new Error('Storage unavailable')
      );

      const result = await checkRateLimit('test-household', CAREGIVER_REMOVAL_LIMIT);

      expect(result.allowed).toBe(true);
    });

    it('should not fail operation when recording fails', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      vi.mocked(AsyncStorage.default.setItem).mockRejectedValue(
        new Error('Storage unavailable')
      );

      await expect(
        recordAttempt('test-household', CAREGIVER_REMOVAL_LIMIT)
      ).resolves.not.toThrow();
    });
  });
});
