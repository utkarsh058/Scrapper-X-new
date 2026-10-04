/**
 * Social Discovery Service
 * 
 * Strict Single Responsibility:
 * Coordinates public social media extraction, verification, and canonical profile representation.
 * 
 * Boundary Constraints:
 * - REAL DATA ONLY.
 * - Missing follower counts must remain NULL, never 0.
 * - Exact creation dates must remain NULL (createdAtType = 'NOT_AVAILABLE') unless genuinely provided by an API.
 * - Never conflate firstSeenAt with createdAt.
 */

import {
  CanonicalBusinessIdentity,
  SocialProfile,
  SocialProfileSnapshot,
  SocialPlatform,
} from '@/types/canonical';
import { websiteSocialExtractor } from './WebsiteSocialExtractor';
import { socialIdentityVerificationService } from './SocialIdentityVerificationService';

export class SocialDiscoveryService {
  /**
   * Discovers and verifies social profiles for a business from its website HTML
   */
  public discoverFromWebsiteHtml(
    businessId: string,
    identity: CanonicalBusinessIdentity,
    html: string
  ): { profiles: SocialProfile[]; snapshots: SocialProfileSnapshot[] } {
    const extracted = websiteSocialExtractor.extractFromHtml(html);
    const profiles: SocialProfile[] = [];
    const snapshots: SocialProfileSnapshot[] = [];

    const now = new Date();

    for (const item of extracted) {
      const verification = socialIdentityVerificationService.verify(identity, item);
      if (!verification.matched) continue;

      const profileId = `soc_${businessId}_${item.platform}`;

      const profile: SocialProfile = {
        id: profileId,
        businessId,
        platform: item.platform,
        profileUrl: item.url,
        username: item.username,
        displayName: null,
        description: null,

        // Missing data is explicitly NULL, never 0
        followers: null,
        following: null,
        posts: null,
        subscribers: null,
        videos: null,
        likes: null,
        verified: null,

        // Strict Creation Date Boundary:
        // When exact creation date cannot be proven from public HTML, it must be NOT_AVAILABLE
        createdAt: null,
        createdAtType: 'NOT_AVAILABLE',

        // First time observed by LeadPilot
        firstSeenAt: now,
        lastActivityAt: null,

        source: item.source,
        confidence: verification.confidence,
        createdAtSource: null,

        // Social Intelligence V2 baseline fields
        metricStatus: 'NOT_CONFIGURED',
        metricSource: null,
        metricSourceType: 'NONE',
        followersFetchedAt: null,
        verificationStatus: verification.level === 'HIGH' ? 'VERIFIED' : 'UNVERIFIED',

        // Creation Date Enrichment V2 initial state
        accountCreatedAt: null,
        accountCreatedDatePrecision: null,
        accountCreatedConfidence: null,
        accountCreatedStatus: 'NOT_AVAILABLE',
        accountCreatedSourceType: null,
        accountCreatedSourceUrl: null,
        accountCreatedEvidenceText: null,
        accountCreatedFetchedAt: null,
        firstObservedAt: null,
        firstObservedSourceType: null,
        firstObservedSourceUrl: null,
        firstObservedEvidenceText: null,
        earliestPublicPostAt: null,
        earliestPublicPostSourceUrl: null,

        lastCheckedAt: now,
      };

      profiles.push(profile);

      // Create snapshot baseline
      snapshots.push({
        id: `snap_${profileId}_${now.getTime()}`,
        profileId,
        followers: null,
        following: null,
        posts: null,
        subscribers: null,
        videos: null,
        likes: null,
        isVerified: null,
        metricStatus: 'NOT_CONFIGURED',
        metricSourceType: 'NONE',
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        accountCreatedDatePrecision: null,
        accountCreatedConfidence: null,
        accountCreatedStatus: 'NOT_AVAILABLE',
        accountCreatedSourceType: null,
        accountCreatedSourceUrl: null,
        accountCreatedEvidenceText: null,
        accountCreatedFetchedAt: null,
        firstObservedAt: null,
        firstObservedSourceType: null,
        firstObservedSourceUrl: null,
        firstObservedEvidenceText: null,
        earliestPublicPostAt: null,
        earliestPublicPostSourceUrl: null,
        capturedAt: now,
        source: item.source,
      });
    }

    return { profiles, snapshots };
  }
}

export const socialDiscoveryService = new SocialDiscoveryService();
