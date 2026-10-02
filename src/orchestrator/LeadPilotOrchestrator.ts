import { SearchRequestPayload } from '@/types';
import { Job, ProgressStep, RejectionBreakdown, PipelineBreakdown } from '@/models/Job';
import { LeadEntity, ContactItem, leadEntityToFrontend } from '@/models/Lead';
import { leadPilotDb } from '@/db';
import { leadsDb } from '@/lib/leadsDb';
import { logger } from '@/utils/logger';
import { validateStateAndCity } from '@/data/indiaLocations';
import { resolveIndiaLocation } from '@/lib/geoResolver';
import { searchPlanner } from '@/lib/search/SearchPlanner';
import { performanceTracker, SearchTimestamps } from '@/lib/metrics/PerformanceTracker';
import { backgroundEnrichmentQueue } from '@/lib/queue/BackgroundEnrichmentQueue';
import { smartRotationService } from '@/lib/workflow/SmartRotationService';
import { leadHistoryService } from '@/lib/workflow/LeadHistoryService';
import {
  normalizeWebsiteFilter,
  checkBatchReachability,
  classifyCandidateWebsite,
  assertHardGuarantee,
} from '@/lib/audit/WebsiteStatusClassifier';

// Blocking Fast Path Actors
import { businessDiscoveryActor } from '@/actors/BusinessDiscoveryActor';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { locationVerificationActor } from '@/actors/LocationVerificationActor';
import { businessVerificationActor } from '@/actors/BusinessVerificationActor';
import { deduplicationActor } from '@/actors/DeduplicationActor';

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
      WEBSITE_FILTER_MISMATCH: 0,
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
   * Helper to execute a fast blocking actor with full tracking in the ActorRuns table.
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
   * Main Pipeline Execution: FAST PATH + ASYNC BACKGROUND ENRICHMENT
   * Bounded by global search deadline (default LEAD_SEARCH_DEADLINE_MS = 8000ms, Section 13).
   */
  public async executeJob(jobId: string): Promise<Job> {
    const deadlineMs = Number(process.env.LEAD_SEARCH_DEADLINE_MS) || 25000;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const deadlinePromise = new Promise<{ deadlineReached: true }>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ deadlineReached: true }), deadlineMs);
    });

    try {
      const result = await Promise.race([
        this.runPipeline(jobId, deadlineMs),
        deadlinePromise,
      ]);

      if (timeoutHandle) clearTimeout(timeoutHandle);

      if ('deadlineReached' in result) {
        // Global search deadline reached: Return whatever verified results are ready (Section 13)
        const job = leadPilotDb.getJob(jobId);
        if (job) {
          job.sourceStatus = 'PARTIAL';
          job.statusReason = 'SEARCH_DEADLINE_REACHED';
          job.status = (job.leads && job.leads.length > 0) ? 'DISCOVERY_COMPLETE' : 'COMPLETED';
          job.completedAt = new Date().toISOString();
          leadPilotDb.updateJob(job.id, job);
          return job;
        }
      }

      return result as Job;
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const job = leadPilotDb.getJob(jobId);
      if (job) {
        job.status = 'FAILED';
        job.sourceStatus = 'FAILED';
        job.error = err.message || 'Pipeline execution failed';
        job.completedAt = new Date().toISOString();
        leadPilotDb.updateJob(job.id, job);
        return job;
      }
      throw err;
    }
  }

  private async runPipeline(jobId: string, deadlineMs: number): Promise<Job> {
    const job = leadPilotDb.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const timestamps: SearchTimestamps = {
      searchStart: Date.now(),
    };

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

      // Check persistent storage for previously discovered businesses (Section 12 & 26)
      const existingLeads = leadPilotDb.findLeadsByLocationAndIndustry({
        state: verifiedState,
        city: verifiedCity,
        industry: criteria.industry,
      });

      const cachedCandidates = existingLeads.map((l) => ({
        source: (l.sources && l.sources[0]) || 'stored',
        sources: l.sources || ['stored'],
        sourceId: l.googlePlaceId || l.osmId || l.leadId,
        name: l.businessName,
        businessName: l.businessName,
        category: l.category,
        industry: l.industry || criteria.industry,
        address: l.address,
        city: l.city,
        state: l.state,
        phone: l.phone,
        email: l.email,
        website: l.website,
        latitude: l.latitude,
        longitude: l.longitude,
        rawTags: {},
      }));

      // --- STAGE 1: Fast Business Discovery (Google Places Primary + Multi-Provider Fallback) ---
      const targetDiscoveryPool = Math.max(job.requestedLeads * 3, 100);
      timestamps.googleStart = Date.now();
      const discoveryOutput = await this.executeTrackedActor(
        businessDiscoveryActor,
        job,
        {
          industry: criteria.industry,
          state: verifiedState,
          city: verifiedCity,
          country: criteria.country || 'India',
          limit: targetDiscoveryPool,
          bbox,
        },
        'Discovering businesses (Google Places Primary + Multi-Provider Fallback)...'
      );
      timestamps.googleEnd = Date.now();

      job.discovered = discoveryOutput.rawCount + cachedCandidates.length;
      job.sourceComplete = discoveryOutput.sourceComplete || cachedCandidates.length > 0;
      job.statusReason = discoveryOutput.statusReason;
      job.providerStats = discoveryOutput.providerStats as any;

      const gStats = discoveryOutput.providerStats.googlePlaces;
      const oStats = discoveryOutput.providerStats.osm;
      const wStats = discoveryOutput.providerStats.webSearch;
      const dStats = discoveryOutput.providerStats.directory;

      job.providersReport = {
        googlePlaces: {
          status: gStats?.status || 'DISABLED',
          discovered: gStats?.rawCount || 0,
          pagesRequested: gStats?.pagesRequested || (gStats && gStats.rawCount > 0 ? 1 : 0),
          errors: gStats?.errors || [],
        },
        osm: {
          status: oStats?.status || 'NO_RESULTS',
          discovered: oStats?.rawCount || 0,
          errors: oStats?.errors || [],
        },
        webSearch: {
          status: wStats?.status || 'NOT_NEEDED',
          discovered: wStats?.rawCount || 0,
          errors: wStats?.errors || [],
        },
        directory: {
          status: dStats?.status || 'NOT_NEEDED',
          discovered: dStats?.rawCount || 0,
          errors: dStats?.errors || [],
        },
      } as any;

      job.sourceStatus = (discoveryOutput.sourceStatus as any) || (discoveryOutput.sourceComplete || cachedCandidates.length > 0 ? 'COMPLETE' : 'PARTIAL');

      const allCandidates = [...discoveryOutput.businesses, ...cachedCandidates];

      if (allCandidates.length === 0) {
        const effStatus = discoveryOutput.sourceStatus || 'NO_RESULTS';
        job.sourceStatus = effStatus as any;
        job.status = effStatus === 'NO_RESULTS' ? 'COMPLETED' : 'FAILED';
        job.statusReason = discoveryOutput.statusReason || 'No businesses found.';
        job.completedAt = new Date().toISOString();
        leadPilotDb.updateJob(job.id, job);
        return job;
      }

      // --- STAGE 1.5: Multi-Source Merge & Cross-Deduplication ---
      timestamps.mergeStart = Date.now();
      const mergeOutput = await this.executeTrackedActor(
        multiSourceMergeActor,
        job,
        allCandidates,
        'Merging and cross-deduplicating multi-source candidates...'
      );
      timestamps.mergeEnd = Date.now();

      job.mergedCount = mergeOutput.merged.length;
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
        'Verifying municipal boundaries...'
      );

      job.locationVerifiedCount = locationOutput.verified.length;
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
      job.deduplicatedCount = deduplicationOutput.unique.length;
      job.rejectionReasons.DUPLICATE += deduplicationOutput.duplicatesCount;

      // --- STAGE 5: Real Website Reachability & Contact Qualification ---
      const userWebsiteFilter = normalizeWebsiteFilter(criteria.websiteFilter);
      const normContact = (criteria.contactFilter || 'All Contacts').toUpperCase().replace(/[\s_-]+/g, '_');

      const plan = searchPlanner.planSearch({
        industry: criteria.industry,
        state: verifiedState,
        city: verifiedCity,
        contactFilter: criteria.contactFilter,
        websiteFilter: criteria.websiteFilter,
        limit: job.requestedLeads,
        isGoogleConfigured: true,
        isGoogleCircuitOpen: false,
        isGoogleBudgetAllowed: true,
      });

      const fastCandidates = deduplicationOutput.unique;

      this.logProgress(
        job,
        'reachability',
        'Testing Website Reachability',
        `Testing reachability and canonical status for ${fastCandidates.length} discovered candidates (Filter: ${userWebsiteFilter})...`
      );

      // Collect candidate website URLs and test reachability concurrently
      const candidateUrls = fastCandidates.map((b) => b.website).filter(Boolean);
      const reachabilityMap = await checkBatchReachability(candidateUrls);

      const qualifiedEntities: LeadEntity[] = [];
      const rejectedCandidatesList: any[] = [];
      let backgroundJobsQueued = 0;

      for (const b of fastCandidates) {
        // 1. Evaluate Website Reachability & Filter
        const reachCheck = b.website ? reachabilityMap.get(b.website) : undefined;
        const webClass = classifyCandidateWebsite(b.website, userWebsiteFilter, reachCheck);

        if (!webClass.matchesFilter) {
          rejectedCandidatesList.push({
            name: b.businessName,
            category: b.category,
            city: b.city,
            state: b.state,
            phone: b.phone,
            email: b.email,
            websiteUrl: b.website,
            websiteStatus: webClass.status,
            rejectionReason: (webClass.rejectionReason as any) || 'WEBSITE_FILTER_MISMATCH',
            rejectionDetails: webClass.rejectionDetails || `Failed website filter: ${userWebsiteFilter}`,
          });

          if (webClass.rejectionReason === 'HAS_WEBSITE') job.rejectionReasons.HAS_WEBSITE++;
          else if (webClass.rejectionReason === 'NO_WEBSITE') job.rejectionReasons.NO_WEBSITE++;
          else if (webClass.rejectionReason === 'WEBSITE_UNREACHABLE') job.rejectionReasons.WEBSITE_UNREACHABLE++;
          else if (webClass.rejectionReason === 'WEBSITE_WORKING') job.rejectionReasons.OTHER++;
          else if (webClass.rejectionReason === 'NO_IMPROVEMENT_OPPORTUNITY') job.rejectionReasons.AUDIT_FAILED++;
          else job.rejectionReasons.OTHER++;

          continue;
        }

        // 2. Evaluate Contact Filter
        const hasPhone = Boolean(b.phone && b.phone.trim().length > 0);
        const hasEmail = Boolean(b.email && b.email.trim().length > 0);
        let matchesContact = true;
        let contactRejectionReason = 'NO_CONTACT';

        if (normContact === 'ALL_CONTACTS' || normContact === 'ANY_CONTACT') {
          matchesContact = true;
        } else if (normContact === 'PHONE_ONLY') {
          matchesContact = hasPhone;
          contactRejectionReason = 'NO_PHONE';
        } else if (normContact === 'EMAIL_ONLY') {
          matchesContact = hasEmail;
          contactRejectionReason = 'NO_EMAIL';
        } else if (normContact === 'EMAIL_AND_PHONE' || normContact === 'EMAIL_+_PHONE') {
          matchesContact = hasPhone && hasEmail;
          contactRejectionReason = 'EMAIL_OR_PHONE_MISSING';
        } else if (normContact === 'PHONE_OR_EMAIL' || normContact === 'HAS_PHONE_OR_EMAIL') {
          matchesContact = hasPhone || hasEmail;
          contactRejectionReason = 'NO_CONTACT';
        } else if (normContact === 'NO_CONTACT') {
          matchesContact = !hasPhone && !hasEmail;
          contactRejectionReason = 'HAS_CONTACT';
        }

        if (!matchesContact) {
          rejectedCandidatesList.push({
            name: b.businessName,
            category: b.category,
            city: b.city,
            state: b.state,
            phone: b.phone,
            email: b.email,
            websiteUrl: b.website,
            websiteStatus: webClass.status,
            rejectionReason: contactRejectionReason as any,
            rejectionDetails: `Failed contact filter: ${criteria.contactFilter}`,
          });
          job.rejectionReasons.NO_CONTACT++;
          continue;
        }

        // 3. Assemble Qualified Lead Entity with Verified Provenance
        const leadId = `lead_${b.sourceId ? b.sourceId.replace(/[^a-zA-Z0-9_-]/g, '_') : Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        const contacts: ContactItem[] = [];
        if (b.phone) {
          contacts.push({
            value: b.phone,
            type: 'phone',
            source: b.source || 'google_places',
            sourceType: b.source || 'google_places',
            confidence: 'verified',
            verified: true,
          });
        }
        if (b.email) {
          contacts.push({
            value: b.email,
            type: 'email',
            source: b.source || 'openstreetmap',
            sourceType: b.source || 'openstreetmap',
            confidence: 'verified',
            verified: true,
          });
        }

        const resolvedSources = b.sources && b.sources.length > 0 ? b.sources : [b.source || 'google_places'];
        const resolvedEvidence =
          b.sourceEvidence && b.sourceEvidence.length > 0
            ? b.sourceEvidence.map((ev: any) => ({
                sourceName: ev.source || ev.sourceName || 'google_places',
                sourceId: ev.sourceId,
                rawTags: ev.rawTags,
                observedAt: new Date().toISOString(),
              }))
            : [
                {
                  sourceName: b.source || 'google_places',
                  sourceId: b.sourceId,
                  rawTags: b.rawTags,
                  observedAt: new Date().toISOString(),
                },
              ];

        const googlePlaceId =
          b.rawTags?.googlePlaceId ||
          (b.source === 'google_places' ? b.sourceId : undefined) ||
          b.sourceEvidence?.find((e: any) => e.source === 'google_places' || e.sourceName === 'google_places')?.sourceId;

        const osmId =
          b.rawTags?.osmId
            ? String(b.rawTags.osmId)
            : (b.source === 'osm' || b.source === 'openstreetmap' ? b.sourceId : undefined) ||
              b.sourceEvidence?.find((e: any) => e.source === 'osm' || e.source === 'openstreetmap' || e.sourceName === 'openstreetmap')?.sourceId;

        const entity: LeadEntity = {
          leadId,
          businessName: b.businessName,
          category: b.category,
          industry: criteria.industry,
          address: b.address || '',
          city: b.city || verifiedCity || '',
          state: b.state || verifiedState,
          country: (b as any).country || criteria.country || 'India',
          postcode: b.postalCode || b.postcode,
          latitude: b.latitude,
          longitude: b.longitude,
          phone: b.phone,
          email: b.email,
          website: webClass.url,
          websiteStatus: webClass.status,
          https: reachCheck?.isHttps ?? (webClass.url?.startsWith('https') || false),
          socialLinks: {},
          contacts,
          businessVerificationStatus: 'VERIFIED',
          locationVerificationStatus: 'VERIFIED',
          auditIssues: webClass.detectedIssues.map((issue) => ({ issue, category: 'technical' as const, severity: 'medium' as const, evidence: issue })),
          scoreBreakdown: [],
          leadScore: b.phone && webClass.status === 'Working' ? 85 : b.phone ? 70 : 50,
          sources: resolvedSources,
          sourceEvidence: resolvedEvidence,
          enrichmentStatus: 'QUALIFIED',
          auditStatus: webClass.hasEvidenceBackedImprovement ? 'AUDITED' : 'PENDING',
          googlePlaceId,
          osmId,
          provenance: {
            phone: { value: b.phone, source: resolvedSources.join(', '), verified: Boolean(b.phone) },
            website: { value: webClass.url, source: resolvedSources.join(', '), verified: Boolean(webClass.url) },
            email: {
              value: b.email,
              source: b.email
                ? (resolvedSources.find((s: string) => s === 'openstreetmap' || s === 'osm') || 'web_search')
                : 'none',
              verified: Boolean(b.email),
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        qualifiedEntities.push(entity);
      }

      // --- STAGE 5.5: Smart Rotation & Lead History Prioritization ---
      const fingerprintKey = leadHistoryService.generateFingerprintKey({
        country: criteria.country,
        state: verifiedState,
        city: verifiedCity,
        industry: criteria.industry,
        contactFilter: criteria.contactFilter,
        websiteFilter: criteria.websiteFilter,
      });

      const rotationResult = await smartRotationService.rotateCandidates(
        job.id,
        qualifiedEntities,
        job.requestedLeads,
        fingerprintKey,
        {
          country: criteria.country,
          state: verifiedState,
          city: verifiedCity,
          industry: criteria.industry,
          contactFilter: criteria.contactFilter,
          websiteFilter: criteria.websiteFilter,
        }
      );

      // --- STAGE 5.6: Hard Guarantee Assertion ---
      const { validLeads: strictlyGuaranteedEntities, violationsCount } = assertHardGuarantee(
        rotationResult.orderedLeads,
        userWebsiteFilter
      );

      if (violationsCount > 0) {
        job.rejectionReasons.WEBSITE_FILTER_MISMATCH =
          (job.rejectionReasons.WEBSITE_FILTER_MISMATCH || 0) + violationsCount;
      }

      const initialEntities = strictlyGuaranteedEntities;
      job.rotationStats = rotationResult.stats;

      // Queue Background Enrichment for Delivered Leads
      for (const entity of initialEntities) {
        if (plan.plannedFilters.enrichmentFilters.requireEmailExtraction && !entity.email && entity.website) {
          backgroundEnrichmentQueue.enqueue({
            leadId: entity.leadId,
            searchId: job.id,
            type: 'EMAIL_EXTRACTION',
            priority: 'HIGH',
            provider: 'crawler',
          });
          backgroundJobsQueued++;
        }

        if (plan.plannedFilters.enrichmentFilters.requireReachabilityCheck && entity.website) {
          backgroundEnrichmentQueue.enqueue({
            leadId: entity.leadId,
            searchId: job.id,
            type: 'WEBSITE_REACHABILITY',
            priority: 'MEDIUM',
            provider: 'http_reachability',
          });
          backgroundJobsQueued++;
        }

        if (!entity.website && plan.plannedFilters.enrichmentFilters.requireWebsiteDiscovery) {
          backgroundEnrichmentQueue.enqueue({
            leadId: entity.leadId,
            searchId: job.id,
            type: 'WEBSITE_DISCOVERY',
            priority: 'LOW',
            provider: 'web_search',
          });
          backgroundJobsQueued++;
        }

        if (plan.plannedFilters.deepAuditFilters.requireSeoAudit && entity.website) {
          backgroundEnrichmentQueue.enqueue({
            leadId: entity.leadId,
            searchId: job.id,
            type: 'WEBSITE_AUDIT',
            priority: 'LOW',
            provider: 'lighthouse',
          });
          backgroundJobsQueued++;
        }
      }

      // Fast response assembly with truthful metrics
      const phoneCount = initialEntities.filter((l) => Boolean(l.phone)).length;
      const emailCount = initialEntities.filter((l) => Boolean(l.email)).length;
      const phoneOrEmailCount = initialEntities.filter((l) => Boolean(l.phone || l.email)).length;
      const workingWebsiteCount = initialEntities.filter((l) => l.websiteStatus === 'Working').length;
      const needsImprovementCount = initialEntities.filter((l) => l.websiteStatus === 'Needs Improvement').length;
      const unreachableCount = initialEntities.filter((l) => l.websiteStatus === 'Unreachable').length;
      const noWebsiteCount = initialEntities.filter((l) => l.websiteStatus === 'No Website' || !l.website).length;
      const websiteAvailableCount = workingWebsiteCount + needsImprovementCount;

      job.leads = initialEntities;
      job.verified = initialEntities.length;
      job.completed = initialEntities.length;
      job.qualified = initialEntities.length;
      job.phoneCount = phoneCount;
      job.emailCount = emailCount;
      job.phoneOrEmailCount = phoneOrEmailCount;
      job.websiteVerifiedCount = websiteAvailableCount;
      job.noWebsiteCount = noWebsiteCount;
      job.backgroundJobsQueued = backgroundJobsQueued;

      job.pipelineBreakdown = {
        rawDiscoveredCount: job.discovered,
        normalizedCount: deduplicationOutput.unique.length + deduplicationOutput.duplicatesCount,
        locationVerifiedCount: locationOutput.verified.length,
        deduplicatedCount: deduplicationOutput.unique.length,
        phoneCount,
        emailCount,
        phoneOrEmailCount,
        websiteAvailableCount,
        websiteUnavailableCount: noWebsiteCount,
        websiteUnreachableCount: unreachableCount,
        finalQualifiedCount: initialEntities.length,
      };

      job.rejectedCandidates = [
        ...locationOutput.rejected.map((r) => ({
          name: r.business.businessName,
          category: r.business.category,
          city: r.business.city,
          state: r.business.state,
          rejectionReason: 'OUTSIDE_LOCATION' as const,
          rejectionDetails: 'Candidate is outside the specified geographic boundary.',
        })),
        ...businessVerificationOutput.rejected.map((r) => ({
          name: r.business.businessName,
          category: r.business.category,
          city: r.business.city,
          state: r.business.state,
          rejectionReason: (r.reason || 'MISSING_NAME') as any,
          rejectionDetails: 'Candidate failed identity or name verification.',
        })),
        ...rejectedCandidatesList,
      ];

      // Section 10 & 11: Truthful status semantics
      if (initialEntities.length >= job.requestedLeads) {
        job.sourceStatus = 'COMPLETE';
        job.statusReason = `Discovered and qualified ${initialEntities.length} verified leads satisfying all criteria.`;
      } else if (initialEntities.length > 0) {
        job.sourceStatus = 'PARTIAL';
        job.statusReason = `Delivered ${initialEntities.length} of ${job.requestedLeads} qualified leads. All configured discovery sources evaluated.`;
      } else {
        job.sourceStatus = 'NO_RESULTS';
        job.statusReason = `0 leads met the selected criteria.`;
      }

      // Persist delivered leads in LeadPilot database for instant reuse & rotation (Section 12)
      leadPilotDb.upsertLeadsBatch(initialEntities);

      // Mark status as DISCOVERY_COMPLETE immediately!
      job.status = 'DISCOVERY_COMPLETE';
      job.completedAt = new Date().toISOString();

      timestamps.responseSent = Date.now();
      const fastPathLatencyMs = timestamps.responseSent - timestamps.searchStart;
      job.fastPathLatencyMs = fastPathLatencyMs;
      job.latencyMs = fastPathLatencyMs;

      // Record performance measurements
      performanceTracker.recordSearchEnd({
        searchId: job.id,
        query: `${criteria.industry} in ${verifiedCity || verifiedState}`,
        timestamps,
        googleLatencyMs: discoveryOutput.googleLatencyMs || 0,
        osmLatencyMs: discoveryOutput.osmLatencyMs || 0,
        mergeLatencyMs: (timestamps.mergeEnd || 0) - (timestamps.mergeStart || 0),
        fastPathLatencyMs,
        backgroundLatencyMs: 0,
        totalLatencyMs: fastPathLatencyMs,
        cacheHit: Boolean(discoveryOutput.cacheHit),
        providers: {
          google: {
            status: gStats?.status || 'DISABLED',
            discovered: gStats?.rawCount || 0,
          },
          osm: {
            status: oStats?.status || 'NOT_NEEDED',
            discovered: oStats?.rawCount || 0,
          },
        },
      });

      // Persist leads and job to DB (both memory/disk and Prisma SQLite)
      leadPilotDb.upsertLeadsBatch(initialEntities);
      leadPilotDb.updateJob(job.id, job);

      for (const ent of initialEntities) {
        try {
          leadsDb.upsertLead(leadEntityToFrontend(ent));
        } catch {
          // non-blocking
        }
      }

      this.logProgress(
        job,
        'orchestrator',
        'Discovery Complete (Fast Path)',
        `Delivered ${initialEntities.length} candidates in ${fastPathLatencyMs}ms. Queued ${backgroundJobsQueued} background enrichment jobs.`,
        initialEntities.length
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
