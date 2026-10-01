export type GoogleBudgetMode = 'PAY_AS_YOU_GO' | 'HARD_LIMIT' | 'FALLBACK';

export interface GoogleUsageRecord {
  timestamp: string;
  operation: 'TEXT_SEARCH' | 'PLACE_DETAILS' | 'AUTOCOMPLETE';
  sku: string;
  fieldMaskCount: number;
  success: boolean;
  statusCode?: number;
  durationMs: number;
  query?: string;
  placeId?: string;
  error?: string;
}

export interface GoogleUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  textSearchCalls: number;
  placeDetailsCalls: number;
  estimatedBillableOperations: number;
  providerErrors: { timestamp: string; error: string; code?: number }[];
  todayUsage: {
    date: string;
    requestCount: number;
    textSearchCalls: number;
    placeDetailsCalls: number;
  };
  monthlyUsage: {
    month: string;
    requestCount: number;
    textSearchCalls: number;
    placeDetailsCalls: number;
  };
  dailyLimit: number;
  monthlyLimit: number;
  budgetMode: GoogleBudgetMode;
  currentAlertLevel: 'NORMAL' | '50%' | '75%' | '90%' | '100%';
  isGoogleAllowed: boolean;
  blockReason?: string;
}

export class GoogleUsageTracker {
  private static instance: GoogleUsageTracker;

  private records: GoogleUsageRecord[] = [];
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private textSearchCalls = 0;
  private placeDetailsCalls = 0;
  private providerErrors: { timestamp: string; error: string; code?: number }[] = [];

  private constructor() {}

  public static getInstance(): GoogleUsageTracker {
    if (!GoogleUsageTracker.instance) {
      GoogleUsageTracker.instance = new GoogleUsageTracker();
    }
    return GoogleUsageTracker.instance;
  }

  public getBudgetMode(): GoogleBudgetMode {
    const mode = (process.env.GOOGLE_BUDGET_MODE || 'FALLBACK').toUpperCase();
    if (mode === 'PAY_AS_YOU_GO' || mode === 'PAYASYMEN' || mode === 'CONTINUE') {
      return 'PAY_AS_YOU_GO';
    }
    if (mode === 'HARD_LIMIT' || mode === 'STOP') {
      return 'HARD_LIMIT';
    }
    return 'FALLBACK';
  }

  public getDailyLimit(): number {
    return parseInt(process.env.GOOGLE_DAILY_SOFT_LIMIT || '200', 10);
  }

  public getMonthlyLimit(): number {
    return parseInt(process.env.GOOGLE_MONTHLY_SOFT_LIMIT || '6000', 10);
  }

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getMonthKey(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getTodayRecords(): GoogleUsageRecord[] {
    const today = this.getTodayKey();
    return this.records.filter((r) => r.timestamp.startsWith(today));
  }

  private getMonthRecords(): GoogleUsageRecord[] {
    const month = this.getMonthKey();
    return this.records.filter((r) => r.timestamp.startsWith(month));
  }

  /**
   * Evaluates whether Google Places calls are allowed given limits, thresholds, and modes.
   */
  public canExecuteGoogleRequest(): {
    allowed: boolean;
    mode: GoogleBudgetMode;
    effectiveAction: 'EXECUTE' | 'FALLBACK_TO_OSM' | 'STOP';
    percentUsed: number;
    reason?: string;
  } {
    const isEnabled = process.env.GOOGLE_PLACES_ENABLED !== 'false';
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (!isEnabled) {
      return {
        allowed: false,
        mode: this.getBudgetMode(),
        effectiveAction: 'FALLBACK_TO_OSM',
        percentUsed: 0,
        reason: 'GOOGLE_PLACES_ENABLED is set to false in environment.',
      };
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        allowed: false,
        mode: this.getBudgetMode(),
        effectiveAction: 'FALLBACK_TO_OSM',
        percentUsed: 0,
        reason: 'GOOGLE_PLACES_API_KEY is not configured on the server.',
      };
    }

    const mode = this.getBudgetMode();
    const dailyLimit = this.getDailyLimit();
    const todayRecords = this.getTodayRecords();
    const todayCalls = todayRecords.length;

    const percentUsed = dailyLimit > 0 ? (todayCalls / dailyLimit) * 100 : 0;

    if (percentUsed >= 100) {
      if (mode === 'HARD_LIMIT') {
        return {
          allowed: false,
          mode,
          effectiveAction: 'STOP',
          percentUsed,
          reason: `Daily Google API budget limit (${dailyLimit} operations) reached. HARD_LIMIT stops Google requests.`,
        };
      }
      if (mode === 'FALLBACK') {
        return {
          allowed: false,
          mode,
          effectiveAction: 'FALLBACK_TO_OSM',
          percentUsed,
          reason: `Daily Google API soft limit reached (${todayCalls}/${dailyLimit}). Falling back to OpenStreetMap / cache.`,
        };
      }
      // PAY_AS_YOU_GO: Allowed to continue
      return {
        allowed: true,
        mode,
        effectiveAction: 'EXECUTE',
        percentUsed,
        reason: `Exceeded standard allowance (${todayCalls}/${dailyLimit}), continuing in PAY_AS_YOU_GO mode.`,
      };
    }

    return {
      allowed: true,
      mode,
      effectiveAction: 'EXECUTE',
      percentUsed,
    };
  }

  /**
   * Records an API operation.
   */
  public recordOperation(params: {
    operation: 'TEXT_SEARCH' | 'PLACE_DETAILS' | 'AUTOCOMPLETE';
    sku?: string;
    fieldMaskCount?: number;
    success: boolean;
    statusCode?: number;
    durationMs: number;
    query?: string;
    placeId?: string;
    error?: string;
  }): void {
    this.totalRequests++;
    if (params.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (params.operation === 'TEXT_SEARCH') {
      this.textSearchCalls++;
    } else if (params.operation === 'PLACE_DETAILS') {
      this.placeDetailsCalls++;
    }

    if (params.error) {
      this.providerErrors.push({
        timestamp: new Date().toISOString(),
        error: params.error,
        code: params.statusCode,
      });
      if (this.providerErrors.length > 50) {
        this.providerErrors.shift();
      }
    }

    const record: GoogleUsageRecord = {
      timestamp: new Date().toISOString(),
      operation: params.operation,
      sku: params.sku || (params.operation === 'TEXT_SEARCH' ? 'Places_TextSearch_Pro' : 'Places_Details_Pro'),
      fieldMaskCount: params.fieldMaskCount || 8,
      success: params.success,
      statusCode: params.statusCode,
      durationMs: params.durationMs,
      query: params.query,
      placeId: params.placeId,
      error: params.error,
    };

    this.records.push(record);
    // Keep last 1000 in memory
    if (this.records.length > 1000) {
      this.records.shift();
    }
  }

  public getStats(): GoogleUsageStats {
    const todayRecords = this.getTodayRecords();
    const monthRecords = this.getMonthRecords();
    const dailyLimit = this.getDailyLimit();
    const monthlyLimit = this.getMonthlyLimit();
    const budgetMode = this.getBudgetMode();

    const percentUsed = dailyLimit > 0 ? (todayRecords.length / dailyLimit) * 100 : 0;
    let currentAlertLevel: 'NORMAL' | '50%' | '75%' | '90%' | '100%' = 'NORMAL';
    if (percentUsed >= 100) currentAlertLevel = '100%';
    else if (percentUsed >= 90) currentAlertLevel = '90%';
    else if (percentUsed >= 75) currentAlertLevel = '75%';
    else if (percentUsed >= 50) currentAlertLevel = '50%';

    const check = this.canExecuteGoogleRequest();

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      textSearchCalls: this.textSearchCalls,
      placeDetailsCalls: this.placeDetailsCalls,
      estimatedBillableOperations: this.textSearchCalls + this.placeDetailsCalls,
      providerErrors: [...this.providerErrors],
      todayUsage: {
        date: this.getTodayKey(),
        requestCount: todayRecords.length,
        textSearchCalls: todayRecords.filter((r) => r.operation === 'TEXT_SEARCH').length,
        placeDetailsCalls: todayRecords.filter((r) => r.operation === 'PLACE_DETAILS').length,
      },
      monthlyUsage: {
        month: this.getMonthKey(),
        requestCount: monthRecords.length,
        textSearchCalls: monthRecords.filter((r) => r.operation === 'TEXT_SEARCH').length,
        placeDetailsCalls: monthRecords.filter((r) => r.operation === 'PLACE_DETAILS').length,
      },
      dailyLimit,
      monthlyLimit,
      budgetMode,
      currentAlertLevel,
      isGoogleAllowed: check.allowed,
      blockReason: check.reason,
    };
  }
}

export const googleUsageTracker = GoogleUsageTracker.getInstance();
