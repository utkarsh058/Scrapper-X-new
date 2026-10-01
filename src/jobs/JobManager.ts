import { Job } from '@/models/Job';
import { SearchRequestPayload } from '@/types';
import { orchestrator } from '@/orchestrator/LeadPilotOrchestrator';
import { leadPilotDb } from '@/db';

export class JobManager {
  /**
   * Dispatches a new search job asynchronously and returns immediately.
   */
  public async dispatchJob(criteria: SearchRequestPayload): Promise<Job> {
    const job = orchestrator.createJob(criteria);

    // Fire execution asynchronously without blocking the caller
    setTimeout(async () => {
      try {
        await orchestrator.executeJob(job.id);
      } catch (err) {
        console.error(`[JobManager] Error executing job ${job.id}:`, err);
      }
    }, 10);

    return job;
  }

  /**
   * Executes a job synchronously to completion (useful for tests and sync requests).
   */
  public async executeJobSync(criteria: SearchRequestPayload): Promise<Job> {
    const job = orchestrator.createJob(criteria);
    return await orchestrator.executeJob(job.id);
  }

  public getJob(jobId: string): Job | undefined {
    return leadPilotDb.getJob(jobId);
  }

  public getProgress(jobId: string) {
    const job = leadPilotDb.getJob(jobId);
    if (!job) return null;
    return {
      jobId: job.id,
      status: job.status,
      sourceStatus: job.sourceStatus,
      progressLog: job.progressLog,
      counters: {
        discovered: job.discovered,
        verified: job.verified,
        deduplicated: job.deduplicated,
        enriched: job.enriched,
        audited: job.audited,
        qualified: job.qualified,
        completed: job.completed,
      },
      rejectionReasons: job.rejectionReasons,
      error: job.error,
    };
  }

  public resumeJob(jobId: string): Promise<Job> {
    return orchestrator.resumeJob(jobId);
  }
}

export const jobManager = new JobManager();
