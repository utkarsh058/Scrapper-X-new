/**
 * Concurrency & Timeout Configuration
 * Environment-configurable provider limits and timeouts.
 */

export interface ConcurrencyLimits {
  googlePlaces: number;
  osm: number;
  websiteFetch: number;
  crawler: number;
  pagespeed: number;
  webSearch: number;
}

export interface TimeoutConfig {
  googlePlacesFastMs: number;
  osmFastMs: number;
  websiteLightweightMs: number;
  crawlerMs: number;
  backgroundAuditMs: number;
}

export function getConcurrencyLimits(): ConcurrencyLimits {
  return {
    googlePlaces: parseInt(process.env.GOOGLE_PLACES_CONCURRENCY || '3', 10),
    osm: parseInt(process.env.OSM_CONCURRENCY || '2', 10),
    websiteFetch: parseInt(process.env.WEBSITE_FETCH_CONCURRENCY || '5', 10),
    crawler: parseInt(process.env.CRAWLER_CONCURRENCY || '2', 10),
    pagespeed: parseInt(process.env.PAGESPEED_CONCURRENCY || '2', 10),
    webSearch: parseInt(process.env.WEB_SEARCH_CONCURRENCY || '2', 10),
  };
}

export function getTimeoutConfig(): TimeoutConfig {
  return {
    googlePlacesFastMs: parseInt(process.env.GOOGLE_PLACES_TIMEOUT_MS || '2000', 10),
    osmFastMs: parseInt(process.env.OSM_TIMEOUT_MS || '2000', 10),
    websiteLightweightMs: parseInt(process.env.WEBSITE_FETCH_TIMEOUT_MS || '2000', 10),
    crawlerMs: parseInt(process.env.CRAWLER_TIMEOUT_MS || '8000', 10),
    backgroundAuditMs: parseInt(process.env.AUDIT_TIMEOUT_MS || '30000', 10),
  };
}

/**
 * Lightweight in-memory Semaphore for rate limiting concurrent async operations.
 */
export class AsyncSemaphore {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(public readonly maxConcurrency: number) {}

  public async acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  public getStats() {
    return {
      active: this.active,
      queued: this.queue.length,
      max: this.maxConcurrency,
    };
  }
}

// Global provider semaphores
const limits = getConcurrencyLimits();
export const semaphores = {
  googlePlaces: new AsyncSemaphore(limits.googlePlaces),
  osm: new AsyncSemaphore(limits.osm),
  websiteFetch: new AsyncSemaphore(limits.websiteFetch),
  crawler: new AsyncSemaphore(limits.crawler),
  pagespeed: new AsyncSemaphore(limits.pagespeed),
  webSearch: new AsyncSemaphore(limits.webSearch),
};
