/**
 * Retry utilities for bounded transient errors with exponential backoff and jitter.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();

  // Network / timeout
  if (
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }

  // HTTP status codes in message or error object
  const status = error.status || error.statusCode || error.response?.status;
  if (status) {
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    // Permanent 4xx (400, 401, 403, 404, etc.) are NOT transient
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Common transient strings
  if (msg.includes('429') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return true;
  }

  // Invalid key / unauthorized are NOT transient
  if (msg.includes('invalid api key') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('403')) {
    return false;
  }

  return false;
}

export async function executeWithRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Max 2 attempts total: 1 initial attempt + max 1 retry (Section 10)
  const maxRetries = options.maxRetries ?? 1;
  const initialDelay = options.initialDelayMs ?? 200;
  const factor = options.backoffFactor ?? 2;
  const maxDelay = options.maxDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs;

  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    attempt++;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const result = await fn(controller.signal);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const isTransient = isTransientError(err);
      if (attempt > maxRetries || !isTransient) {
        throw err;
      }

      options.onRetry?.(attempt, err);

      // Exponential backoff + full jitter
      const jitter = Math.random() * delay * 0.3;
      const actualWait = Math.min(delay + jitter, maxDelay);
      await new Promise((resolve) => setTimeout(resolve, actualWait));
      delay *= factor;
    }
  }
}
