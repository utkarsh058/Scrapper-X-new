import { NextRequest, NextResponse } from 'next/server';
import { leadPilotDb } from '@/db';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = leadPilotDb.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job with ID "${jobId}" not found.` },
        { status: 404 }
      );
    }

    const health = providerHealthService.checkHealth();

    return NextResponse.json({
      success: true,
      searchId: job.id,
      jobId: job.id,
      criteria: job.criteria,
      status: job.status,
      sourceStatus: job.sourceStatus,
      statusReason: job.statusReason,
      providerHealth: health,
      providers: job.providersReport,
      providerStats: job.providerStats,
      pipelineBreakdown: job.pipelineBreakdown,
      rejectionReasons: job.rejectionReasons,
      rejectedCandidates: job.rejectedCandidates || [],
      rotationStats: job.rotationStats,
      fastPathLatencyMs: job.fastPathLatencyMs,
      totalLatencyMs: job.latencyMs,
      backgroundJobsQueued: job.backgroundJobsQueued,
      progressLog: job.progressLog,
      actorRuns: leadPilotDb.getActorRunsByJob(jobId),
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve job debug metrics.' },
      { status: 500 }
    );
  }
}
