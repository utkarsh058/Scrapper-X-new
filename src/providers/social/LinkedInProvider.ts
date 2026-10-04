/**
 * LinkedIn Social Metrics Provider
 * 
 * Uses official LinkedIn Community Management / Organization Network Sizes API.
 * 
 * Strict Single Responsibility:
 * Retrieves organization follower counts for authorized organizations.
 * 
 * Boundary Constraints:
 * - NO HTML scraping.
 * - Having a LinkedIn URL does NOT mean follower statistics are accessible.
 * - Returns NULL and UNAUTHORIZED or NOT_CONFIGURED when organization authorization is absent.
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class LinkedInProvider implements ISocialPlatformProvider {
  public readonly platform = 'linkedin' as const;
  public readonly name = 'LinkedIn Official API';

  public isConfigured(): boolean {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const id = process.env.LINKEDIN_CLIENT_ID;
    const secret = process.env.LINKEDIN_CLIENT_SECRET;
    return Boolean(token || (id && secret));
  }

  private getAccessToken(): string | null {
    return process.env.LINKEDIN_ACCESS_TOKEN || null;
  }

  public getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' {
    return this.isConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }

  public async fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        platform: 'linkedin',
        profileUrl,
        username: username || null,
        followerCount: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'NOT_CONFIGURED',
        metricSource: 'linkedin_official_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    const orgId = this.extractOrgId(profileUrl, username);
    if (!orgId) {
      return {
        platform: 'linkedin',
        profileUrl,
        username: username || null,
        followerCount: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'PROFILE_NOT_FOUND',
        metricSource: 'linkedin_official_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const accessToken = this.getAccessToken();
      // Official LinkedIn organization network sizes API
      const res = await fetch(`https://api.linkedin.com/v2/networkSizes/urn:li:organization:${encodeURIComponent(orgId)}?edgeType=CompanyFollowedByMember`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'linkedin',
            profileUrl,
            username: username || null,
            followerCount: null,
            followingCount: null,
            subscriberCount: null,
            videoCount: null,
            postCount: null,
            likeCount: null,
            isVerified: null,
            accountCreatedAt: null,
            accountCreatedAtType: 'NOT_AVAILABLE',
            metricStatus: 'UNAUTHORIZED',
            metricSource: 'linkedin_official_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'linkedin',
            profileUrl,
            username: username || null,
            followerCount: null,
            followingCount: null,
            subscriberCount: null,
            videoCount: null,
            postCount: null,
            likeCount: null,
            isVerified: null,
            accountCreatedAt: null,
            accountCreatedAtType: 'NOT_AVAILABLE',
            metricStatus: 'RATE_LIMITED',
            metricSource: 'linkedin_official_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'linkedin',
          profileUrl,
          username: username || null,
          followerCount: null,
          followingCount: null,
          subscriberCount: null,
          videoCount: null,
          postCount: null,
          likeCount: null,
          isVerified: null,
          accountCreatedAt: null,
          accountCreatedAtType: 'NOT_AVAILABLE',
          metricStatus: 'API_ERROR',
          metricSource: 'linkedin_official_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      const firstDegreeSize = typeof data.firstDegreeSize === 'number' ? data.firstDegreeSize : null;

      return {
        platform: 'linkedin',
        profileUrl,
        username: username || null,
        followerCount: firstDegreeSize,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: firstDegreeSize !== null ? 'AVAILABLE' : 'NOT_AVAILABLE',
        metricSource: 'linkedin_official_api',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch {
      return {
        platform: 'linkedin',
        profileUrl,
        username: username || null,
        followerCount: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'API_ERROR',
        metricSource: 'linkedin_official_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }

  private extractOrgId(url: string, username?: string | null): string | null {
    if (url.includes('/company/')) {
      const parts = url.split('/company/');
      const slug = parts[1]?.split(/[\/?#]/)[0];
      if (slug) return slug;
    }
    return username || null;
  }
}

export const linkedInProvider = new LinkedInProvider();
