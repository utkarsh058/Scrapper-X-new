/**
 * X / Twitter Social Metrics Provider
 * 
 * Uses official X API v2 (`users/by/username/:username`).
 * 
 * Strict Single Responsibility:
 * Retrieves followers_count, following_count, tweet_count, verified status, and created_at.
 * 
 * Boundary Constraints:
 * - NO HTML scraping of x.com or twitter.com.
 * - Only official API v2 endpoints.
 * - If not configured or unauthorized, returns NULL and NOT_CONFIGURED.
 * - Sets accountCreatedAt only from authoritative created_at field.
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class XProvider implements ISocialPlatformProvider {
  public readonly platform = 'twitter' as const;
  public readonly name = 'X (Twitter) API v2';

  public isConfigured(): boolean {
    const bearer = process.env.X_ACCESS_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    const id = process.env.X_CLIENT_ID;
    const secret = process.env.X_CLIENT_SECRET;
    return Boolean(bearer || (id && secret));
  }

  private getBearerToken(): string | null {
    return process.env.X_ACCESS_TOKEN || process.env.TWITTER_BEARER_TOKEN || null;
  }

  public getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' {
    return this.isConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }

  public async fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        platform: 'twitter',
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
        metricSource: 'x_api_v2',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    const cleanUsername = this.extractUsername(profileUrl, username);
    if (!cleanUsername) {
      return {
        platform: 'twitter',
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
        metricSource: 'x_api_v2',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const bearerToken = this.getBearerToken();
      const endpoint = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(cleanUsername)}?user.fields=public_metrics,verified,created_at,description`;
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'twitter',
            profileUrl,
            username: cleanUsername,
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
            metricSource: 'x_api_v2',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'twitter',
            profileUrl,
            username: cleanUsername,
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
            metricSource: 'x_api_v2',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'twitter',
          profileUrl,
          username: cleanUsername,
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
          metricSource: 'x_api_v2',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      const user = data?.data;
      if (!user) {
        return {
          platform: 'twitter',
          profileUrl,
          username: cleanUsername,
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
          metricSource: 'x_api_v2',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const metrics = user.public_metrics || {};
      const followers = typeof metrics.followers_count === 'number' ? metrics.followers_count : null;
      const following = typeof metrics.following_count === 'number' ? metrics.following_count : null;
      const posts = typeof metrics.tweet_count === 'number' ? metrics.tweet_count : null;
      const likes = typeof metrics.like_count === 'number' ? metrics.like_count : null;
      const isVerified = typeof user.verified === 'boolean' ? user.verified : null;

      let accountCreatedAt: Date | null = null;
      let accountCreatedAtType: 'OFFICIAL_API' | 'NOT_AVAILABLE' = 'NOT_AVAILABLE';
      if (user.created_at) {
        const d = new Date(user.created_at);
        if (!isNaN(d.getTime())) {
          accountCreatedAt = d;
          accountCreatedAtType = 'OFFICIAL_API';
        }
      }

      return {
        platform: 'twitter',
        profileUrl,
        username: user.username || cleanUsername,
        profileId: user.id || null,
        displayName: user.name || null,
        followerCount: followers,
        followingCount: following,
        subscriberCount: null,
        videoCount: null,
        postCount: posts,
        likeCount: likes,
        isVerified,
        accountCreatedAt,
        accountCreatedAtType,
        metricStatus: 'AVAILABLE',
        metricSource: 'x_api_v2',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch {
      return {
        platform: 'twitter',
        profileUrl,
        username: cleanUsername,
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
        metricSource: 'x_api_v2',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }

  private extractUsername(url: string, username?: string | null): string | null {
    if (username) return username.replace(/^@/, '').trim();
    const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)/i);
    return match ? match[1] : null;
  }
}

export const xProvider = new XProvider();
