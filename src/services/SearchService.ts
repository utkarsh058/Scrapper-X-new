import { SearchRequestPayload, SearchSummary } from '@/types';
import { jobManager } from '@/jobs/JobManager';
import { leadEntityToFrontend } from '@/models/Lead';
import { Job } from '@/models/Job';

export class SearchService {
  public async startSearch(criteria: SearchRequestPayload, sync: boolean = false) {
    if (sync) {
      const job = await jobManager.executeJobSync(criteria);
      return this.formatJobResponse(job);
    }

    const job = await jobManager.dispatchJob(criteria);
    return {
      success: true,
      jobId: job.id,
      status: job.status,
      message: 'Lead discovery job dispatched successfully.',
    };
  }

  public getJobStatus(jobId: string) {
    const job = jobManager.getJob(jobId);
    if (!job) return null;
    return this.formatJobResponse(job);
  }

  public getJobProgress(jobId: string) {
    return jobManager.getProgress(jobId);
  }

  public getJobResults(jobId: string) {
    const job = jobManager.getJob(jobId);
    if (!job) return null;
    return this.formatJobResponse(job);
  }

  public resumeSearch(jobId: string) {
    return jobManager.resumeJob(jobId);
  }

  private formatJobResponse(job: Job) {
    const frontendLeads = (job.leads || []).map(leadEntityToFrontend);

    const summary: SearchSummary = {
      total: frontendLeads.length,
      withPhone: frontendLeads.filter((l) => Boolean(l.phone)).length,
      withEmail: frontendLeads.filter((l) => Boolean(l.email)).length,
      emailAndPhone: frontendLeads.filter((l) => Boolean(l.email && l.phone)).length,
      hasPhoneOrEmail: frontendLeads.filter((l) => Boolean(l.email || l.phone)).length,
      noContact: frontendLeads.filter((l) => !l.email && !l.phone).length,
      noWebsite: frontendLeads.filter((l) => !l.websiteUrl || l.websiteStatus === 'No Website').length,
      websiteAvailable: frontendLeads.filter((l) => Boolean(l.websiteUrl) && l.websiteStatus !== 'Unreachable').length,
      workingWebsite: frontendLeads.filter((l) => l.websiteStatus === 'Working').length,
      needsImprovement: frontendLeads.filter((l) => l.websiteStatus === 'Needs Improvement').length,
      unreachable: frontendLeads.filter((l) => l.websiteStatus === 'Unreachable').length,
    };

    return {
      success: job.status !== 'FAILED',
      jobId: job.id,
      status: job.status,
      searchStatus: job.sourceStatus,
      sourceComplete: job.sourceComplete,
      statusReason: job.statusReason,
      leads: frontendLeads,
      summary,
      providerStats: job.providerStats || {
        osm: { rawCount: job.discovered, status: 'COMPLETE', durationMs: 0 },
        web: { rawCount: 0, status: 'COMPLETE', durationMs: 0 },
        directory: { rawCount: 0, status: 'COMPLETE', durationMs: 0 },
      },
      pipelineStats: {
        rawOsmCount: job.discovered,
        namedCount: job.discovered - job.rejectionReasons.MISSING_NAME,
        inCityBoundsCount: job.discovered - job.rejectionReasons.OUTSIDE_LOCATION,
        deduplicatedCount: job.deduplicated,
        withPhoneCount: summary.withPhone,
        withEmailCount: summary.withEmail,
        withWebsiteCount: summary.websiteAvailable,
        contactFilteredCount: job.enriched,
        websiteFilteredCount: job.audited,
        finalDeliveredCount: frontendLeads.length,
        requestedLimit: job.requestedLeads,
      },
      discardedBreakdown: {
        noName: job.rejectionReasons.MISSING_NAME,
        outsideCity: job.rejectionReasons.OUTSIDE_LOCATION,
        duplicate: job.rejectionReasons.DUPLICATE,
        contactFilterExcluded: job.rejectionReasons.NO_CONTACT,
        websiteFilterExcluded: job.rejectionReasons.NO_WEBSITE + job.rejectionReasons.HAS_WEBSITE,
      },
      rejectionReasons: job.rejectionReasons,
      providers: job.providersReport || {
        osm: {
          status: job.providerStats?.osm?.status || 'COMPLETE',
          discovered: job.providerStats?.osm?.rawCount || job.discovered,
          errors: job.providerStats?.osm?.errors || [],
        },
        webSearch: {
          status: job.providerStats?.webSearch?.status || job.providerStats?.web?.status || 'COMPLETE',
          discovered: job.providerStats?.webSearch?.rawCount ?? job.providerStats?.web?.rawCount ?? 0,
          errors: job.providerStats?.webSearch?.errors || job.providerStats?.web?.errors || [],
        },
        businessProvider: {
          status: job.providerStats?.businessProvider?.status || 'DISABLED',
          discovered: job.providerStats?.businessProvider?.rawCount || 0,
          errors: job.providerStats?.businessProvider?.errors || [],
        },
      },
      mergedCount: job.mergedCount ?? job.deduplicated,
      normalizedCount: job.normalizedCount ?? job.discovered,
      locationVerifiedCount: job.locationVerifiedCount ?? (job.discovered - job.rejectionReasons.OUTSIDE_LOCATION),
      deduplicatedCount: job.deduplicatedCount ?? job.deduplicated,
      phoneCount: job.phoneCount ?? summary.withPhone,
      emailCount: job.emailCount ?? summary.withEmail,
      phoneOrEmailCount: job.phoneOrEmailCount ?? summary.hasPhoneOrEmail,
      websiteDiscoveredCount: job.websiteDiscoveredCount ?? summary.websiteAvailable,
      websiteVerifiedCount: job.websiteVerifiedCount ?? summary.websiteAvailable,
      noWebsiteCount: job.noWebsiteCount ?? summary.noWebsite,
      enrichedCount: job.enrichedCount ?? job.enriched,
      finalCount: job.finalCount ?? frontendLeads.length,
      pipelineBreakdown: job.pipelineBreakdown || {
        rawDiscoveredCount: job.discovered,
        normalizedCount: job.discovered - (job.rejectionReasons.MISSING_NAME + job.rejectionReasons.INVALID_CATEGORY),
        inCityBoundsCount: job.discovered - job.rejectionReasons.OUTSIDE_LOCATION,
        deduplicatedCount: job.deduplicated,
        phoneCount: summary.withPhone,
        emailCount: summary.withEmail,
        phoneOrEmailCount: summary.hasPhoneOrEmail,
        websiteAvailableCount: summary.websiteAvailable,
        websiteUnavailableCount: summary.noWebsite,
        websiteUnreachableCount: summary.unreachable,
        finalQualifiedCount: job.qualified,
      },
      rejectedCandidates: job.rejectedCandidates || [],
      progressLog: job.progressLog,
      error: job.error,
    };
  }
}

export const searchService = new SearchService();
