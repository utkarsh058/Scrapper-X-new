/**
 * YouTube Social Metrics Provider
 * 
 * Uses official YouTube Data API v3 (`channels.list`).
 * 
 * Strict Single Responsibility:
 * Retrieves channel subscriberCount, videoCount, viewCount.
 * 
 * Boundary Constraints:
 * - NO HTML scraping.
 * - If hiddenSubscriberCount is true, subscriberCount must be NULL.
 * - If not configured or unauthorized, subscriberCount must be NULL with appropriate metricStatus.
 * - Respects Google's rounded subscriber numbers (stored as returned).
 */

import { ISocialPlatformProvider, SocialMetricsResult } from './SocialMetricsProvider';

export class YouTubeProvider implements ISocialPlatformProvider {
  public readonly platform = 'youtube' as const;
  public readonly name = 'YouTube Data API v3';

  public isConfigured(): boolean {
    const key = process.env.YOUTUBE_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  private getApiKey(): string | null {
    return process.env.YOUTUBE_API_KEY || null;
  }

  public getStatus(): 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' {
    return this.isConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED';
  }

  /**
   * Fetches official channel statistics using channels.list
   */
  public async fetchMetrics(profileUrl: string, username?: string | null): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        platform: 'youtube',
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
        metricSource: 'youtube_data_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    const identifier = this.extractIdentifier(profileUrl, username);
    if (!identifier) {
      return {
        platform: 'youtube',
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
        metricSource: 'youtube_data_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const apiKey = this.getApiKey()!;
      let endpoint = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&key=${encodeURIComponent(apiKey)}`;
      if (identifier.type === 'id') {
        endpoint += `&id=${encodeURIComponent(identifier.value)}`;
      } else if (identifier.type === 'handle') {
        endpoint += `&forHandle=${encodeURIComponent(identifier.value)}`;
      } else {
        endpoint += `&forUsername=${encodeURIComponent(identifier.value)}`;
      }

      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return {
            platform: 'youtube',
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
            metricSource: 'youtube_data_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }
        if (res.status === 429) {
          return {
            platform: 'youtube',
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
            metricSource: 'youtube_data_api',
            metricSourceType: 'NONE',
            retrievedAt: now,
          };
        }

        return {
          platform: 'youtube',
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
          metricSource: 'youtube_data_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        return {
          platform: 'youtube',
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
          metricSource: 'youtube_data_api',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const channel = data.items[0];
      const stats = channel.statistics || {};
      const snippet = channel.snippet || {};

      const hiddenSubscriberCount = stats.hiddenSubscriberCount === true;
      let subscribers: number | null = null;
      if (!hiddenSubscriberCount && stats.subscriberCount !== undefined && stats.subscriberCount !== null) {
        subscribers = parseInt(stats.subscriberCount, 10);
        if (isNaN(subscribers)) subscribers = null;
      }

      let videos: number | null = null;
      if (stats.videoCount !== undefined && stats.videoCount !== null) {
        videos = parseInt(stats.videoCount, 10);
        if (isNaN(videos)) videos = null;
      }

      // Authoritative creation date
      let accountCreatedAt: Date | null = null;
      let accountCreatedAtType: 'OFFICIAL_API' | 'NOT_AVAILABLE' = 'NOT_AVAILABLE';
      if (snippet.publishedAt) {
        const d = new Date(snippet.publishedAt);
        if (!isNaN(d.getTime())) {
          accountCreatedAt = d;
          accountCreatedAtType = 'OFFICIAL_API';
        }
      }

      return {
        platform: 'youtube',
        profileUrl,
        username: snippet.customUrl || username || null,
        profileId: channel.id || null,
        displayName: snippet.title || null,
        followerCount: subscribers, // In social context, subscribers count as follower pool
        followingCount: null,
        subscriberCount: subscribers,
        videoCount: videos,
        postCount: videos,
        likeCount: null,
        isVerified: null,
        accountCreatedAt,
        accountCreatedAtType,
        metricStatus: 'AVAILABLE',
        metricSource: 'youtube_data_api',
        metricSourceType: 'OFFICIAL_API',
        retrievedAt: now,
      };
    } catch (err: any) {
      return {
        platform: 'youtube',
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
        metricSource: 'youtube_data_api',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }

  private extractIdentifier(url: string, username?: string | null): { type: 'id' | 'handle' | 'username'; value: string } | null {
    if (url.includes('/channel/')) {
      const parts = url.split('/channel/');
      const id = parts[1]?.split(/[\/?#]/)[0];
      if (id) return { type: 'id', value: id };
    }
    if (url.includes('/@')) {
      const parts = url.split('/@');
      const handle = parts[1]?.split(/[\/?#]/)[0];
      if (handle) return { type: 'handle', value: `@${handle}` };
    }
    if (username) {
      const clean = username.replace(/^@/, '');
      return { type: 'handle', value: `@${clean}` };
    }
    return null;
  }
}

export const youTubeProvider = new YouTubeProvider();
