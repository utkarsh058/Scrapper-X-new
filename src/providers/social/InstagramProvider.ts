/**
 * Instagram Social Metrics Provider
 * 
 * Uses official Meta Graph API (`{instagram_business_account_id}?fields=followers_count...`).
 * 
 * Strict Single Responsibility:
 * Retrieves follower count for authorized Instagram Business/Creator accounts.
 * 
 * Boundary Constraints:
 * - NO unauthenticated or arbitrary scraping.
 * - Only official Meta Graph API.
 * - If not configured or account not authorized/mapped, returns NULL and NOT_CONFIGURED or UNAUTHORIZED.
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class InstagramProvider implements ISocialPlatformProvider {
  public readonly platform = 'instagram' as const;
  public readonly name = 'Meta Graph API (Instagram)';

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
        platform: 'instagram',
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

    const cleanUsername = this.extractUsername(profileUrl, username);
    if (!cleanUsername) {
      return {
        platform: 'instagram',
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
      // In Meta Graph API, querying arbitrary Instagram users requires Instagram Business Discovery API
      // endpoint: GET /v21.0/{ig-user-id}?fields=business_discovery.username({username}){followers_count,media_count,name}
      const igUserId = process.env.META_IG_USER_ID || 'me';
      const endpoint = `https://graph.facebook.com/v21.0/${igUserId}?fields=business_discovery.username(${encodeURIComponent(cleanUsername)}){followers_count,follows_count,media_count,name}&access_token=${encodeURIComponent(accessToken)}`;

      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'instagram',
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
            metricSource: 'meta_graph_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'instagram',
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
            metricSource: 'meta_graph_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'instagram',
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
          metricSource: 'meta_graph_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      const discovery = data?.business_discovery;
      if (!discovery) {
        return {
          platform: 'instagram',
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
          metricStatus: 'NOT_AVAILABLE',
          metricSource: 'meta_graph_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const followers = typeof discovery.followers_count === 'number' ? discovery.followers_count : null;
      const following = typeof discovery.follows_count === 'number' ? discovery.follows_count : null;
      const media = typeof discovery.media_count === 'number' ? discovery.media_count : null;

      return {
        platform: 'instagram',
        profileUrl,
        username: cleanUsername,
        displayName: discovery.name || null,
        followerCount: followers,
        followingCount: following,
        subscriberCount: null,
        videoCount: null,
        postCount: media,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null, // Meta Graph API does not expose creation date
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'AVAILABLE',
        metricSource: 'meta_graph_api',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch {
      return {
        platform: 'instagram',
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
        metricSource: 'meta_graph_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }

  private extractUsername(url: string, username?: string | null): string | null {
    if (username) return username.replace(/^@/, '').trim();
    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i);
    return match ? match[1] : null;
  }
}

export const instagramProvider = new InstagramProvider();
