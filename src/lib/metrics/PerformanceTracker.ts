export interface SearchTimestamps {
  searchStart: number;
  googleStart?: number;
  googleEnd?: number;
  osmStart?: number;
  osmEnd?: number;
  mergeStart?: number;
  mergeEnd?: number;
  responseSent?: number;
}

export interface SearchLatencyMeasurement {
  searchId: string;
  query: string;
  timestamp: string;
  timestamps: SearchTimestamps;
  googleLatencyMs: number;
  osmLatencyMs: number;
  mergeLatencyMs: number;
  fastPathLatencyMs: number;
  backgroundLatencyMs: number;
  totalLatencyMs: number;
  cacheHit: boolean;
  providers: {
    google: { status: string; discovered: number };
    osm: { status: string; discovered: number };
  };
}

export class PerformanceTracker {
  private static instance: PerformanceTracker;

  private measurements: SearchLatencyMeasurement[] = [];
  private activeSearchesCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private timeouts = 0;
  private retries = 0;
  private providerFailures = 0;

  private constructor() {}

  public static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  public recordSearchStart(): { searchStart: number } {
    this.activeSearchesCount++;
    return { searchStart: Date.now() };
  }

  public recordSearchEnd(measurement: Omit<SearchLatencyMeasurement, 'timestamp'>): void {
    this.activeSearchesCount = Math.max(0, this.activeSearchesCount - 1);
    if (measurement.cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    const fullRecord: SearchLatencyMeasurement = {
      ...measurement,
      timestamp: new Date().toISOString(),
    };

    this.measurements.push(fullRecord);
    // Keep last 500 measurements
    if (this.measurements.length > 500) {
      this.measurements.shift();
    }
  }

  public recordTimeout(): void {
    this.timeouts++;
  }

  public recordRetry(): void {
    this.retries++;
  }

  public recordProviderFailure(): void {
    this.providerFailures++;
  }

  /**
   * Calculates actual P50, P95, and P99 latencies across collected measurements.
   */
  public calculatePercentiles(metric: 'fastPathLatencyMs' | 'googleLatencyMs' | 'osmLatencyMs' = 'fastPathLatencyMs'): {
    p50: number;
    p95: number;
    p99: number;
    count: number;
    min: number;
    max: number;
    average: number;
  } {
    if (this.measurements.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0, min: 0, max: 0, average: 0 };
    }

    const values = this.measurements
      .map((m) => m[metric])
      .filter((v) => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0, min: 0, max: 0, average: 0 };
    }

    const getP = (p: number) => {
      const idx = Math.min(Math.floor((p / 100) * values.length), values.length - 1);
      return Math.round(values[idx]);
    };

    const sum = values.reduce((acc, v) => acc + v, 0);

    return {
      p50: getP(50),
      p95: getP(95),
      p99: getP(99),
      count: values.length,
      min: Math.round(values[0]),
      max: Math.round(values[values.length - 1]),
      average: Math.round(sum / values.length),
    };
  }

  public getLoadMetrics() {
    return {
      activeSearches: this.activeSearchesCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio: this.cacheHits + this.cacheMisses > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)).toFixed(3) : '0.000',
      timeouts: this.timeouts,
      retries: this.retries,
      providerFailures: this.providerFailures,
      totalSearchesRecorded: this.measurements.length,
    };
  }

  public getRecentMeasurements(limit = 20): SearchLatencyMeasurement[] {
    return this.measurements.slice(-limit).reverse();
  }
}

export const performanceTracker = PerformanceTracker.getInstance();
