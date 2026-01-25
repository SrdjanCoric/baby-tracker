export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['network', 'timeout', 'PGRST', '503', '504', 'ECONNREFUSED', 'ETIMEDOUT'],
};

export function isRetryableError(error: unknown, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const patterns = config.retryableErrors || DEFAULT_RETRY_CONFIG.retryableErrors || [];

  return patterns.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

export function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === finalConfig.maxRetries) {
        break;
      }

      if (!isRetryableError(error, finalConfig)) {
        break;
      }

      const delay = calculateBackoff(attempt, finalConfig);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export async function withRetryResult<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attempts = 0;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    attempts++;
    try {
      const data = await operation();
      return { success: true, data, attempts };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt === finalConfig.maxRetries) {
        return { success: false, error: err, attempts };
      }

      if (!isRetryableError(error, finalConfig)) {
        return { success: false, error: err, attempts };
      }

      const delay = calculateBackoff(attempt, finalConfig);
      await sleep(delay);
    }
  }

  return { success: false, error: new Error('Operation failed after retries'), attempts };
}
