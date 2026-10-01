import { leadPilotDb } from '@/db';

export class DiagnosticsService {
  public getJobDiagnostics(jobId: string) {
    const job = leadPilotDb.getJob(jobId);
    if (!job) return null;

    const actorRuns = leadPilotDb.getActorRunsByJob(jobId);

    const googleRawCount = job.providerStats?.googlePlaces?.rawCount ?? 0;
    const osmRawCount = job.providerStats?.osm?.rawCount ?? 0;
    const webRawCount = job.providerStats?.webSearch?.rawCount ?? job.providerStats?.web?.rawCount ?? 0;
    const directoryRawCount = job.providerStats?.directory?.rawCount ?? 0;
    const totalDiscovered = job.discovered;
    const locationVerifiedCount = Math.max(0, job.discovered - job.rejectionReasons.OUTSIDE_LOCATION);
    const deduplicatedCount = job.deduplicated;
    const contactCount = job.enriched;
    const websiteCount = job.audited;
    const finalCount = job.completed;

    const providerStatuses = {
      googlePlaces: job.providerStats?.googlePlaces?.status || 'NOT_CONFIGURED',
      osm: job.providerStats?.osm?.status || (osmRawCount > 0 ? 'COMPLETE' : 'NO_RESULTS'),
      web: job.providerStats?.webSearch?.status || job.providerStats?.web?.status || (webRawCount > 0 ? 'COMPLETE' : 'NO_RESULTS'),
      directory: job.providerStats?.directory?.status || (directoryRawCount > 0 ? 'COMPLETE' : 'NO_RESULTS'),
    };

    const providerDurations = {
      googlePlaces: job.providerStats?.googlePlaces?.durationMs ?? 0,
      osm: job.providerStats?.osm?.durationMs ?? 0,
      web: job.providerStats?.webSearch?.durationMs ?? job.providerStats?.web?.durationMs ?? 0,
      directory: job.providerStats?.directory?.durationMs ?? 0,
    };

    return {
      jobId: job.id,
      searchParameters: job.criteria,
      status: job.status,
      sourceStatus: job.sourceStatus,
      sourceComplete: job.sourceComplete,
      statusReason: job.statusReason,

      // Multi-Source Diagnostics
      googleRawCount,
      osmRawCount,
      webRawCount,
      directoryRawCount,
      totalDiscovered,
      normalizedCount: totalDiscovered - (job.rejectionReasons.MISSING_NAME + job.rejectionReasons.INVALID_CATEGORY),
      deduplicatedCount,
      locationVerifiedCount,
      contactCount,
      finalCount,

      providers: job.providersReport || {
        googlePlaces: {
          status: job.providerStats?.googlePlaces?.status || 'NOT_CONFIGURED',
          discovered: googleRawCount,
          errors: job.providerStats?.googlePlaces?.errors || [],
        },
        osm: {
          status: job.providerStats?.osm?.status || 'COMPLETE',
          discovered: job.providerStats?.osm?.rawCount || totalDiscovered,
          errors: job.providerStats?.osm?.errors || [],
        },
        webSearch: {
          status: job.providerStats?.webSearch?.status || job.providerStats?.web?.status || 'COMPLETE',
          discovered: job.providerStats?.webSearch?.rawCount ?? job.providerStats?.web?.rawCount ?? 0,
          errors: job.providerStats?.webSearch?.errors || job.providerStats?.web?.errors || [],
        },
        directory: {
          status: job.providerStats?.directory?.status || 'NOT_NEEDED',
          discovered: directoryRawCount,
          errors: job.providerStats?.directory?.errors || [],
        },
      },
      mergedCount: job.mergedCount ?? deduplicatedCount,
      websiteDiscoveredCount: job.websiteDiscoveredCount ?? websiteCount,
      websiteVerifiedCount: job.websiteVerifiedCount ?? websiteCount,
      noWebsiteCount: job.noWebsiteCount ?? 0,
      enrichedCount: job.enrichedCount ?? contactCount,

      providerStatuses,
      providerDurations,
      rejectionReasons: job.rejectionReasons,
      pipelineBreakdown: job.pipelineBreakdown || {
        rawDiscoveredCount: totalDiscovered,
        normalizedCount: totalDiscovered - (job.rejectionReasons.MISSING_NAME + job.rejectionReasons.INVALID_CATEGORY),
        locationVerifiedCount,
        deduplicatedCount,
        phoneCount: 0,
        emailCount: 0,
        phoneOrEmailCount: 0,
        websiteAvailableCount: 0,
        websiteUnavailableCount: 0,
        websiteUnreachableCount: 0,
        finalQualifiedCount: job.qualified,
      },
      rejectedCandidates: job.rejectedCandidates || [],

      counters: {
        rawCount: job.discovered,
        locationVerifiedCount,
        deduplicatedCount,
        contactCount,
        websiteCount,
        qualifiedCount: job.qualified,
        finalCount,
      },
      actorStatuses: actorRuns.map((r) => ({
        actorId: r.actorId,
        status: r.status,
        durationMs: r.metrics.durationMs,
        attempts: r.attempts,
        errors: r.errors,
      })),
      progressLog: job.progressLog,
      timings: {
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
      error: job.error,
    };
  }
}

export const diagnosticsService = new DiagnosticsService();
