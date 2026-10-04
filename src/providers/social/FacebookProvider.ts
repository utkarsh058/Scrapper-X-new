/**
 * Facebook Social Metrics Provider
 * 
 * Uses official Meta Graph API (`/{page_id}?fields=followers_count,fan_count`).
 * 
 * Strict Single Responsibility:
 * Retrieves follower and fan count for authorized/public Facebook Pages.
 * 
 * Boundary Constraints:
 * - NO HTML scraping of facebook.com.
 * - Only official Meta Graph API.
 * - If not configured or page metrics cannot legitimately be retrieved, returns NULL and NOT_CONFIGURED.
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class FacebookProvider implements ISocialPlatformProvider {
  public readonly platform = 'facebook' as const;
  public readonly name = 'Meta Graph API (Facebook)';

  public isConfigured(): boolean {
    const token = process.env.META_ACCESS_TOKEN;
    const app = process.env.META_APP_ID;
    const secret = process.env.META_APP_SECRET;
    return Boolean(token || (app && secret));
  }

  private getAccessToken(): string | null {
    return process.env.META_ACCESS_TOKEN || null;
  }

  public getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' {
    return this.isConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }

  public async fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        platform: 'facebook',
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
        metricSource: 'meta_graph_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    const pageId = this.extractPageId(profileUrl, username);
    if (!pageId) {
      return {
        platform: 'facebook',
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
        metricSource: 'meta_graph_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const accessToken = this.getAccessToken()!;
      const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?fields=followers_count,fan_count,name,verification_status&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'facebook',
            profileUrl,
            username: pageId,
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
            metricSource: 'meta_graph_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'facebook',
            profileUrl,
            username: pageId,
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
            metricSource: 'meta_graph_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'facebook',
          profileUrl,
          username: pageId,
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
          metricSource: 'meta_graph_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      const followers = typeof data.followers_count === 'number' ? data.followers_count : null;
      const fanCount = typeof data.fan_count === 'number' ? data.fan_count : null;
      const isVerified = data.verification_status === 'blue_verified' || data.verification_status === 'grey_verified';

      return {
        platform: 'facebook',
        profileUrl,
        username: pageId,
        displayName: data.name || null,
        followerCount: followers || fanCount,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: fanCount,
        isVerified: isVerified ? true : null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: (followers !== null || fanCount !== null) ? 'AVAILABLE' : 'NOT_AVAILABLE',
        metricSource: 'meta_graph_api',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch {
      return {
        platform: 'facebook',
        profileUrl,
        username: pageId,
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
        metricSource: 'meta_graph_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }

  private extractPageId(url: string, username?: string | null): string | null {
    if (username) return username.replace(/^@/, '').trim();
    const match = url.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.-]+)/i);
    return match ? match[1] : null;
  }
}

export const facebookProvider = new FacebookProvider();
