/**
 * TikTok Social Metrics Provider
 * 
 * Uses official TikTok API (Display / Research / Open API) where configured.
 * 
 * Strict Single Responsibility:
 * Retrieves follower_count, following_count, likes_count, video_count, is_verified.
 * 
 * Boundary Constraints:
 * - NO HTML scraping.
 * - If credentials or scopes not available, returns NULL and NOT_CONFIGURED or UNAUTHORIZED.
 * - Never invents or infers follower count.
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class TikTokProvider implements ISocialPlatformProvider {
  public readonly platform = 'tiktok' as const;
  public readonly name = 'TikTok Official API';

  public isConfigured(): boolean {
    const token = process.env.TIKTOK_ACCESS_TOKEN;
    const key = process.env.TIKTOK_CLIENT_KEY;
    const secret = process.env.TIKTOK_CLIENT_SECRET;
    return Boolean(token || (key && secret));
  }

  private getAccessToken(): string | null {
    return process.env.TIKTOK_ACCESS_TOKEN || null;
  }

  public getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' {
    return this.isConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }

  public async fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        platform: 'tiktok',
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
        metricSource: 'tiktok_official_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const accessToken = this.getAccessToken();
      // Official TikTok user/info endpoint
      const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count,is_verified,display_name', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'tiktok',
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
            metricSource: 'tiktok_official_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'tiktok',
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
            metricSource: 'tiktok_official_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'tiktok',
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
          metricSource: 'tiktok_official_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      const user = data?.data?.user;
      if (!user) {
        return {
          platform: 'tiktok',
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
          metricSource: 'tiktok_official_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const followerCount = typeof user.follower_count === 'number' ? user.follower_count : null;
      const followingCount = typeof user.following_count === 'number' ? user.following_count : null;
      const likesCount = typeof user.likes_count === 'number' ? user.likes_count : null;
      const videoCount = typeof user.video_count === 'number' ? user.video_count : null;
      const isVerified = typeof user.is_verified === 'boolean' ? user.is_verified : null;

      return {
        platform: 'tiktok',
        profileUrl,
        username: username || null,
        displayName: user.display_name || null,
        followerCount,
        followingCount,
        subscriberCount: null,
        videoCount,
        postCount: videoCount,
        likeCount: likesCount,
        isVerified,
        accountCreatedAt: null, // TikTok API v2 does not expose exact user creation date
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'AVAILABLE',
        metricSource: 'tiktok_official_api',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch {
      return {
        platform: 'tiktok',
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
        metricSource: 'tiktok_official_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }
}

export const tikTokProvider = new TikTokProvider();
