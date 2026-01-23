import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: number | null;
  error?: string;
}

interface RateLimitRecord {
  attempts: number[];
}

const RATE_LIMIT_KEY_PREFIX = '@rate_limit:';

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const storageKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const stored = await AsyncStorage.getItem(storageKey);
    let record: RateLimitRecord = stored ? JSON.parse(stored) : { attempts: [] };

    record.attempts = record.attempts.filter((timestamp) => timestamp > windowStart);

    if (record.attempts.length >= config.maxAttempts) {
      const oldestAttempt = Math.min(...record.attempts);
      const resetAt = oldestAttempt + config.windowMs;

      return {
        allowed: false,
        remainingAttempts: 0,
        resetAt,
        error: 'rateLimitExceeded',
      };
    }

    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - record.attempts.length,
      resetAt: null,
    };
  } catch (error) {
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts,
      resetAt: null,
    };
  }
}

export async function recordAttempt(key: string, config: RateLimitConfig): Promise<void> {
  const storageKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const stored = await AsyncStorage.getItem(storageKey);
    let record: RateLimitRecord = stored ? JSON.parse(stored) : { attempts: [] };

    record.attempts = record.attempts.filter((timestamp) => timestamp > windowStart);
    record.attempts.push(now);

    await AsyncStorage.setItem(storageKey, JSON.stringify(record));
  } catch (error) {
    // Best effort - don't fail the operation if rate limiting storage fails
  }
}

export async function clearRateLimitRecord(key: string): Promise<void> {
  const storageKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    // Ignore errors
  }
}

export const CAREGIVER_REMOVAL_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export const INVITE_CODE_ATTEMPT_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60 * 1000, // 1 minute
};

export const SYNC_RETRY_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
};
