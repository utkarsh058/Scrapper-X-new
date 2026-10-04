/**
 * Business Persistence Repository
 * 
 * Strict Single Responsibility:
 * Manages database persistence for Canonical Entities in PostgreSQL via Prisma.
 * 
 * Boundary Constraints:
 * - External providers never write directly here; only canonical normalized entities enter.
 * - Does NOT silently report database persistence if database is unconfigured or unreachable.
 * - Tracks exact persistence status: PERSISTED | NOT_CONFIGURED | FAILED.
 */

import { CanonicalBusiness } from '@/types/canonical';
import { prisma } from '@/lib/prisma';

export type PersistenceStatus = 'PERSISTED' | 'NOT_CONFIGURED' | 'FAILED';

export interface PersistenceResult {
  status: PersistenceStatus;
  businessId: string;
  error?: string;
  persistedEntities?: {
    business: boolean;
    googleProfile: boolean;
    reviewSummary: boolean;
    socialProfiles: number;
    sourceEvidence: number;
  };
}

export class BusinessRepository {
  public isDatabaseConfigured(): boolean {
    const url = process.env.DATABASE_URL;
    return Boolean(url && url.trim().length > 0);
  }

  /**
   * Tests active database connectivity
   */
  public async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isDatabaseConfigured()) {
      return { connected: false, error: 'DATABASE_URL is not set in environment.' };
    }

    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.$queryRaw`SELECT 1`;
      return { connected: true };
    } catch (err: any) {
      return { connected: false, error: err.message || 'PostgreSQL connection check failed' };
    }
  }

  /**
   * Persists a canonical business and its relational entities into PostgreSQL via Prisma.
   */
  public async persistCanonicalBusiness(biz: CanonicalBusiness): Promise<PersistenceResult> {
    if (!this.isDatabaseConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        businessId: biz.id,
        error: 'DATABASE_NOT_CONFIGURED: DATABASE_URL is not set.',
      };
    }

    try {
      const { prisma } = await import('@/lib/prisma');

      // 1. Upsert Core Business Record
      await prisma.business.upsert({
        where: { id: biz.id },
        update: {
          name: biz.identity.name || 'Unnamed Business',
          category: biz.identity.category || 'General',
          industry: biz.identity.category || 'General',
          address: biz.identity.address || null,
          city: biz.identity.city || null,
          state: biz.identity.state || null,
          country: biz.identity.country || 'India',
          postcode: biz.identity.postalCode || null,
          latitude: biz.identity.latitude || null,
          longitude: biz.identity.longitude || null,
          phone: biz.identity.phone || null,
          email: biz.identity.email || null,
          websiteUrl: biz.identity.website || null,
          countryCode: biz.identity.countryCode || (biz.identity.country === 'United States' ? 'US' : biz.identity.country === 'Canada' ? 'CA' : 'IN'),
          regionCode: biz.identity.regionCode || null,
          timezone: biz.identity.timezone || null,
          tenantId: biz.tenantId || 'tenant_default',
          rating: biz.google?.rating ?? null,
          reviewCount: biz.google?.reviewCount ?? null,
          businessStatus: biz.google?.businessStatus || 'OPERATIONAL',
        },
        create: {
          id: biz.id,
          name: biz.identity.name || 'Unnamed Business',
          category: biz.identity.category || 'General',
          industry: biz.identity.category || 'General',
          address: biz.identity.address || null,
          city: biz.identity.city || null,
          state: biz.identity.state || null,
          country: biz.identity.country || 'India',
          countryCode: biz.identity.countryCode || (biz.identity.country === 'United States' ? 'US' : biz.identity.country === 'Canada' ? 'CA' : 'IN'),
          regionCode: biz.identity.regionCode || null,
          timezone: biz.identity.timezone || null,
          postcode: biz.identity.postalCode || null,
          latitude: biz.identity.latitude || null,
          longitude: biz.identity.longitude || null,
          phone: biz.identity.phone || null,
          email: biz.identity.email || null,
          websiteUrl: biz.identity.website || null,
          tenantId: biz.tenantId || 'tenant_default',
          rating: biz.google?.rating ?? null,
          reviewCount: biz.google?.reviewCount ?? null,
          businessStatus: biz.google?.businessStatus || 'OPERATIONAL',
        },
      });

      // 2. Upsert GoogleBusinessProfile if Google data exists
      let googleProfilePersisted = false;
      if (biz.google && biz.google.placeId) {
        await prisma.googleBusinessProfile.upsert({
          where: { placeId: biz.google.placeId },
          update: {
            rating: biz.google.rating,
            reviewCount: biz.google.reviewCount,
            googleMapsUrl: biz.google.mapsUrl,
            businessStatus: biz.google.businessStatus || 'OPERATIONAL',
            lastCheckedAt: biz.google.lastCheckedAt,
          },
          create: {
            businessId: biz.id,
            placeId: biz.google.placeId,
            rating: biz.google.rating,
            reviewCount: biz.google.reviewCount,
            googleMapsUrl: biz.google.mapsUrl,
            businessStatus: biz.google.businessStatus || 'OPERATIONAL',
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: biz.google.firstSeenAt,
            lastCheckedAt: biz.google.lastCheckedAt,
          },
        });
        googleProfilePersisted = true;
      }

      // 3. Upsert ReviewSummary
      let reviewSummaryPersisted = false;
      if (biz.google?.placeId) {
        await prisma.reviewSummary.upsert({
          where: { businessId: biz.id },
          update: {
            rating: biz.google.rating,
            reviewCount: biz.google.reviewCount,
            capturedAt: biz.google.lastCheckedAt,
          },
          create: {
            businessId: biz.id,
            rating: biz.google.rating,
            reviewCount: biz.google.reviewCount,
            reviewLevelDataAvailable: false,
            earliestAvailableReviewDate: null,
            source: 'google_places',
            capturedAt: biz.google.lastCheckedAt,
          },
        });
        reviewSummaryPersisted = true;
      }

      // 4. Upsert Discovered Social Profiles and Snapshots
      let socialCount = 0;
      for (const soc of (biz.social || [])) {
        await prisma.socialProfile.upsert({
          where: { id: soc.id },
          update: {
            displayName: soc.displayName,
            followers: soc.followers,
            displayFollowerCount: soc.displayFollowerCount || null,
            isRounded: soc.isRounded ?? null,
            following: soc.following,
            posts: soc.posts,
            verified: soc.verified,
            metricStatus: soc.metricStatus || 'NOT_CONFIGURED',
            metricSource: soc.metricSource || null,
            metricSourceType: soc.metricSourceType || 'NONE',
            followersFetchedAt: soc.followersFetchedAt || null,
            verificationStatus: soc.verificationStatus || 'UNVERIFIED',
            accountCreatedAt: soc.accountCreatedAt || null,
            accountCreatedDatePrecision: soc.accountCreatedDatePrecision || null,
            accountCreatedConfidence: soc.accountCreatedConfidence || null,
            accountCreatedStatus: soc.accountCreatedStatus || 'NOT_AVAILABLE',
            accountCreatedSourceType: soc.accountCreatedSourceType || null,
            accountCreatedSourceUrl: soc.accountCreatedSourceUrl || null,
            accountCreatedEvidenceText: soc.accountCreatedEvidenceText || null,
            accountCreatedFetchedAt: soc.accountCreatedFetchedAt || null,
            firstObservedAt: soc.firstObservedAt || null,
            firstObservedSourceType: soc.firstObservedSourceType || null,
            firstObservedSourceUrl: soc.firstObservedSourceUrl || null,
            firstObservedEvidenceText: soc.firstObservedEvidenceText || null,
            earliestPublicPostAt: soc.earliestPublicPostAt || null,
            earliestPublicPostSourceUrl: soc.earliestPublicPostSourceUrl || null,
            lastCheckedAt: soc.lastCheckedAt,
          },
          create: {
            id: soc.id,
            businessId: biz.id,
            platform: soc.platform,
            profileUrl: soc.profileUrl,
            username: soc.username,
            displayName: soc.displayName,
            followers: soc.followers,
            displayFollowerCount: soc.displayFollowerCount || null,
            isRounded: soc.isRounded ?? null,
            following: soc.following,
            posts: soc.posts,
            verified: soc.verified,
            createdAt: soc.createdAt || null,
            createdAtType: soc.createdAtType || 'NOT_AVAILABLE',
            firstSeenAt: soc.firstSeenAt,
            source: soc.source,
            confidence: soc.confidence || 1.0,
            metricStatus: soc.metricStatus || 'NOT_CONFIGURED',
            metricSource: soc.metricSource || null,
            metricSourceType: soc.metricSourceType || 'NONE',
            followersFetchedAt: soc.followersFetchedAt || null,
            verificationStatus: soc.verificationStatus || 'UNVERIFIED',
            accountCreatedAt: soc.accountCreatedAt || null,
            accountCreatedDatePrecision: soc.accountCreatedDatePrecision || null,
            accountCreatedConfidence: soc.accountCreatedConfidence || null,
            accountCreatedStatus: soc.accountCreatedStatus || 'NOT_AVAILABLE',
            accountCreatedSourceType: soc.accountCreatedSourceType || null,
            accountCreatedSourceUrl: soc.accountCreatedSourceUrl || null,
            accountCreatedEvidenceText: soc.accountCreatedEvidenceText || null,
            accountCreatedFetchedAt: soc.accountCreatedFetchedAt || null,
            firstObservedAt: soc.firstObservedAt || null,
            firstObservedSourceType: soc.firstObservedSourceType || null,
            firstObservedSourceUrl: soc.firstObservedSourceUrl || null,
            firstObservedEvidenceText: soc.firstObservedEvidenceText || null,
            earliestPublicPostAt: soc.earliestPublicPostAt || null,
            earliestPublicPostSourceUrl: soc.earliestPublicPostSourceUrl || null,
          },
        });

        // Insert historical snapshot
        await prisma.socialProfileSnapshot.create({
          data: {
            profileId: soc.id,
            followers: soc.followers,
            displayFollowerCount: soc.displayFollowerCount || null,
            isRounded: soc.isRounded ?? null,
            following: soc.following,
            posts: soc.posts,
            subscribers: soc.subscribers || null,
            videos: soc.videos || null,
            likes: soc.likes || null,
            isVerified: soc.verified,
            metricStatus: soc.metricStatus || 'NOT_CONFIGURED',
            metricSourceType: soc.metricSourceType || 'NONE',
            accountCreatedAt: soc.accountCreatedAt || soc.createdAt || null,
            accountCreatedAtType: soc.createdAtType || 'NOT_AVAILABLE',
            accountCreatedDatePrecision: soc.accountCreatedDatePrecision || null,
            accountCreatedConfidence: soc.accountCreatedConfidence || null,
            accountCreatedStatus: soc.accountCreatedStatus || 'NOT_AVAILABLE',
            accountCreatedSourceType: soc.accountCreatedSourceType || null,
            accountCreatedSourceUrl: soc.accountCreatedSourceUrl || null,
            accountCreatedEvidenceText: soc.accountCreatedEvidenceText || null,
            accountCreatedFetchedAt: soc.accountCreatedFetchedAt || null,
            firstObservedAt: soc.firstObservedAt || null,
            firstObservedSourceType: soc.firstObservedSourceType || null,
            firstObservedSourceUrl: soc.firstObservedSourceUrl || null,
            firstObservedEvidenceText: soc.firstObservedEvidenceText || null,
            earliestPublicPostAt: soc.earliestPublicPostAt || null,
            earliestPublicPostSourceUrl: soc.earliestPublicPostSourceUrl || null,
            capturedAt: soc.followersFetchedAt || new Date(),
            source: soc.metricSource || soc.source,
          },
        });
        socialCount++;
      }

      // 5. Insert SourceEvidence records
      let evidenceCount = 0;
      for (const ev of (biz.evidence || [])) {
        await prisma.sourceEvidence.create({
          data: {
            entityType: ev.entityType,
            entityId: ev.entityId,
            field: ev.field,
            value: ev.value,
            source: ev.source,
            capturedAt: new Date(ev.capturedAt),
            confidence: ev.confidence,
            businessId: biz.id,
          },
        });
        evidenceCount++;
      }

      return {
        status: 'PERSISTED',
        businessId: biz.id,
        persistedEntities: {
          business: true,
          googleProfile: googleProfilePersisted,
          reviewSummary: reviewSummaryPersisted,
          socialProfiles: socialCount,
          sourceEvidence: evidenceCount,
        },
      };
    } catch (err: any) {
      console.warn(`[BusinessRepository] PostgreSQL persistence error for ${biz.id}:`, err.message);
      return {
        status: 'FAILED',
        businessId: biz.id,
        error: `PERSISTENCE_FAILED: ${err.message}`,
      };
    }
  }

  /**
   * Persists a batch of canonical businesses
   */
  public async persistBatch(businesses: CanonicalBusiness[]): Promise<{
    persisted: number;
    failed: number;
    notConfigured: boolean;
    results: PersistenceResult[];
  }> {
    if (!this.isDatabaseConfigured()) {
      return {
        persisted: 0,
        failed: 0,
        notConfigured: true,
        results: businesses.map((b) => ({
          status: 'NOT_CONFIGURED',
          businessId: b.id,
          error: 'DATABASE_URL is not configured.',
        })),
      };
    }

    const results: PersistenceResult[] = [];
    let persisted = 0;
    let failed = 0;

    // Process in batches of 5 to respect connection pool limits while executing rapidly
    const batchSize = 5;
    for (let i = 0; i < businesses.length; i += batchSize) {
      const slice = businesses.slice(i, i + batchSize);
      const batchResults = await Promise.all(slice.map((b) => this.persistCanonicalBusiness(b)));
      for (const res of batchResults) {
        results.push(res);
        if (res.status === 'PERSISTED') persisted++;
        else failed++;
      }
    }

    return {
      persisted,
      failed,
      notConfigured: false,
      results,
    };
  }

  /**
   * Retrieves businesses strictly isolated to a specific tenant.
   * Enforces server-side database WHERE tenantId = currentTenantId.
   */
  public async findBusinessesByTenant(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      countryCode?: string;
      industry?: string;
    } = {}
  ) {
    if (!this.isDatabaseConfigured()) return { businesses: [], total: 0 };

    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 50, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (options.countryCode) {
      where.countryCode = options.countryCode.toUpperCase();
    }
    if (options.industry) {
      where.industry = { contains: options.industry, mode: 'insensitive' };
    }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ reviewCount: 'desc' }, { rating: 'desc' }],
        include: {
          googleProfile: true,
          socialProfiles: true,
          reviewSummary: true,
        },
      }),
      prisma.business.count({ where }),
    ]);

    return { businesses, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Retrieves a single business strictly validating tenant ownership.
   */
  public async findBusinessById(tenantId: string, businessId: string) {
    if (!this.isDatabaseConfigured()) return null;

    return await prisma.business.findFirst({
      where: {
        id: businessId,
        tenantId,
      },
      include: {
        googleProfile: true,
        socialProfiles: true,
        reviewSummary: true,
      },
    });
  }

  /**
   * Deletes a business strictly validating tenant ownership.
   */
  public async deleteBusiness(tenantId: string, businessId: string) {
    if (!this.isDatabaseConfigured()) return false;

    const existing = await prisma.business.findFirst({
      where: { id: businessId, tenantId },
    });
    if (!existing) return false;

    await prisma.business.delete({
      where: { id: businessId },
    });
    return true;
  }

  /**
   * Persists a persistent search job record with count reconciliation.
   */
  public async recordSearchJob(data: {
    searchId: string;
    tenantId: string;
    userId?: string | null;
    query: string;
    countryCode: string;
    regionCode?: string | null;
    regionName?: string | null;
    cityName?: string | null;
    postalCode?: string | null;
    status: string;
    requestedCount: number;
    discoveredCount: number;
    rawDiscoveredCount: number;
    duplicatesCount: number;
    deduplicatedCount: number;
    excludedCount: number;
    eligibleCount: number;
    persistedCount: number;
    failedCount: number;
    error?: string | null;
    completedAt?: Date | null;
  }) {
    if (!this.isDatabaseConfigured()) return null;

    return await prisma.searchJobRecord.upsert({
      where: { searchId: data.searchId },
      update: {
        status: data.status,
        discoveredCount: data.discoveredCount,
        rawDiscoveredCount: data.rawDiscoveredCount,
        duplicatesCount: data.duplicatesCount,
        deduplicatedCount: data.deduplicatedCount,
        excludedCount: data.excludedCount,
        eligibleCount: data.eligibleCount,
        persistedCount: data.persistedCount,
        failedCount: data.failedCount,
        error: data.error || null,
        completedAt: data.completedAt || null,
      },
      create: {
        searchId: data.searchId,
        tenantId: data.tenantId,
        userId: data.userId || null,
        query: data.query,
        countryCode: data.countryCode,
        regionCode: data.regionCode || null,
        regionName: data.regionName || null,
        cityName: data.cityName || null,
        postalCode: data.postalCode || null,
        status: data.status,
        requestedCount: data.requestedCount,
        discoveredCount: data.discoveredCount,
        rawDiscoveredCount: data.rawDiscoveredCount,
        duplicatesCount: data.duplicatesCount,
        deduplicatedCount: data.deduplicatedCount,
        excludedCount: data.excludedCount,
        eligibleCount: data.eligibleCount,
        persistedCount: data.persistedCount,
        failedCount: data.failedCount,
        error: data.error || null,
        completedAt: data.completedAt || null,
      },
    });
  }

  /**
   * Retrieves a search job strictly scoped to tenant.
   */
  public async getSearchJob(tenantId: string, searchId: string) {
    if (!this.isDatabaseConfigured()) return null;

    return await prisma.searchJobRecord.findFirst({
      where: {
        searchId,
        tenantId,
      },
    });
  }
}

export const businessRepository = new BusinessRepository();
