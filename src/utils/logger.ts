export interface LogPayload {
  jobId?: string;
  actorId?: string;
  provider?: string;
  businessId?: string;
  durationMs?: number;
  status?: string;
  message: string;
  error?: any;
  extra?: Record<string, any>;
}

export class StructuredLogger {
  private format(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]${payload.jobId ? ` [Job:${payload.jobId}]` : ''}${payload.actorId ? ` [Actor:${payload.actorId}]` : ''}`;
    return `${prefix} ${payload.message}${payload.durationMs ? ` (${payload.durationMs}ms)` : ''}`;
  }

  public info(payload: LogPayload): void {
    console.log(this.format('INFO', payload));
    if (payload.extra) {
      console.log('   ↳ Extra:', JSON.stringify(payload.extra));
    }
  }

  public warn(payload: LogPayload): void {
    console.warn(this.format('WARN', payload));
    if (payload.extra) {
      console.warn('   ↳ Details:', JSON.stringify(payload.extra));
    }
  }

  public error(payload: LogPayload): void {
    console.error(this.format('ERROR', payload));
    if (payload.error) {
      console.error('   ↳ Error:', payload.error);
    }
  }

  public debug(payload: LogPayload): void {
    if (process.env.DEBUG === 'true') {
      console.debug(this.format('DEBUG', payload));
    }
  }
}

export const logger = new StructuredLogger();
