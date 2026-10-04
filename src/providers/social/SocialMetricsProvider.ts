/**
 * Social Metrics Provider Interfaces & Types
 * 
 * Strict Single Responsibility:
 * Defines contracts for platform-specific official API providers.
 * 
 * Boundary Constraints:
 * - ZERO FAKE DATA.
 * - Missing or unauthorized metrics must return NULL.
 * - Never return 0 when a metric is unavailable.
 * - Account creation date only populated if authoritative API returns it.
 */

import {
  SocialMetricStatus,
  MetricSourceType,
  CreationDateType,
  SocialPlatform,
  AccountCreatedStatus,
  AccountCreatedDatePrecision,
  AccountCreatedConfidence,
  AccountCreatedSourceType,
} from '@/types/canonical';

export interface SocialMetricsResult {
  platform: SocialPlatform;
  profileUrl: string;
  username: string | null;
  profileId?: string | null;
  displayName?: string | null;
  isVerified?: boolean | null;

  followerCount: number | null;
  displayFollowerCount?: string | null;
  isRounded?: boolean | null;
  followingCount: number | null;
  subscriberCount: number | null;
  videoCount?: number | null;
  postCount?: number | null;
  likeCount?: number | null;

  accountCreatedAt: Date | null;
  accountCreatedAtType: CreationDateType;

  // Real Social Account Creation Date Enrichment V2
  accountCreatedDatePrecision?: AccountCreatedDatePrecision | null;
  accountCreatedConfidence?: AccountCreatedConfidence | null;
  accountCreatedStatus?: AccountCreatedStatus;
  accountCreatedSourceType?: AccountCreatedSourceType | null;
  accountCreatedSourceUrl?: string | null;
  accountCreatedEvidenceText?: string | null;
  accountCreatedFetchedAt?: Date | null;
  firstObservedAt?: Date | null;
  firstObservedSourceType?: string | null;
  firstObservedSourceUrl?: string | null;
  firstObservedEvidenceText?: string | null;
  earliestPublicPostAt?: Date | null;
  earliestPublicPostSourceUrl?: string | null;

  metricStatus: SocialMetricStatus;
  metricSource: string;
  metricSourceType: MetricSourceType;
  retrievedAt: Date;
  rawResponse?: any;
}

export interface ISocialPlatformProvider {
  readonly platform: SocialPlatform;
  readonly name: string;

  isConfigured(): boolean;
  getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR';
  fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult>;
}

import { youTubeProvider } from './YouTubeProvider';
import { tikTokProvider } from './TikTokProvider';
import { linkedInProvider } from './LinkedInProvider';
import { xProvider } from './XProvider';
import { instagramProvider } from './InstagramProvider';
import { facebookProvider } from './FacebookProvider';

export const SOCIAL_PROVIDERS: Record<string, ISocialPlatformProvider> = {
  youtube: youTubeProvider,
  tiktok: tikTokProvider,
  linkedin: linkedInProvider,
  twitter: xProvider,
  x: xProvider,
  instagram: instagramProvider,
  facebook: facebookProvider,
};

export function getSocialProvider(platform: string): ISocialPlatformProvider | null {
  return SOCIAL_PROVIDERS[platform.toLowerCase()] || null;
}

