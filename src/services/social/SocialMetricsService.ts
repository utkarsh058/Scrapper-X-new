/**
 * Social Metrics Enrichment Service (Social Intelligence V2)
 * 
 * Strict Single Responsibility:
 * Enriches verified social profiles with authenticated follower/subscriber metrics
 * via official platform provider adapters.
 * 
 * Boundary Constraints:
 * - ZERO FAKE DATA POLICY IS ABSOLUTE.
 * - Idempotency: Avoid redundant API calls if valid snapshot exists within TTL (e.g. 24 hours).
 * - Identity Guard: Only profiles with verificationStatus === 'VERIFIED' and sufficient confidence (>= 0.8) are enriched.
 * - Field-level provenance: Emits SourceEvidence for every metric.
 * - Non-fatal: Platform API failures or missing credentials never fail discovery.
 */

import {
  SocialProfile,
  SocialProfileSnapshot,
  SourceEvidence,
  CanonicalBusinessIdentity,
} from '@/types/canonical';
import { getSocialProvider, SocialMetricsResult } from '@/providers/social/SocialMetricsProvider';
import { publicSocialMetricsProvider } from '@/providers/social/PublicSocialMetricsProvider';
import { socialAccountAgeResolverService } from './SocialAccountAgeResolverService';

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class SocialMetricsService {
  /**
   * Enriches a list of social profiles for a business, creating snapshots and evidence
   */
  public async enrichProfiles(
    businessId: string,
    identity: CanonicalBusinessIdentity,
    profiles: SocialProfile[],
    existingSnapshots: SocialProfileSnapshot[] = []
  ): Promise<{
    enrichedProfiles: SocialProfile[];
    newSnapshots: SocialProfileSnapshot[];
    newEvidence: SourceEvidence[];
  }> {
    const enrichedProfiles: SocialProfile[] = [];
    const newSnapshots: SocialProfileSnapshot[] = [];
    const newEvidence: SourceEvidence[] = [];

    const now = new Date();

    for (const profile of profiles) {
      // 1. Identity Guard: Only verified profiles can be enriched
      const isVerifiedIdentity =
        profile.verificationStatus === 'VERIFIED' ||
        (profile.confidence !== null && profile.confidence >= 0.8);

      if (!isVerifiedIdentity) {
        // Insufficient confidence / identity mismatch: Mark NOT_AVAILABLE
        enrichedProfiles.push({
          ...profile,
          followers: null,
          displayFollowerCount: null,
          isRounded: null,
          following: null,
          posts: null,
          subscribers: null,
          videos: null,
          likes: null,
          metricStatus: 'NOT_AVAILABLE',
          metricSource: 'identity_unverified',
          metricSourceType: 'NONE',
          followersFetchedAt: now,
          accountCreatedAt: null,
          accountCreatedDatePrecision: null,
          accountCreatedStatus: 'NOT_AVAILABLE',
          accountCreatedConfidence: null,
          accountCreatedSourceType: 'NONE',
          accountCreatedSourceUrl: null,
          accountCreatedEvidenceText: 'Identity unverified',
          accountCreatedFetchedAt: now,
          firstObservedAt: null,
          firstObservedSourceType: null,
          firstObservedSourceUrl: null,
          firstObservedEvidenceText: null,
          earliestPublicPostAt: null,
          earliestPublicPostSourceUrl: null,
          lastCheckedAt: now,
        });
        continue;
      }

      // 2. Check Idempotency / Cache: If snapshot with evaluated metrics exists within TTL, reuse without API call
      const recentSnapshot = existingSnapshots.find(
        (s) => s.profileId === profile.id &&
               s.metricStatus !== 'NOT_CONFIGURED' &&
               now.getTime() - new Date(s.capturedAt).getTime() < SNAPSHOT_TTL_MS
      );

      if (recentSnapshot) {
        enrichedProfiles.push({
          ...profile,
          followers: recentSnapshot.followers,
          displayFollowerCount: recentSnapshot.displayFollowerCount || (recentSnapshot.followers !== null ? recentSnapshot.followers.toLocaleString() : null),
          isRounded: recentSnapshot.isRounded ?? null,
          following: recentSnapshot.following,
          posts: recentSnapshot.posts,
          subscribers: recentSnapshot.subscribers,
          videos: recentSnapshot.videos,
          likes: recentSnapshot.likes,
          verified: recentSnapshot.isVerified ?? profile.verified,
          metricStatus: recentSnapshot.metricStatus,
          metricSource: recentSnapshot.source,
          metricSourceType: recentSnapshot.metricSourceType,
          followersFetchedAt: recentSnapshot.capturedAt,
          accountCreatedAt: recentSnapshot.accountCreatedAt || profile.accountCreatedAt || null,
          accountCreatedDatePrecision: recentSnapshot.accountCreatedDatePrecision || profile.accountCreatedDatePrecision || null,
          accountCreatedStatus: recentSnapshot.accountCreatedStatus || profile.accountCreatedStatus || 'NOT_AVAILABLE',
          accountCreatedConfidence: recentSnapshot.accountCreatedConfidence || profile.accountCreatedConfidence || null,
          accountCreatedSourceType: recentSnapshot.accountCreatedSourceType || profile.accountCreatedSourceType || null,
          accountCreatedSourceUrl: recentSnapshot.accountCreatedSourceUrl || profile.accountCreatedSourceUrl || null,
          accountCreatedEvidenceText: recentSnapshot.accountCreatedEvidenceText || profile.accountCreatedEvidenceText || null,
          accountCreatedFetchedAt: recentSnapshot.accountCreatedFetchedAt || profile.accountCreatedFetchedAt || null,
          firstObservedAt: recentSnapshot.firstObservedAt || profile.firstObservedAt || null,
          firstObservedSourceType: recentSnapshot.firstObservedSourceType || profile.firstObservedSourceType || null,
          firstObservedSourceUrl: recentSnapshot.firstObservedSourceUrl || profile.firstObservedSourceUrl || null,
          firstObservedEvidenceText: recentSnapshot.firstObservedEvidenceText || profile.firstObservedEvidenceText || null,
          earliestPublicPostAt: recentSnapshot.earliestPublicPostAt || profile.earliestPublicPostAt || null,
          earliestPublicPostSourceUrl: recentSnapshot.earliestPublicPostSourceUrl || profile.earliestPublicPostSourceUrl || null,
          lastCheckedAt: now,
        });
        continue;
      }

      // 3. Lookup Provider Adapter
      const provider = getSocialProvider(profile.platform);
      if (!provider) {
        enrichedProfiles.push({
          ...profile,
          followers: null,
          displayFollowerCount: null,
          isRounded: null,
          following: null,
          posts: null,
          subscribers: null,
          videos: null,
          likes: null,
          metricStatus: 'NOT_AVAILABLE',
          metricSource: 'unsupported_platform',
          metricSourceType: 'NONE',
          followersFetchedAt: now,
          lastCheckedAt: now,
        });
        continue;
      }

      let metrics: SocialMetricsResult | null = null;
      const isMetaPlatform = profile.platform === 'instagram' || profile.platform === 'facebook';

      // Priority 1: Official API (if configured)
      if (provider.isConfigured()) {
        try {
          const apiMetrics = await provider.fetchMetrics(profile.profileUrl || '', profile.username);
          if (apiMetrics && apiMetrics.followerCount !== null) {
            metrics = apiMetrics;
          } else if (apiMetrics && !isMetaPlatform) {
            // For non-Meta platforms (YouTube, TikTok, X, LinkedIn), preserve official API response directly
            metrics = apiMetrics;
          }
        } catch {
          // If official API throws, fallback may still run for Instagram/Facebook
          metrics = null;
        }
      }

      // Priority 2: Public Web Fallback (strictly for Instagram and Facebook only)
      if (isMetaPlatform && (!metrics || metrics.followerCount === null)) {
        try {
          const publicMetrics = await publicSocialMetricsProvider.fetchPublicMetrics(
            profile.platform as 'instagram' | 'facebook',
            profile.profileUrl || '',
            profile.username
          );
          if (publicMetrics && publicMetrics.followerCount !== null) {
            metrics = publicMetrics;
          }
        } catch {
          // Public web error: non-fatal, proceed with null
        }
      }

      // Resolve real social account creation date / first-observed date
      const ageEvidence = await socialAccountAgeResolverService.resolve(identity, profile);

      const hasOfficialCreationDate = Boolean(metrics?.accountCreatedAt);
      const effectiveAccountCreatedAt = hasOfficialCreationDate
        ? metrics!.accountCreatedAt
        : ageEvidence.accountCreatedAt;
      const effectivePrecision = hasOfficialCreationDate
        ? ('DAY' as const)
        : ageEvidence.accountCreatedDatePrecision;
      const effectiveStatus = hasOfficialCreationDate
        ? ('VERIFIED_EXACT' as const)
        : ageEvidence.accountCreatedStatus;
      const effectiveConfidence = hasOfficialCreationDate
        ? ('HIGH' as const)
        : ageEvidence.accountCreatedConfidence;
      const effectiveSourceType = hasOfficialCreationDate
        ? ('PUBLIC_PROFILE' as const)
        : ageEvidence.accountCreatedSourceType;
      const effectiveSourceUrl = hasOfficialCreationDate
        ? profile.profileUrl
        : ageEvidence.accountCreatedSourceUrl;
      const effectiveEvidenceText = hasOfficialCreationDate
        ? 'Official platform account created timestamp'
        : ageEvidence.accountCreatedEvidenceText;
      const effectiveFetchedAt = hasOfficialCreationDate
        ? (metrics!.retrievedAt || now)
        : ageEvidence.accountCreatedFetchedAt;
      const effectiveFirstObservedAt = hasOfficialCreationDate
        ? null
        : ageEvidence.firstObservedAt;
      const effectiveFirstObservedSourceType = hasOfficialCreationDate
        ? null
        : ageEvidence.firstObservedSourceType;
      const effectiveFirstObservedSourceUrl = hasOfficialCreationDate
        ? null
        : ageEvidence.firstObservedSourceUrl;
      const effectiveFirstObservedEvidenceText = hasOfficialCreationDate
        ? null
        : ageEvidence.firstObservedEvidenceText;

      // If neither priority yielded follower metrics:
      if (!metrics) {
        const fallbackStatus = isMetaPlatform ? 'NOT_AVAILABLE' : (provider.isConfigured() ? 'NOT_AVAILABLE' : 'NOT_CONFIGURED');
        const fallbackSource = isMetaPlatform ? 'public_web' : provider.name;
        const unconfiguredProfile: SocialProfile = {
          ...profile,
          followers: null,
          displayFollowerCount: null,
          isRounded: null,
          following: null,
          posts: null,
          subscribers: null,
          videos: null,
          likes: null,
          metricStatus: fallbackStatus,
          metricSource: fallbackSource,
          metricSourceType: 'NONE',
          followersFetchedAt: now,
          createdAt: effectiveAccountCreatedAt,
          createdAtType: effectiveAccountCreatedAt ? (effectivePrecision === 'DAY' ? 'EXACT' : 'INFERRED') : 'NOT_AVAILABLE',
          accountCreatedAt: effectiveAccountCreatedAt,
          accountCreatedDatePrecision: effectivePrecision,
          accountCreatedStatus: effectiveStatus,
          accountCreatedConfidence: effectiveConfidence,
          accountCreatedSourceType: effectiveSourceType,
          accountCreatedSourceUrl: effectiveSourceUrl,
          accountCreatedEvidenceText: effectiveEvidenceText,
          accountCreatedFetchedAt: effectiveFetchedAt,
          firstObservedAt: effectiveFirstObservedAt,
          firstObservedSourceType: effectiveFirstObservedSourceType,
          firstObservedSourceUrl: effectiveFirstObservedSourceUrl,
          firstObservedEvidenceText: effectiveFirstObservedEvidenceText,
          earliestPublicPostAt: ageEvidence.earliestPublicPostAt || null,
          earliestPublicPostSourceUrl: ageEvidence.earliestPublicPostSourceUrl || null,
          lastCheckedAt: now,
        };
        enrichedProfiles.push(unconfiguredProfile);

        newSnapshots.push({
          id: `snap_${profile.id}_${now.getTime()}`,
          profileId: profile.id,
          followers: null,
          displayFollowerCount: null,
          isRounded: null,
          following: null,
          posts: null,
          subscribers: null,
          videos: null,
          likes: null,
          isVerified: null,
          metricStatus: fallbackStatus,
          metricSourceType: 'NONE',
          accountCreatedAt: effectiveAccountCreatedAt,
          accountCreatedAtType: effectiveAccountCreatedAt ? (effectivePrecision === 'DAY' ? 'EXACT' : 'INFERRED') : 'NOT_AVAILABLE',
          accountCreatedDatePrecision: effectivePrecision,
          accountCreatedConfidence: effectiveConfidence,
          accountCreatedStatus: effectiveStatus,
          accountCreatedSourceType: effectiveSourceType,
          accountCreatedSourceUrl: effectiveSourceUrl,
          accountCreatedEvidenceText: effectiveEvidenceText,
          accountCreatedFetchedAt: effectiveFetchedAt,
          firstObservedAt: effectiveFirstObservedAt,
          firstObservedSourceType: effectiveFirstObservedSourceType,
          firstObservedSourceUrl: effectiveFirstObservedSourceUrl,
          firstObservedEvidenceText: effectiveFirstObservedEvidenceText,
          earliestPublicPostAt: ageEvidence.earliestPublicPostAt || null,
          earliestPublicPostSourceUrl: ageEvidence.earliestPublicPostSourceUrl || null,
          capturedAt: now,
          source: fallbackSource,
        });

        if (effectiveAccountCreatedAt !== null) {
          newEvidence.push({
            entityType: 'social_profile',
            entityId: profile.id,
            field: 'accountCreatedAt',
            value: effectiveAccountCreatedAt.toISOString(),
            source: effectiveSourceUrl || fallbackSource,
            capturedAt: effectiveFetchedAt.toISOString(),
            confidence: effectiveConfidence || 'HIGH',
            metadata: {
              precision: effectivePrecision,
              status: effectiveStatus,
              evidenceText: effectiveEvidenceText,
            },
          });
        }

        if (effectiveFirstObservedAt !== null) {
          newEvidence.push({
            entityType: 'social_profile',
            entityId: profile.id,
            field: 'firstObservedAt',
            value: effectiveFirstObservedAt.toISOString(),
            source: effectiveFirstObservedSourceUrl || fallbackSource,
            capturedAt: effectiveFetchedAt.toISOString(),
            confidence: 'MEDIUM',
            metadata: {
              sourceType: effectiveFirstObservedSourceType,
              evidenceText: effectiveFirstObservedEvidenceText,
            },
          });
        }

        continue;
      }

      // Process successfully resolved metrics
      const updatedProfile: SocialProfile = {
        ...profile,
        displayName: metrics.displayName || profile.displayName,
        username: metrics.username || profile.username,
        followers: metrics.followerCount,
        displayFollowerCount: metrics.displayFollowerCount || (metrics.followerCount !== null ? metrics.followerCount.toLocaleString() : null),
        isRounded: metrics.isRounded ?? null,
        following: metrics.followingCount,
        subscribers: metrics.subscriberCount,
        posts: metrics.postCount ?? profile.posts,
        videos: metrics.videoCount ?? profile.videos,
        likes: metrics.likeCount ?? profile.likes,
        verified: metrics.isVerified ?? profile.verified,
        createdAt: effectiveAccountCreatedAt,
        createdAtType: effectiveAccountCreatedAt ? (effectivePrecision === 'DAY' ? 'EXACT' : 'INFERRED') : 'NOT_AVAILABLE',
        accountCreatedAt: effectiveAccountCreatedAt,
        accountCreatedDatePrecision: effectivePrecision,
        accountCreatedStatus: effectiveStatus,
        accountCreatedConfidence: effectiveConfidence,
        accountCreatedSourceType: effectiveSourceType,
        accountCreatedSourceUrl: effectiveSourceUrl,
        accountCreatedEvidenceText: effectiveEvidenceText,
        accountCreatedFetchedAt: effectiveFetchedAt,
        firstObservedAt: effectiveFirstObservedAt,
        firstObservedSourceType: effectiveFirstObservedSourceType,
        firstObservedSourceUrl: effectiveFirstObservedSourceUrl,
        firstObservedEvidenceText: effectiveFirstObservedEvidenceText,
        earliestPublicPostAt: ageEvidence.earliestPublicPostAt || null,
        earliestPublicPostSourceUrl: ageEvidence.earliestPublicPostSourceUrl || null,
        metricStatus: metrics.metricStatus,
        metricSource: metrics.metricSource,
        metricSourceType: metrics.metricSourceType,
        followersFetchedAt: metrics.retrievedAt,
        lastCheckedAt: now,
      };

      enrichedProfiles.push(updatedProfile);

      // Create snapshot
      newSnapshots.push({
        id: `snap_${profile.id}_${now.getTime()}`,
        profileId: profile.id,
        followers: metrics.followerCount,
        displayFollowerCount: updatedProfile.displayFollowerCount,
        isRounded: updatedProfile.isRounded,
        following: metrics.followingCount,
        posts: metrics.postCount ?? null,
        subscribers: metrics.subscriberCount,
        videos: metrics.videoCount ?? null,
        likes: metrics.likeCount ?? null,
        isVerified: metrics.isVerified ?? null,
        metricStatus: metrics.metricStatus,
        metricSourceType: metrics.metricSourceType,
        accountCreatedAt: effectiveAccountCreatedAt,
        accountCreatedAtType: effectiveAccountCreatedAt ? (effectivePrecision === 'DAY' ? 'EXACT' : 'INFERRED') : 'NOT_AVAILABLE',
        accountCreatedDatePrecision: effectivePrecision,
        accountCreatedConfidence: effectiveConfidence,
        accountCreatedStatus: effectiveStatus,
        accountCreatedSourceType: effectiveSourceType,
        accountCreatedSourceUrl: effectiveSourceUrl,
        accountCreatedEvidenceText: effectiveEvidenceText,
        accountCreatedFetchedAt: effectiveFetchedAt,
        firstObservedAt: effectiveFirstObservedAt,
        firstObservedSourceType: effectiveFirstObservedSourceType,
        firstObservedSourceUrl: effectiveFirstObservedSourceUrl,
        firstObservedEvidenceText: effectiveFirstObservedEvidenceText,
        earliestPublicPostAt: ageEvidence.earliestPublicPostAt || null,
        earliestPublicPostSourceUrl: ageEvidence.earliestPublicPostSourceUrl || null,
        capturedAt: metrics.retrievedAt,
        source: metrics.metricSource,
      });

      // Record field-level provenance evidence for non-null metrics
      if (metrics.followerCount !== null) {
        newEvidence.push({
          entityType: 'social_profile',
          entityId: profile.id,
          field: 'followerCount',
          value: String(metrics.followerCount),
          source: metrics.metricSource,
          capturedAt: metrics.retrievedAt.toISOString(),
          confidence: 'HIGH',
          metadata: {
            displayFollowerCount: updatedProfile.displayFollowerCount,
            isRounded: updatedProfile.isRounded,
          },
        });
      }

      if (metrics.subscriberCount !== null) {
        newEvidence.push({
          entityType: 'social_profile',
          entityId: profile.id,
          field: 'subscriberCount',
          value: String(metrics.subscriberCount),
          source: metrics.metricSource,
          capturedAt: metrics.retrievedAt.toISOString(),
          confidence: 'HIGH',
        });
      }

      if (effectiveAccountCreatedAt !== null) {
        newEvidence.push({
          entityType: 'social_profile',
          entityId: profile.id,
          field: 'accountCreatedAt',
          value: effectiveAccountCreatedAt.toISOString(),
          source: hasOfficialCreationDate ? metrics!.metricSource : (effectiveSourceUrl || metrics.metricSource),
          capturedAt: effectiveFetchedAt.toISOString(),
          confidence: effectiveConfidence || 'HIGH',
          metadata: {
            precision: effectivePrecision,
            status: effectiveStatus,
            evidenceText: effectiveEvidenceText,
          },
        });
      }

      if (effectiveFirstObservedAt !== null) {
        newEvidence.push({
          entityType: 'social_profile',
          entityId: profile.id,
          field: 'firstObservedAt',
          value: effectiveFirstObservedAt.toISOString(),
          source: effectiveFirstObservedSourceUrl || metrics.metricSource,
          capturedAt: effectiveFetchedAt.toISOString(),
          confidence: 'MEDIUM',
          metadata: {
            sourceType: effectiveFirstObservedSourceType,
            evidenceText: effectiveFirstObservedEvidenceText,
          },
        });
      }
    }

    return { enrichedProfiles, newSnapshots, newEvidence };
  }
}

export const socialMetricsService = new SocialMetricsService();
