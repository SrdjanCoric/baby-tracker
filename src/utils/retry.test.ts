import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRetryableError,
  calculateBackoff,
  withRetry,
  withRetryResult,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from './retry';

describe('isRetryableError', () => {
  it('should return true for network errors', () => {
    expect(isRetryableError(new Error('Network request failed'))).toBe(true);
    expect(isRetryableError(new Error('network error'))).toBe(true);
  });

  it('should return true for timeout errors', () => {
    expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('should return true for PostgreSQL REST errors', () => {
    expect(isRetryableError(new Error('PGRST301'))).toBe(true);
  });

  it('should return true for 503/504 errors', () => {
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
  });

  it('should return true for connection refused errors', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    expect(isRetryableError(new Error('Not found'))).toBe(false);
    expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
  });

  it('should return false for null or undefined', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('should handle string errors', () => {
    expect(isRetryableError('network failed')).toBe(true);
    expect(isRetryableError('some other error')).toBe(false);
  });

  it('should use custom patterns when provided', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      retryableErrors: ['custom_error'],
    };
    expect(isRetryableError(new Error('custom_error occurred'), config)).toBe(true);
    expect(isRetryableError(new Error('network failed'), config)).toBe(false);
  });
});

describe('calculateBackoff', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return base delay for first attempt', () => {
    const delay = calculateBackoff(0);
    expect(delay).toBeGreaterThanOrEqual(DEFAULT_RETRY_CONFIG.baseDelayMs);
    expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.baseDelayMs * 1.3);
  });

  it('should increase exponentially with attempts', () => {
    const delay0 = calculateBackoff(0);
    const delay1 = calculateBackoff(1);
    const delay2 = calculateBackoff(2);

    expect(delay1).toBeGreaterThan(delay0);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it('should not exceed max delay', () => {
    const delay = calculateBackoff(10);
    expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
  });

  it('should respect custom config', () => {
    const config: RetryConfig = {
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 2000,
    };
    const delay = calculateBackoff(0, config);
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(650);
  });
});

describe('withRetry', () => {
  const shortDelayConfig = {
    baseDelayMs: 1,
    maxDelayMs: 5,
  };

  it('should return result on first success', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withRetry(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const result = await withRetry(operation, { ...shortDelayConfig, maxRetries: 3 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      withRetry(operation, { ...shortDelayConfig, maxRetries: 2 })
    ).rejects.toThrow('network error');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('invalid input'));

    await expect(withRetry(operation, shortDelayConfig)).rejects.toThrow('invalid input');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should respect custom retry config', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('custom_error'))
      .mockResolvedValue('success');

    const config = {
      ...shortDelayConfig,
      maxRetries: 2,
      retryableErrors: ['custom_error'],
    };

    const result = await withRetry(operation, config);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('withRetryResult', () => {
  const shortDelayConfig = {
    baseDelayMs: 1,
    maxDelayMs: 5,
  };

  it('should return success result on success', async () => {
    const operation = vi.fn().mockResolvedValue('data');

    const result = await withRetryResult(operation);

    expect(result.success).toBe(true);
    expect(result.data).toBe('data');
    expect(result.attempts).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('should return failure result after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await withRetryResult(operation, { ...shortDelayConfig, maxRetries: 2 });

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.attempts).toBe(3);
    expect(result.error?.message).toBe('network error');
  });

  it('should track attempt count correctly', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const result = await withRetryResult(operation, { ...shortDelayConfig, maxRetries: 3 });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it('should return failure immediately for non-retryable errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('unauthorized'));

    const result = await withRetryResult(operation, shortDelayConfig);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.error?.message).toBe('unauthorized');
  });
});
