import { SearchRequestPayload } from '@/types';
import { Job, ActorRun, ProgressStep, RejectionBreakdown } from '@/models/Job';
import { LeadEntity } from '@/models/Lead';
import { leadPilotDb } from '@/db';
import { logger } from '@/utils/logger';
import { validateStateAndCity } from '@/data/indiaLocations';
import { resolveIndiaLocation } from '@/lib/geoResolver';

// Actors
import { businessDiscoveryActor } from '@/actors/BusinessDiscoveryActor';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { locationVerificationActor } from '@/actors/LocationVerificationActor';
import { businessVerificationActor } from '@/actors/BusinessVerificationActor';
import { deduplicationActor } from '@/actors/DeduplicationActor';
import { websiteDiscoveryActor } from '@/actors/WebsiteDiscoveryActor';
import { websiteReachabilityActor } from '@/actors/WebsiteReachabilityActor';
import { websiteCrawlerActor } from '@/actors/WebsiteCrawlerActor';
import { contactExtractionActor } from '@/actors/ContactExtractionActor';
import { websiteAuditActor } from '@/actors/WebsiteAuditActor';
import { leadQualificationActor } from '@/actors/LeadQualificationActor';
import { leadScoringActor } from '@/actors/LeadScoringActor';
import { dataNormalizationActor } from '@/actors/DataNormalizationActor';

export class LeadPilotOrchestrator {
  /**
   * Creates a new Job record in PENDING status.
   */
  public createJob(criteria: SearchRequestPayload): Job {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const initialRejections: RejectionBreakdown = {
      OUTSIDE_LOCATION: 0,
      INVALID_CATEGORY: 0,
      MISSING_NAME: 0,
      DUPLICATE: 0,
      NO_CONTACT: 0,
      HAS_WEBSITE: 0,
      NO_WEBSITE: 0,
      WEBSITE_UNREACHABLE: 0,
      AUDIT_FAILED: 0,
      NOT_QUALIFIED: 0,
      OTHER: 0,
    };

    const job: Job = {
      id: jobId,
      searchId: jobId,
      status: 'PENDING',
      criteria,
      requestedLeads: Math.max(Number(criteria.limit) || 25, 5),
      discovered: 0,
      verified: 0,
      deduplicated: 0,
      enriched: 0,
      audited: 0,
      qualified: 0,
      completed: 0,
      failed: 0,
      sourceStatus: 'COMPLETE',
      sourceComplete: true,
      rejectionReasons: initialRejections,
      progressLog: [
        {
          actorId: 'orchestrator',
          stepName: 'Job Initialized',
          message: `Job ${jobId} initialized for ${criteria.industry} in ${criteria.city || criteria.state}`,
          status: 'pending',
          timestamp: now,
        },
      ],
      leads: [],
      startedAt: now,
    };

    return leadPilotDb.createJob(job);
  }

  /**
   * Records a progress update in the job log.
   */
  private logProgress(job: Job, actorId: string, stepName: string, message: string, count?: number) {
    const step: ProgressStep = {
      actorId,
      stepName,
      message,
      count,
      status: 'in_progress',
      timestamp: new Date().toISOString(),
    };
    job.progressLog.push(step);
    leadPilotDb.updateJob(job.id, { progressLog: [...job.progressLog] });
    logger.info({ jobId: job.id, actorId, message, extra: { count } });
  }

  /**
   * Helper to execute an actor with full tracking in the ActorRuns table.
   */
  private async executeTrackedActor<TInput, TOutput>(
    actor: {
      readonly actorId: string;
      readonly name: string;
      execute: (context: any) => Promise<{ status: any; data: TOutput; metrics?: any; errors?: any; warnings?: any }>;
    },
    job: Job,
    input: TInput,
    stepName: string
  ): Promise<TOutput> {
    const runId = `run_${actor.actorId}_${Date.now()}`;
    const startTime = new Date().toISOString();

    leadPilotDb.createActorRun({
      id: runId,
      jobId: job.id,
      actorId: actor.actorId,
      status: 'RUNNING',
      startedAt: startTime,
      attempts: 1,
      metrics: {},
      errors: [],
      warnings: [],
    });

    const result = await actor.execute({
      jobId: job.id,
      input,
      onProgress: (msg: string, count?: number) => this.logProgress(job, actor.actorId, stepName, msg, count),
    });

    leadPilotDb.updateActorRun(runId, {
      status: result.status,
      completedAt: new Date().toISOString(),
      metrics: result.metrics,
      errors: result.errors,
      warnings: result.warnings,
    });

    if (result.status === 'FAILED') {
      throw new Error(`Actor ${actor.name} failed: ${result.errors.join('; ')}`);
    }

    return result.data;
  }

  /**
   * Main Pipeline Execution
   */
  public async executeJob(jobId: string): Promise<Job> {
    const job = leadPilotDb.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
      job.status = 'RUNNING';
      leadPilotDb.updateJob(job.id, { status: 'RUNNING' });

      const criteria = job.criteria;

      // 0. Location Pre-validation
      const validation = validateStateAndCity(criteria.state, criteria.city);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid State or City specification.');
      }

      const verifiedState = validation.matchedState || criteria.state;
      const verifiedCity = validation.matchedCity || criteria.city;
      const bbox = await resolveIndiaLocation(verifiedState, verifiedCity);

      // --- STAGE 1: Business Discovery (Parallel Multi-Source) ---
      const discoveryOutput = await this.executeTrackedActor(
        businessDiscoveryActor,
        job,
        {
          industry: criteria.industry,
          state: verifiedState,
          city: verifiedCity,
          limit: job.requestedLeads,
          bbox,
        },
        'Discovering businesses across OSM, Web, and Directories...'
      );

      job.discovered = discoveryOutput.rawCount;
      job.sourceComplete = discoveryOutput.sourceComplete;
      job.statusReason = discoveryOutput.statusReason;
      job.providerStats = discoveryOutput.providerStats;

      job.providersReport = {
        osm: {
          status: discoveryOutput.providerStats.osm.status,
          discovered: discoveryOutput.providerStats.osm.rawCount,
          errors: discoveryOutput.providerStats.osm.errors || [],
        },
        webSearch: {
          status: discoveryOutput.providerStats.webSearch?.status || discoveryOutput.providerStats.web.status,
          discovered: discoveryOutput.providerStats.webSearch?.rawCount ?? discoveryOutput.providerStats.web.rawCount,
          errors: discoveryOutput.providerStats.webSearch?.errors || discoveryOutput.providerStats.web.errors || [],
        },
        businessProvider: {
          status: discoveryOutput.providerStats.businessProvider?.status || 'DISABLED',
          discovered: discoveryOutput.providerStats.businessProvider?.rawCount || 0,
          errors: discoveryOutput.providerStats.businessProvider?.errors || [],
        },
      };

      if (!discoveryOutput.sourceComplete) {
        job.sourceStatus = 'PARTIAL';
      }

      if (discoveryOutput.businesses.length === 0) {
        job.status = 'COMPLETED';
        job.sourceStatus = 'NO_RESULTS';
        job.completedAt = new Date().toISOString();
        leadPilotDb.updateJob(job.id, job);
        return job;
      }

      // --- STAGE 1.5: Multi-Source Merge & Cross-Deduplication ---
      const mergeOutput = await this.executeTrackedActor(
        multiSourceMergeActor,
        job,
        discoveryOutput.businesses,
        'Merging and cross-deduplicating multi-source candidates...'
      );

      job.deduplicated = mergeOutput.merged.length;
      job.rejectionReasons.DUPLICATE += mergeOutput.deduplicatedCount;

      // --- STAGE 2: Location Verification ---
      const locationOutput = await this.executeTrackedActor(
        locationVerificationActor,
        job,
        {
          businesses: mergeOutput.merged,
          state: verifiedState,
          city: verifiedCity,
        },
        'Verifying locations...'
      );

      job.rejectionReasons.OUTSIDE_LOCATION += locationOutput.rejected.length;

      // --- STAGE 3: Business Verification ---
      const businessVerificationOutput = await this.executeTrackedActor(
        businessVerificationActor,
        job,
        locationOutput.verified,
        'Verifying business identity...'
      );

      for (const rej of businessVerificationOutput.rejected) {
        if (rej.reason === 'MISSING_NAME') job.rejectionReasons.MISSING_NAME++;
        if (rej.reason === 'INVALID_CATEGORY') job.rejectionReasons.INVALID_CATEGORY++;
      }

      // --- STAGE 4: Deduplication ---
      const deduplicationOutput = await this.executeTrackedActor(
        deduplicationActor,
        job,
        businessVerificationOutput.verified,
        'Removing duplicates...'
      );

      job.deduplicated = deduplicationOutput.unique.length;
      job.rejectionReasons.DUPLICATE += deduplicationOutput.duplicatesCount;

      // --- STAGE 5: Website Discovery ---
      const websiteDiscoveryOutput = await this.executeTrackedActor(
        websiteDiscoveryActor,
        job,
        deduplicationOutput.unique,
        'Finding websites...'
      );

      // --- STAGE 6: Website Reachability ---
      const reachabilityOutput = await this.executeTrackedActor(
        websiteReachabilityActor,
        job,
        websiteDiscoveryOutput,
        'Testing website reachability...'
      );

      // --- STAGE 7: Website Crawler (Deep crawl & cache) ---
      const crawlerOutput = await this.executeTrackedActor(
        websiteCrawlerActor,
        job,
        reachabilityOutput,
        'Crawling websites...'
      );

      // --- STAGE 8: Contact Extraction (Source + Crawled pages) ---
      const contactOutput = await this.executeTrackedActor(
        contactExtractionActor,
        job,
        crawlerOutput,
        'Extracting contacts...'
      );

      job.enriched = (contactOutput as any[]).filter((c: any) => Boolean(c.phone || c.email)).length;

      // --- STAGE 9: Website Audit (SEO, UX, Tech, Perf) ---
      const auditOutput = await this.executeTrackedActor(
        websiteAuditActor,
        job,
        contactOutput,
        'Auditing websites...'
      );

      job.audited = (auditOutput as any[]).filter((a: any) => Boolean(a.auditResult)).length;

      // --- STAGE 10: Lead Qualification (Search criteria filters applied AFTER discovery/enrichment) ---
      const qualificationOutput = await this.executeTrackedActor(
        leadQualificationActor,
        job,
        {
          businesses: auditOutput,
          contactFilter: criteria.contactFilter,
          websiteFilter: criteria.websiteFilter,
        },
        'Finding qualified leads...'
      );

      for (const rej of qualificationOutput.rejected) {
        if (rej.reason === 'NO_CONTACT') job.rejectionReasons.NO_CONTACT++;
        else if (rej.reason === 'HAS_WEBSITE') job.rejectionReasons.HAS_WEBSITE++;
        else if (rej.reason === 'NO_WEBSITE') job.rejectionReasons.NO_WEBSITE++;
        else if (rej.reason === 'WEBSITE_UNREACHABLE') job.rejectionReasons.WEBSITE_UNREACHABLE++;
        else if (rej.reason === 'AUDIT_FAILED') job.rejectionReasons.AUDIT_FAILED++;
        else if (rej.reason === 'NOT_QUALIFIED') job.rejectionReasons.NOT_QUALIFIED++;
        else job.rejectionReasons.OTHER++;
      }

      job.qualified = qualificationOutput.qualified.length;

      // Compute complete pipeline breakdown metrics requested by user
      const phoneCount = (contactOutput as any[]).filter(c => Boolean(c.phone && c.phone.trim().length > 0)).length;
      const emailCount = (contactOutput as any[]).filter(c => Boolean(c.email && c.email.trim().length > 0)).length;
      const phoneOrEmailCount = (contactOutput as any[]).filter(c => Boolean((c.phone && c.phone.trim().length > 0) || (c.email && c.email.trim().length > 0))).length;
      const websiteAvailableCount = (contactOutput as any[]).filter(c => Boolean(c.websiteUrl) && (c.reachability?.status === 'LIVE' || c.reachability?.status === 'REDIRECTED' || c.reachability?.status === 'FOUND')).length;
      const websiteUnavailableCount = (contactOutput as any[]).filter(c => !c.websiteUrl || c.reachability?.status === 'NOT_FOUND').length;
      const websiteUnreachableCount = (contactOutput as any[]).filter(c => Boolean(c.websiteUrl) && (c.reachability?.status === 'UNREACHABLE' || c.reachability?.status === 'DNS_ERROR' || c.reachability?.status === 'SSL_ERROR' || c.reachability?.status === 'TIMEOUT')).length;

      job.pipelineBreakdown = {
        rawDiscoveredCount: job.discovered,
        normalizedCount: deduplicationOutput.unique.length + deduplicationOutput.duplicatesCount,
        locationVerifiedCount: locationOutput.verified.length,
        deduplicatedCount: deduplicationOutput.unique.length,
        phoneCount,
        emailCount,
        phoneOrEmailCount,
        websiteAvailableCount,
        websiteUnavailableCount,
        websiteUnreachableCount,
        finalQualifiedCount: qualificationOutput.qualified.length,
      };

      // Assemble rejected candidates with individual provenance and reasons
      job.rejectedCandidates = [
        ...locationOutput.rejected.map(r => ({
          name: r.business.businessName,
          category: r.business.category,
          city: r.business.city,
          state: r.business.state,
          rejectionReason: 'OUTSIDE_LOCATION' as const,
          rejectionDetails: 'Candidate is outside the specified geographic boundary.',
        })),
        ...businessVerificationOutput.rejected.map(r => ({
          name: r.business.businessName,
          category: r.business.category,
          city: r.business.city,
          state: r.business.state,
          rejectionReason: (r.reason || 'MISSING_NAME') as any,
          rejectionDetails: 'Candidate failed identity or name verification.',
        })),
        ...qualificationOutput.rejected.map(r => {
          let details = '';
          if (r.reason === 'NO_CONTACT') {
            details = 'Candidate has no verified phone or email contacts.';
          } else if (r.reason === 'HAS_WEBSITE') {
            details = `Filter required "No Website", but candidate has verified active website (${r.business.websiteUrl || 'Found'}).`;
          } else if (r.reason === 'NO_WEBSITE') {
            details = 'Filter required "Website Available", but candidate has no verified website.';
          } else if (r.reason === 'WEBSITE_UNREACHABLE') {
            details = 'Candidate website failed DNS resolution or reachability checks.';
          }
          return {
            name: r.business.businessName,
            category: r.business.category,
            city: r.business.city,
            state: r.business.state,
            phone: r.business.phone,
            email: r.business.email,
            websiteUrl: r.business.websiteUrl,
            websiteStatus: r.business.reachability?.status || (r.business.websiteUrl ? 'FOUND' : 'NOT_FOUND'),
            rejectionReason: (r.reason || 'OTHER') as any,
            rejectionDetails: details,
          };
        }),
      ];

      // --- STAGE 11: Lead Scoring ---
      const scoringOutput = await this.executeTrackedActor(
        leadScoringActor,
        job,
        qualificationOutput.qualified,
        'Scoring commercial opportunities...'
      );

      // --- STAGE 12: Data Normalization & Final Entity Compilation ---
      const normalizedEntities = await this.executeTrackedActor<any, LeadEntity[]>(
        dataNormalizationActor,
        job,
        scoringOutput,
        'Compiling final leads...'
      );

      // Respect user's maximum requested limit
      const finalLeads = normalizedEntities.slice(0, job.requestedLeads);
      job.leads = finalLeads;
      job.completed = finalLeads.length;
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();

      // Populate complete debug counters requested by user specification
      const enrichedCount = (contactOutput as any[]).filter(
        c => c.wasEnriched || (c.contacts && c.contacts.some((item: any) => item.source === 'web_search' || item.source === 'official_website'))
      ).length;

      job.mergedCount = mergeOutput.merged.length;
      job.normalizedCount = deduplicationOutput.unique.length + deduplicationOutput.duplicatesCount;
      job.locationVerifiedCount = locationOutput.verified.length;
      job.deduplicatedCount = deduplicationOutput.unique.length;
      job.phoneCount = phoneCount;
      job.emailCount = emailCount;
      job.phoneOrEmailCount = phoneOrEmailCount;
      job.websiteDiscoveredCount = (websiteDiscoveryOutput as any[]).filter(w => Boolean(w.websiteUrl)).length;
      job.websiteVerifiedCount = websiteAvailableCount;
      job.noWebsiteCount = websiteUnavailableCount;
      job.enrichedCount = enrichedCount;
      job.finalCount = finalLeads.length;

      // Determine final searchStatus
      if (finalLeads.length === 0) {
        job.sourceStatus = 'NO_RESULTS';
        job.statusReason = `No businesses matching criteria found in ${verifiedCity || verifiedState}.`;
      } else if (!job.sourceComplete) {
        job.sourceStatus = 'PARTIAL';
      } else {
        job.sourceStatus = 'COMPLETE';
        job.statusReason =
          finalLeads.length < job.requestedLeads
            ? `Retrieved all ${finalLeads.length} matching venues available across discovery sources for ${verifiedCity || verifiedState}.`
            : `Successfully delivered target limit of ${finalLeads.length} verified leads.`;
      }

      // Persist leads to Database
      leadPilotDb.upsertLeadsBatch(finalLeads);
      leadPilotDb.updateJob(job.id, job);

      this.logProgress(
        job,
        'orchestrator',
        'Pipeline Complete',
        `Delivered ${finalLeads.length} verified qualified leads (${job.sourceStatus})`,
        finalLeads.length
      );

      return job;
    } catch (err: any) {
      job.status = 'FAILED';
      job.sourceStatus = 'FAILED';
      job.error = err.message || 'Pipeline execution failed';
      job.completedAt = new Date().toISOString();
      leadPilotDb.updateJob(job.id, job);
      logger.error({ jobId: job.id, message: 'Orchestrator Job Failed', error: err });
      return job;
    }
  }

  /**
   * Resumes a previously failed or partial job.
   */
  public async resumeJob(jobId: string): Promise<Job> {
    const job = leadPilotDb.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    return this.executeJob(jobId);
  }
}

export const orchestrator = new LeadPilotOrchestrator();
