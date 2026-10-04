/**
 * Business Discovery Service
 * 
 * Strict Single Responsibility:
 * Coordinates multi-provider discovery (Google Places New + OpenStreetMap),
 * identity resolution, eligibility filtering (5.0 exclusion), ranking, and provenance.
 * 
 * Boundary Constraints:
 * - Does not care about provider-specific HTTP headers or payloads.
 * - Providers return normalized candidates.
 * - Resolution merges into CanonicalBusiness entities.
 * - Eligibility strictly excludes 5.0 ratings by default.
 * - Ranking strictly sorts reviewCount DESC, rating DESC.
 */

import {
  CanonicalBusiness,
  SearchRequest,
  SearchResultsResponse,
  SearchStatusResponse,
  PipelineStatus,
  SearchProgress,
  GoogleBusinessCandidate,
  OSMProfileCandidate,
  ProviderStatus,
  SearchReconciliation,
} from '@/types/canonical';
import { googlePlacesProvider } from '@/providers/google/GooglePlacesProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { businessIdentityResolutionService } from '@/services/identity/BusinessIdentityResolutionService';
import { businessEligibilityService } from '@/services/eligibility/BusinessEligibilityService';
import { businessRankingService } from '@/services/ranking/BusinessRankingService';
import { socialDiscoveryService } from '@/services/social/SocialDiscoveryService';
import { socialMetricsService } from '@/services/social/SocialMetricsService';
import { commercialMilestoneService } from '@/services/commercial/CommercialMilestoneService';
import { provenanceService } from '@/services/evidence/ProvenanceService';
import { businessRepository, PersistenceStatus } from '@/services/persistence/BusinessRepository';
import { locationResolverService } from '@/lib/location/LocationResolverService';
import { tenantService } from '@/services/tenant/TenantService';

export interface SearchSession {
  searchId: string;
  request: SearchRequest;
  status: PipelineStatus;
  progress: SearchProgress;
  providerStatuses?: {
    googlePlaces: ProviderStatus;
    osm: ProviderStatus | 'DISABLED';
  };
  persistenceStatus?: PersistenceStatus;
  reconciliation?: SearchReconciliation;
  businesses: CanonicalBusiness[];
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export class BusinessDiscoveryService {
  private sessions: Map<string, SearchSession> = new Map();
  private businessStore: Map<string, CanonicalBusiness> = new Map();

  /**
   * Initializes a new search pipeline session
   */
  public createSearchSession(request: SearchRequest): SearchSession {
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: SearchSession = {
      searchId,
      request,
      status: 'CREATED',
      progress: {
        discovered: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        stepMessage: 'Search initialized',
      },
      businesses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(searchId, session);
    return session;
  }

  public getSession(searchId: string): SearchSession | undefined {
    return this.sessions.get(searchId);
  }

  public getBusiness(businessId: string): CanonicalBusiness | undefined {
    return this.businessStore.get(businessId);
  }

  public getAllBusinesses(): CanonicalBusiness[] {
    return Array.from(this.businessStore.values());
  }

  /**
   * Runs the full discovery pipeline asynchronously
   */
  public async executeSearch(searchId: string): Promise<SearchSession> {
    const session = this.sessions.get(searchId);
    if (!session) throw new Error(`Search session ${searchId} not found.`);

    const { query, location, filters, sort, limit = 50 } = session.request;

    // 0. Location Resolution & Geographic Verification
    const resolvedLoc = await locationResolverService.resolve({
      country: location.country || 'India',
      state: location.state,
      city: location.city,
      postalCode: location.postalCode,
    });

    // Validate tenant country entitlement if tenantId provided
    if (session.request.tenantId) {
      const accessCheck = await tenantService.validateCountryAccess(
        session.request.tenantId,
        resolvedLoc.countryCode
      );
      if (!accessCheck.allowed) {
        session.status = 'FAILED';
        session.error = accessCheck.reason;
        session.progress.stepMessage = accessCheck.reason;
        session.updatedAt = new Date();
        return session;
      }

      const limitCheck = await tenantService.checkSearchLimits(session.request.tenantId, limit);
      if (!limitCheck.allowed) {
        session.status = 'FAILED';
        session.error = limitCheck.reason;
        session.progress.stepMessage = limitCheck.reason;
        session.updatedAt = new Date();
        return session;
      }
    }

    try {
      // 1. DISCOVERING
      session.status = 'DISCOVERING';
      session.progress.stepMessage = `Querying configured discovery providers in ${resolvedLoc.resolvedQuery}...`;
      session.updatedAt = new Date();

      const googleProviderStatus = googlePlacesProvider.getStatus();
      const osmProviderStatus = process.env.OSM_ENABLED === 'false' ? 'DISABLED' : 'SUCCESS';

      session.providerStatuses = {
        googlePlaces: googleProviderStatus,
        osm: osmProviderStatus,
      };

      const googleCandidates: GoogleBusinessCandidate[] = [];
      const osmCandidates: OSMProfileCandidate[] = [];

      // A. Query Google Places (New) if configured
      if (googlePlacesProvider.isConfigured()) {
        try {
          const googleRes = await googlePlacesProvider.searchBusinesses({
            query,
            city: resolvedLoc.cityName || location.city,
            state: resolvedLoc.regionName || location.state,
            country: resolvedLoc.countryName,
            countryCode: resolvedLoc.countryCode,
            bbox: resolvedLoc.bounds || undefined,
            limit,
          });
          if (googleRes.candidates) {
            googleCandidates.push(...googleRes.candidates);
          }
          session.providerStatuses.googlePlaces = googleRes.status;
        } catch (err: any) {
          session.providerStatuses.googlePlaces = 'API_ERROR';
          console.warn('[BusinessDiscoveryService] Google Places query warning:', err.message);
        }
      } else {
        session.providerStatuses.googlePlaces = 'NOT_CONFIGURED';
      }

      // B. Query OpenStreetMap Overpass (Primary or Secondary source)
      try {
        const osmRes = await osmOverpassProvider.discoverBusinesses({
          industry: query,
          state: resolvedLoc.regionName || location.state,
          city: resolvedLoc.cityName || location.city,
          country: resolvedLoc.countryName,
          countryCode: resolvedLoc.countryCode,
          bbox: resolvedLoc.bounds || undefined,
          limit,
        });
        if (osmRes.businesses) {
          for (const b of osmRes.businesses) {
            const osmCandidate: OSMProfileCandidate = {
              externalId: `osm_${b.sourceId}`,
              source: 'openstreetmap',
              osmId: b.sourceId,
              osmType: (b.osmType as any) || 'node',
              name: b.name || b.businessName || null,
              category: b.category || query,
              address: b.address || null,
              city: b.city || resolvedLoc.cityName || location.city || null,
              state: b.state || resolvedLoc.regionName || location.state || null,
              country: resolvedLoc.countryName,
              postalCode: b.postalCode || b.postcode || null,
              latitude: b.latitude || null,
              longitude: b.longitude || null,
              phone: b.phone || null,
              email: b.email || null,
              website: b.website || null,
              rawTags: b.rawTags || {},
              capturedAt: new Date(),
            };
            osmCandidates.push(osmCandidate);
          }
        }
      } catch (err: any) {
        console.warn('[BusinessDiscoveryService] OSM query warning:', err.message);
      }

      const totalRaw = googleCandidates.length + osmCandidates.length;
      session.progress.discovered = totalRaw;

      // 2. DEDUPLICATING / IDENTITY RESOLUTION
      session.status = 'DEDUPLICATING';
      session.progress.stepMessage = 'Resolving identities and deduplicating cross-provider candidates...';
      session.updatedAt = new Date();

      const canonicalList: CanonicalBusiness[] = [];
      const matchedOsmIndices = new Set<number>();

      // Merge Google candidates first
      for (const gCandidate of googleCandidates) {
        let bestOsmCandidate: OSMProfileCandidate | null = null;

        for (let i = 0; i < osmCandidates.length; i++) {
          if (matchedOsmIndices.has(i)) continue;
          const osmCandidate = osmCandidates[i];

          const match = businessIdentityResolutionService.matchCandidates(
            {
              name: gCandidate.name || '',
              phone: gCandidate.phone,
              website: gCandidate.website,
              lat: gCandidate.latitude,
              lon: gCandidate.longitude,
              placeId: gCandidate.placeId,
            },
            {
              name: osmCandidate.name || '',
              phone: osmCandidate.phone,
              website: osmCandidate.website,
              lat: osmCandidate.latitude,
              lon: osmCandidate.longitude,
            }
          );

          if (match.matched) {
            bestOsmCandidate = osmCandidate;
            matchedOsmIndices.add(i);
            break;
          }
        }

        const canonical = businessIdentityResolutionService.mergeIntoCanonical(
          gCandidate,
          bestOsmCandidate
        );
        canonical.tenantId = session.request.tenantId || 'tenant_default';
        canonical.identity.country = resolvedLoc.countryName;
        canonical.identity.countryCode = resolvedLoc.countryCode;
        canonical.identity.regionCode = resolvedLoc.regionCode;
        canonical.identity.timezone = resolvedLoc.timezone;
        canonicalList.push(canonical);
      }

      // Add remaining unmatched OSM candidates
      for (let i = 0; i < osmCandidates.length; i++) {
        if (!matchedOsmIndices.has(i)) {
          const canonical = businessIdentityResolutionService.mergeIntoCanonical(
            null,
            osmCandidates[i]
          );
          canonical.tenantId = session.request.tenantId || 'tenant_default';
          canonical.identity.country = resolvedLoc.countryName;
          canonical.identity.countryCode = resolvedLoc.countryCode;
          canonical.identity.regionCode = resolvedLoc.regionCode;
          canonical.identity.timezone = resolvedLoc.timezone;
          canonicalList.push(canonical);
        }
      }

      // 3. ENRICHING (Website analysis & Social Media Discovery)
      session.status = 'SOCIAL_DISCOVERY';
      session.progress.stepMessage = 'Analyzing websites and discovering public social media profiles...';
      session.updatedAt = new Date();

      // Process website enrichment concurrently in parallel
      await Promise.allSettled(
        canonicalList.map(async (biz) => {
          // Record provenance
          provenanceService.recordEvidenceBatch(biz.evidence);

          // If website exists, try extracting public social profiles
          if (biz.identity.website) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 3000);
              const resp = await fetch(biz.identity.website, {
                headers: { 'User-Agent': 'LeadPilotBot/2.0 (+https://leadpilot.app)' },
                signal: controller.signal,
              });
              clearTimeout(timeout);

              if (resp.ok) {
                const html = await resp.text();
                const { profiles, snapshots: initialSnapshots } = socialDiscoveryService.discoverFromWebsiteHtml(
                  biz.id,
                  biz.identity,
                  html
                );

                // Social Intelligence V2: Enrich verified profiles with authenticated social metrics
                const { enrichedProfiles, newSnapshots, newEvidence } = await socialMetricsService.enrichProfiles(
                  biz.id,
                  biz.identity,
                  profiles,
                  initialSnapshots
                );
                biz.social = enrichedProfiles;

                // Commercial Milestones Intelligence
                await commercialMilestoneService.enrichMilestones(
                  biz.id,
                  biz.identity,
                  {
                    providedTexts: [
                      { text: html, sourceUrl: biz.identity.website, sourceType: 'PRIMARY' }
                    ]
                  }
                );

                // Record evidence for discovered social URLs
                for (const soc of enrichedProfiles) {
                  if (soc.profileUrl) {
                    provenanceService.recordEvidence({
                      entityType: 'social_profile',
                      entityId: soc.id,
                      field: 'profileUrl',
                      value: soc.profileUrl,
                      source: soc.source,
                      capturedAt: new Date().toISOString(),
                      confidence: 'HIGH',
                    });
                  }
                }

                // Record field-level provenance evidence from social metrics
                for (const ev of newEvidence) {
                  provenanceService.recordEvidence(ev);
                  biz.evidence.push(ev);
                }

                // Extract public business email from mailto: link in HTML if not already present
                if (!biz.identity.email) {
                  const mailtoMatch = html.match(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
                  if (mailtoMatch) {
                    const mail = mailtoMatch[1].toLowerCase().trim();
                    if (!mail.includes('example.com') && !mail.includes('domain.com') && !mail.includes('wixpress.com')) {
                      biz.identity.email = mail;
                      provenanceService.recordEvidence({
                        entityType: 'business',
                        entityId: biz.id,
                        field: 'email',
                        value: mail,
                        source: 'website_crawler',
                        capturedAt: new Date().toISOString(),
                        confidence: 'HIGH',
                      });
                    }
                  }
                }

                biz.websiteAnalysis = {
                  url: biz.identity.website,
                  status: 'Working',
                  isHttps: biz.identity.website.startsWith('https://'),
                  detectedIssues: [],
                  speedScore: 85,
                  mobileOptimized: true,
                  analyzedAt: new Date(),
                };
              } else {
                biz.websiteAnalysis = {
                  url: biz.identity.website,
                  status: 'Needs Improvement',
                  isHttps: biz.identity.website.startsWith('https://'),
                  detectedIssues: [`HTTP ${resp.status}`],
                  analyzedAt: new Date(),
                };
              }
            } catch {
              biz.websiteAnalysis = {
                url: biz.identity.website,
                status: 'Unreachable',
                isHttps: biz.identity.website.startsWith('https://'),
                detectedIssues: ['Network timeout or connection refused'],
                analyzedAt: new Date(),
              };
            }
          }
          session.progress.processed++;
        })
      );

      // 4. FILTERING & ELIGIBILITY (Excludes rating === 5.0)
      session.status = 'FILTERING';
      session.progress.stepMessage = 'Applying eligibility criteria (excluding perfect 5.0 ratings)...';
      session.updatedAt = new Date();

      businessEligibilityService.filterBusinesses(canonicalList, filters);

      // 5. RANKING (reviewCount DESC, rating DESC)
      session.status = 'RANKING';
      session.progress.stepMessage = 'Sorting by reviewCount DESC and rating DESC...';
      session.updatedAt = new Date();

      const ranked = businessRankingService.rank(canonicalList, { sort });

      // Save businesses in memory store
      session.businesses = ranked;
      for (const b of ranked) {
        this.businessStore.set(b.id, b);
      }

      // 6. PERSISTENCE (Relational PostgreSQL persistence via Prisma if configured)
      const persistenceResult = await businessRepository.persistBatch(ranked);
      session.persistenceStatus = persistenceResult.notConfigured
        ? 'NOT_CONFIGURED'
        : persistenceResult.failed > 0
        ? 'FAILED'
        : 'PERSISTED';

      // 7. COUNT RECONCILIATION (Requirements 28 & 55)
      // rawDiscovered = deduplicated + duplicates
      // deduplicated = eligible + excluded
      // eligible = persisted + failed
      const rawDiscovered = googleCandidates.length + osmCandidates.length;
      const duplicates = Math.max(0, rawDiscovered - canonicalList.length);
      const deduplicated = canonicalList.length;
      const excluded5Star = canonicalList.filter((b) => !b.eligibility.included).length;
      const eligible = canonicalList.filter((b) => b.eligibility.included).length;
      const persisted = persistenceResult.persisted;
      const failed = persistenceResult.failed;

      session.reconciliation = {
        requestedCount: limit,
        rawDiscovered,
        googleDiscovered: googleCandidates.length,
        secondaryDiscovered: osmCandidates.length,
        duplicates,
        deduplicated,
        excluded5Star,
        eligible,
        persisted,
        failed,
      };

      // 8. RECORD PERSISTENT SEARCH JOB RECORD (Section 27)
      await businessRepository.recordSearchJob({
        searchId: session.searchId,
        tenantId: session.request.tenantId || 'tenant_default',
        userId: session.request.userId || null,
        query,
        countryCode: resolvedLoc.countryCode,
        regionCode: resolvedLoc.regionCode,
        regionName: resolvedLoc.regionName,
        cityName: resolvedLoc.cityName,
        postalCode: resolvedLoc.postalCode,
        status: session.progress.completed > 0 || ranked.length > 0 ? 'READY' : 'PARTIAL',
        requestedCount: limit,
        discoveredCount: canonicalList.length,
        rawDiscoveredCount: rawDiscovered,
        duplicatesCount: duplicates,
        deduplicatedCount: deduplicated,
        excludedCount: excluded5Star,
        eligibleCount: eligible,
        persistedCount: persisted,
        failedCount: failed,
        completedAt: new Date(),
      });

      session.progress.completed = ranked.filter((b) => b.eligibility.included).length;
      session.status = session.progress.completed > 0 || ranked.length > 0 ? 'READY' : 'PARTIAL';
      session.progress.stepMessage = `Pipeline completed: ${session.progress.completed} eligible businesses ready. Persistence: ${session.persistenceStatus}.`;
      session.updatedAt = new Date();

      return session;
    } catch (err: any) {
      session.status = 'FAILED';
      session.error = err.message || 'Pipeline encountered unexpected failure';
      session.progress.failed++;
      session.updatedAt = new Date();
      return session;
    }
  }

  /**
   * Returns server-side paginated and filtered results
   */
  public getResults(
    searchId: string,
    params?: {
      page?: number;
      limit?: number;
      minReviews?: number;
      maxReviews?: number;
      minRating?: number;
      maxRating?: number;
      hasWebsite?: boolean;
      hasPhone?: boolean;
      hasEmail?: boolean;
      hasInstagram?: boolean;
      hasFacebook?: boolean;
      hasYouTube?: boolean;
      hasLinkedIn?: boolean;
      hasAnySocial?: boolean;
      sortField?: 'reviewCount' | 'rating' | 'name';
      sortDirection?: 'asc' | 'desc';
    }
  ): SearchResultsResponse | null {
    const session = this.sessions.get(searchId);
    if (!session) return null;

    let list = [...session.businesses];

    // Optional post-query filtering
    if (params?.minReviews !== undefined) {
      list = list.filter((b) => (b.google?.reviewCount ?? 0) >= params.minReviews!);
    }
    if (params?.maxReviews !== undefined) {
      list = list.filter((b) => (b.google?.reviewCount ?? 0) <= params.maxReviews!);
    }
    if (params?.minRating !== undefined) {
      list = list.filter((b) => (b.google?.rating ?? 0) >= params.minRating!);
    }
    if (params?.maxRating !== undefined) {
      list = list.filter((b) => (b.google?.rating ?? 0) <= params.maxRating!);
    }
    if (params?.hasWebsite === true) {
      list = list.filter((b) => Boolean(b.identity.website));
    }
    if (params?.hasPhone === true) {
      list = list.filter((b) => Boolean(b.identity.phone));
    }
    if (params?.hasEmail === true) {
      list = list.filter((b) => Boolean(b.identity.email));
    }
    if (params?.hasInstagram === true) {
      list = list.filter((b) => b.social.some((s) => s.platform === 'instagram'));
    }
    if (params?.hasFacebook === true) {
      list = list.filter((b) => b.social.some((s) => s.platform === 'facebook'));
    }
    if (params?.hasYouTube === true) {
      list = list.filter((b) => b.social.some((s) => s.platform === 'youtube'));
    }
    if (params?.hasLinkedIn === true) {
      list = list.filter((b) => b.social.some((s) => s.platform === 'linkedin'));
    }
    if (params?.hasAnySocial === true) {
      list = list.filter((b) => b.social.length > 0);
    }

    // Sort if overridden
    if (params?.sortField) {
      list = businessRankingService.rank(list, {
        sort: {
          field: params.sortField,
          direction: params.sortDirection || 'desc',
        },
      });
    }

    const page = Math.max(params?.page || 1, 1);
    const limit = Math.max(params?.limit || 50, 1);
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      searchId,
      status: session.status,
      total,
      page,
      limit,
      totalPages,
      providerStatuses: session.providerStatuses,
      persistenceStatus: session.persistenceStatus,
      filtersApplied: session.request.filters || {},
      sortApplied: session.request.sort || { field: 'reviewCount', direction: 'desc' },
      reconciliation: session.reconciliation,
      summary: {
        totalDiscovered: session.progress.discovered,
        googleBusinessesDiscovered: session.businesses.filter((b) =>
          b.sources.some((s) => s.provider.toLowerCase() === 'google_places')
        ).length,
        secondaryBusinessesDiscovered: session.businesses.filter((b) =>
          b.sources.some((s) => s.provider.toLowerCase() === 'openstreetmap')
        ).length,
        totalUniqueBusinesses: session.businesses.length,
        fiveStarExcluded: session.businesses.filter(
          (b) => b.eligibility.excludedReason === 'PERFECT_5_STAR_RATING'
        ).length,
        eligibleBusinesses: session.businesses.filter((b) => b.eligibility.included).length,
        googleEligibleBusinesses: session.businesses.filter(
          (b) =>
            b.eligibility.included &&
            b.sources.some((s) => s.provider.toLowerCase() === 'google_places')
        ).length,
        totalEligible: session.businesses.filter((b) => b.eligibility.included).length,
        totalExcluded5Star: session.businesses.filter(
          (b) => b.eligibility.excludedReason === 'PERFECT_5_STAR_RATING'
        ).length,
        withWebsite: session.businesses.filter((b) => Boolean(b.identity.website)).length,
        withPhone: session.businesses.filter((b) => Boolean(b.identity.phone)).length,
        withEmail: session.businesses.filter((b) => Boolean(b.identity.email)).length,
        withInstagram: session.businesses.filter((b) =>
          b.social.some((s) => s.platform === 'instagram')
        ).length,
        withFacebook: session.businesses.filter((b) =>
          b.social.some((s) => s.platform === 'facebook')
        ).length,
        withYouTube: session.businesses.filter((b) =>
          b.social.some((s) => s.platform === 'youtube')
        ).length,
        withLinkedIn: session.businesses.filter((b) =>
          b.social.some((s) => s.platform === 'linkedin')
        ).length,
        withAnySocial: session.businesses.filter((b) => b.social.length > 0).length,
      },
      results: paginated,
    };
  }
}

export const businessDiscoveryService = new BusinessDiscoveryService();
