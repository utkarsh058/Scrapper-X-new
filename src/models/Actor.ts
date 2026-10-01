import { ActorStatus } from './Enums';

export interface RetryPolicy {
  maxRetries: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
}

export interface ActorMetrics {
  startTime: number;
  endTime?: number;
  durationMs: number;
  itemsProcessed: number;
  itemsSuccess: number;
  itemsFailed: number;
  custom?: Record<string, any>;
}

export interface ActorResult<TOutput> {
  actorId: string;
  status: ActorStatus;
  data: TOutput;
  errors: string[];
  warnings: string[];
  metrics: ActorMetrics;
  sources: string[];
  executionTimeMs: number;
}

export interface ActorContext<TInput> {
  jobId: string;
  input: TInput;
  options?: Record<string, any>;
  onProgress?: (message: string, count?: number) => void;
}

export interface ActorContract<TInput, TOutput> {
  readonly actorId: string;
  readonly name: string;
  readonly version: string;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;

  execute(context: ActorContext<TInput>): Promise<ActorResult<TOutput>>;
}

/**
 * BaseActor: Provides standardized error handling, timeouts, retries, backoff, and metrics tracking.
 */
export abstract class BaseActor<TInput, TOutput> implements ActorContract<TInput, TOutput> {
  abstract readonly actorId: string;
  abstract readonly name: string;
  readonly version: string = '1.0.0';
  readonly timeoutMs: number = 30000;
  readonly retryPolicy: RetryPolicy = {
    maxRetries: 2,
    initialBackoffMs: 500,
    backoffMultiplier: 2,
  };

  /**
   * Internal execution implementation defined by individual actors.
   */
  protected abstract run(context: ActorContext<TInput>): Promise<{
    data: TOutput;
    warnings?: string[];
    metrics?: Partial<ActorMetrics>;
    sources?: string[];
    status?: ActorStatus;
  }>;

  /**
   * Public execution wrapper enforcing timeouts, retries, and metric compilation.
   */
  public async execute(context: ActorContext<TInput>): Promise<ActorResult<TOutput>> {
    const startTime = Date.now();
    let attempt = 0;
    const errors: string[] = [];
    let warnings: string[] = [];
    let backoff = this.retryPolicy.initialBackoffMs;

    while (attempt <= this.retryPolicy.maxRetries) {
      attempt++;
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Actor "${this.name}" timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        );

        const executionPromise = this.run(context);

        const result = await Promise.race([executionPromise, timeoutPromise]);
        const durationMs = Date.now() - startTime;

        return {
          actorId: this.actorId,
          status: result.status || 'COMPLETED',
          data: result.data,
          errors: [],
          warnings: result.warnings || warnings,
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs,
            itemsProcessed: result.metrics?.itemsProcessed ?? 1,
            itemsSuccess: result.metrics?.itemsSuccess ?? 1,
            itemsFailed: result.metrics?.itemsFailed ?? 0,
            custom: result.metrics?.custom,
          },
          sources: result.sources || [],
          executionTimeMs: durationMs,
        };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        errors.push(`Attempt ${attempt}: ${errMsg}`);

        if (attempt <= this.retryPolicy.maxRetries) {
          warnings.push(`Retry scheduled after failure: ${errMsg}`);
          await new Promise((r) => setTimeout(r, backoff));
          backoff *= this.retryPolicy.backoffMultiplier;
        } else {
          const durationMs = Date.now() - startTime;
          return {
            actorId: this.actorId,
            status: 'FAILED',
            data: null as any,
            errors,
            warnings,
            metrics: {
              startTime,
              endTime: Date.now(),
              durationMs,
              itemsProcessed: 0,
              itemsSuccess: 0,
              itemsFailed: 1,
            },
            sources: [],
            executionTimeMs: durationMs,
          };
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      actorId: this.actorId,
      status: 'FAILED',
      data: null as any,
      errors: ['Maximum retries exceeded.'],
      warnings,
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs,
        itemsProcessed: 0,
        itemsSuccess: 0,
        itemsFailed: 1,
      },
      sources: [],
      executionTimeMs: durationMs,
    };
  }
}
