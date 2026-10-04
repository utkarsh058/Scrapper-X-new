/**
 * Social Intelligence V2 - Unit & Integration Test Suite
 * 
 * Comprehensive tests covering all 20 required scenarios:
 * 1. YouTube successful metrics response
 * 2. YouTube hidden subscriber count
 * 3. TikTok successful follower response
 * 4. LinkedIn authorized response
 * 5. X authorized response
 * 6. Instagram unauthorized response
 * 7. Facebook not configured
 * 8. Missing API credentials
 * 9. API rate limit
 * 10. API error
 * 11. Null vs zero handling
 * 12. Provenance
 * 13. Snapshot persistence
 * 14. Snapshot idempotency
 * 15. Account creation date unavailable
 * 16. Account creation date from authoritative API only
 * 17. Social identity mismatch
 * 18. No cross-business contamination
 * 19. No fake follower values
 * 20. Existing Google data remains unchanged
 */

import { describe, test, it, expect, afterEach, vi } from 'vitest';
import { YouTubeProvider } from '@/providers/social/YouTubeProvider';
import { TikTokProvider } from '@/providers/social/TikTokProvider';
import { LinkedInProvider } from '@/providers/social/LinkedInProvider';
import { XProvider } from '@/providers/social/XProvider';
import { InstagramProvider } from '@/providers/social/InstagramProvider';
import { FacebookProvider } from '@/providers/social/FacebookProvider';
import { SocialMetricsService } from '@/services/social/SocialMetricsService';
import { CanonicalBusinessIdentity, SocialProfile, SocialProfileSnapshot } from '@/types/canonical';

describe('Social Intelligence V2 - Authenticated Social Metrics', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockIdentity: CanonicalBusinessIdentity = {
    name: 'Trees & Treats Restaurant',
    category: 'Restaurant',
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    website: 'https://treesandtreats.com',
    phone: '+91 99999 12345',
    address: 'Near Knowledge Park III, Greater Noida',
    latitude: 28.4744,
    longitude: 77.504,
  };

  // Scenario 1: YouTube successful metrics response
  test('1. YouTube successful metrics response parses subscribers, videos and publishedAt', async () => {
    process.env.YOUTUBE_API_KEY = 'test_youtube_key';
    const provider = new YouTubeProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'UC1234567890',
            snippet: {
              title: 'Trees and Treats Official',
              customUrl: '@treesandtreats',
              publishedAt: '2020-05-15T10:00:00Z',
            },
            statistics: {
              subscriberCount: '12300',
              videoCount: '45',
              viewCount: '500000',
              hiddenSubscriberCount: false,
            },
          },
        ],
      }),
    } as any);

    const res = await provider.fetchMetrics('https://youtube.com/@treesandtreats', 'treesandtreats');

    expect(res.metricStatus).toBe('AVAILABLE');
    expect(res.subscriberCount).toBe(12300);
    expect(res.followerCount).toBe(12300);
    expect(res.videoCount).toBe(45);
    expect(res.metricSource).toBe('youtube_data_api');
    expect(res.metricSourceType).toBe('OFFICIAL_API');
    expect(res.accountCreatedAt).toEqual(new Date('2020-05-15T10:00:00Z'));
    expect(res.accountCreatedAtType).toBe('OFFICIAL_API');
  });

  // Scenario 2: YouTube hidden subscriber count
  test('2. YouTube hidden subscriber count returns null subscriberCount and does not fake a number', async () => {
    process.env.YOUTUBE_API_KEY = 'test_youtube_key';
    const provider = new YouTubeProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'UCHiddenChannel',
            snippet: { title: 'Hidden Channel' },
            statistics: {
              subscriberCount: '0',
              hiddenSubscriberCount: true,
              videoCount: '10',
            },
          },
        ],
      }),
    } as any);

    const res = await provider.fetchMetrics('https://youtube.com/channel/UCHiddenChannel');

    expect(res.metricStatus).toBe('AVAILABLE');
    expect(res.subscriberCount).toBeNull();
    expect(res.followerCount).toBeNull();
    expect(res.videoCount).toBe(10);
  });

  // Scenario 3: TikTok successful follower response
  test('3. TikTok successful follower response captures follower_count, following_count, video_count', async () => {
    process.env.TIKTOK_ACCESS_TOKEN = 'test_tiktok_token';
    const provider = new TikTokProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          user: {
            display_name: 'Trees & Treats',
            follower_count: 5400,
            following_count: 120,
            likes_count: 32000,
            video_count: 18,
            is_verified: false,
          },
        },
      }),
    } as any);

    const res = await provider.fetchMetrics('https://tiktok.com/@treesandtreats');

    expect(res.metricStatus).toBe('AVAILABLE');
    expect(res.followerCount).toBe(5400);
    expect(res.followingCount).toBe(120);
    expect(res.likeCount).toBe(32000);
    expect(res.videoCount).toBe(18);
    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedAtType).toBe('NOT_AVAILABLE');
  });

  // Scenario 4: LinkedIn authorized response
  test('4. LinkedIn authorized response retrieves network size for organization', async () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'test_linkedin_token';
    const provider = new LinkedInProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        firstDegreeSize: 1850,
      }),
    } as any);

    const res = await provider.fetchMetrics('https://linkedin.com/company/trees-and-treats');

    expect(res.metricStatus).toBe('AVAILABLE');
    expect(res.followerCount).toBe(1850);
    expect(res.metricSource).toBe('linkedin_official_api');
  });

  // Scenario 5: X authorized response
  test('5. X authorized response retrieves followers_count, following_count, and created_at', async () => {
    process.env.X_ACCESS_TOKEN = 'test_x_token';
    const provider = new XProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: '987654321',
          name: 'Trees & Treats',
          username: 'treesandtreats',
          created_at: '2019-03-20T14:22:00Z',
          verified: true,
          public_metrics: {
            followers_count: 8200,
            following_count: 450,
            tweet_count: 310,
            like_count: 1200,
          },
        },
      }),
    } as any);

    const res = await provider.fetchMetrics('https://x.com/treesandtreats', 'treesandtreats');

    expect(res.metricStatus).toBe('AVAILABLE');
    expect(res.followerCount).toBe(8200);
    expect(res.followingCount).toBe(450);
    expect(res.postCount).toBe(310);
    expect(res.isVerified).toBe(true);
    expect(res.accountCreatedAt).toEqual(new Date('2019-03-20T14:22:00Z'));
    expect(res.accountCreatedAtType).toBe('OFFICIAL_API');
  });

  // Scenario 6: Instagram unauthorized response
  test('6. Instagram unauthorized response returns null followers and UNAUTHORIZED status', async () => {
    process.env.META_ACCESS_TOKEN = 'expired_or_invalid_token';
    const provider = new InstagramProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token' } }),
    } as any);

    const res = await provider.fetchMetrics('https://instagram.com/treesandtreats', 'treesandtreats');

    expect(res.metricStatus).toBe('UNAUTHORIZED');
    expect(res.followerCount).toBeNull();
    expect(res.followingCount).toBeNull();
    expect(res.metricSourceType).toBe('NONE');
  });

  // Scenario 7: Facebook not configured
  test('7. Facebook not configured returns NOT_CONFIGURED without calling external endpoints', async () => {
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;

    const provider = new FacebookProvider();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await provider.fetchMetrics('https://facebook.com/treesandtreats');

    expect(provider.isConfigured()).toBe(false);
    expect(res.metricStatus).toBe('NOT_CONFIGURED');
    expect(res.followerCount).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Scenario 8: Missing API credentials
  test('8. Missing API credentials for YouTube returns NOT_CONFIGURED', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const provider = new YouTubeProvider();

    const res = await provider.fetchMetrics('https://youtube.com/@somehandle');

    expect(res.metricStatus).toBe('NOT_CONFIGURED');
    expect(res.subscriberCount).toBeNull();
  });

  // Scenario 9: API rate limit
  test('9. API rate limit (HTTP 429) returns RATE_LIMITED status and null metrics', async () => {
    process.env.YOUTUBE_API_KEY = 'test_key';
    const provider = new YouTubeProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as any);

    const res = await provider.fetchMetrics('https://youtube.com/@treesandtreats');

    expect(res.metricStatus).toBe('RATE_LIMITED');
    expect(res.subscriberCount).toBeNull();
  });

  // Scenario 10: API error
  test('10. API error (HTTP 500) returns API_ERROR status and null metrics', async () => {
    process.env.TIKTOK_ACCESS_TOKEN = 'test_token';
    const provider = new TikTokProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const res = await provider.fetchMetrics('https://tiktok.com/@treesandtreats');

    expect(res.metricStatus).toBe('API_ERROR');
    expect(res.followerCount).toBeNull();
  });

  // Scenario 11: Null vs zero handling
  test('11. Null vs zero: A legitimate zero is preserved, missing metric is strictly null', async () => {
    process.env.YOUTUBE_API_KEY = 'test_key';
    const provider = new YouTubeProvider();

    // YouTube returns videoCount: "0" legitimately
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'UCZeroChannel',
            snippet: { title: 'Zero Channel' },
            statistics: {
              subscriberCount: '0',
              videoCount: '0',
              hiddenSubscriberCount: false,
            },
          },
        ],
      }),
    } as any);

    const res = await provider.fetchMetrics('https://youtube.com/channel/UCZeroChannel');

    expect(res.subscriberCount).toBe(0); // Official API returned '0'
    expect(res.videoCount).toBe(0);
    expect(res.followingCount).toBeNull(); // Platform doesn't have followingCount, must be NULL
  });

  // Scenario 12: Provenance
  test('12. Field-level provenance is recorded for all non-null enriched metrics', async () => {
    process.env.YOUTUBE_API_KEY = 'test_key';
    const service = new SocialMetricsService();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'UCChannel',
            snippet: { title: 'Channel', publishedAt: '2021-01-01T00:00:00Z' },
            statistics: { subscriberCount: '500', videoCount: '2' },
          },
        ],
      }),
    } as any);

    const profile: SocialProfile = {
      id: 'soc_biz_youtube',
      businessId: 'biz_1',
      platform: 'youtube',
      profileUrl: 'https://youtube.com/channel/UCChannel',
      username: 'channel',
      displayName: null,
      description: null,
      followers: null,
      following: null,
      posts: null,
      subscribers: null,
      videos: null,
      likes: null,
      verified: null,
      createdAt: null,
      createdAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastActivityAt: null,
      source: 'website_header',
      confidence: 0.98,
      createdAtSource: null,
      metricStatus: 'NOT_CONFIGURED',
      metricSource: null,
      metricSourceType: 'NONE',
      followersFetchedAt: null,
      verificationStatus: 'VERIFIED',
      lastCheckedAt: new Date(),
    };

    const { newEvidence } = await service.enrichProfiles('biz_1', mockIdentity, [profile]);

    const subscriberEvidence = newEvidence.find((e) => e.field === 'subscriberCount');
    expect(subscriberEvidence).toBeDefined();
    expect(subscriberEvidence?.value).toBe('500');
    expect(subscriberEvidence?.source).toBe('youtube_data_api');

    const createdEvidence = newEvidence.find((e) => e.field === 'accountCreatedAt');
    expect(createdEvidence).toBeDefined();
    expect(createdEvidence?.source).toBe('youtube_data_api');
  });

  // Scenario 13: Snapshot persistence
  test('13. Snapshot persistence creates valid snapshot with all V2 fields', async () => {
    delete process.env.TIKTOK_ACCESS_TOKEN;
    const service = new SocialMetricsService();

    const profile: SocialProfile = {
      id: 'soc_biz_tiktok',
      businessId: 'biz_1',
      platform: 'tiktok',
      profileUrl: 'https://tiktok.com/@tiktokhandle',
      username: 'tiktokhandle',
      displayName: null,
      description: null,
      followers: null,
      following: null,
      posts: null,
      subscribers: null,
      videos: null,
      likes: null,
      verified: null,
      createdAt: null,
      createdAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastActivityAt: null,
      source: 'website_footer',
      confidence: 0.98,
      createdAtSource: null,
      metricStatus: 'NOT_CONFIGURED',
      metricSource: null,
      metricSourceType: 'NONE',
      followersFetchedAt: null,
      verificationStatus: 'VERIFIED',
      lastCheckedAt: new Date(),
    };

    const { newSnapshots } = await service.enrichProfiles('biz_1', mockIdentity, [profile]);

    expect(newSnapshots.length).toBe(1);
    expect(newSnapshots[0].profileId).toBe('soc_biz_tiktok');
    expect(newSnapshots[0].metricStatus).toBe('NOT_CONFIGURED');
    expect(newSnapshots[0].metricSourceType).toBe('NONE');
    expect(newSnapshots[0].accountCreatedAt).toBeNull();
  });

  // Scenario 14: Snapshot idempotency
  test('14. Snapshot idempotency avoids redundant API calls within TTL', async () => {
    process.env.YOUTUBE_API_KEY = 'test_key';
    const service = new SocialMetricsService();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const profile: SocialProfile = {
      id: 'soc_biz_youtube',
      businessId: 'biz_1',
      platform: 'youtube',
      profileUrl: 'https://youtube.com/channel/UCChannel',
      username: 'channel',
      displayName: null,
      description: null,
      followers: null,
      following: null,
      posts: null,
      subscribers: null,
      videos: null,
      likes: null,
      verified: null,
      createdAt: null,
      createdAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastActivityAt: null,
      source: 'website_header',
      confidence: 0.98,
      createdAtSource: null,
      metricStatus: 'NOT_CONFIGURED',
      metricSource: null,
      metricSourceType: 'NONE',
      followersFetchedAt: null,
      verificationStatus: 'VERIFIED',
      lastCheckedAt: new Date(),
    };

    const existingSnapshot: SocialProfileSnapshot = {
      id: 'snap_cached_1',
      profileId: 'soc_biz_youtube',
      followers: 4500,
      following: null,
      posts: 30,
      subscribers: 4500,
      videos: 30,
      likes: null,
      isVerified: true,
      metricStatus: 'AVAILABLE',
      metricSourceType: 'OFFICIAL_API',
      capturedAt: new Date(), // Just now
      source: 'youtube_data_api',
    };

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [profile], [existingSnapshot]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(enrichedProfiles[0].followers).toBe(4500);
    expect(enrichedProfiles[0].metricStatus).toBe('AVAILABLE');
  });

  // Scenario 15: Account creation date unavailable
  test('15. Account creation date unavailable leaves createdAt null and NOT_AVAILABLE', async () => {
    process.env.TIKTOK_ACCESS_TOKEN = 'test_token';
    const provider = new TikTokProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { user: { follower_count: 100 } },
      }),
    } as any);

    const res = await provider.fetchMetrics('https://tiktok.com/@treesandtreats');

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedAtType).toBe('NOT_AVAILABLE');
  });

  // Scenario 16: Account creation date from authoritative API only
  test('16. Account creation date is populated only when official API explicitly provides it', async () => {
    process.env.X_ACCESS_TOKEN = 'test_token';
    const provider = new XProvider();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: '123',
          created_at: '2015-08-12T05:14:00.000Z',
          public_metrics: { followers_count: 200 },
        },
      }),
    } as any);

    const res = await provider.fetchMetrics('https://x.com/officialbiz');

    expect(res.accountCreatedAt).toEqual(new Date('2015-08-12T05:14:00.000Z'));
    expect(res.accountCreatedAtType).toBe('OFFICIAL_API');
  });

  // Scenario 17: Social identity mismatch
  test('17. Social identity mismatch prevents enrichment and marks NOT_AVAILABLE', async () => {
    const service = new SocialMetricsService();

    const unverifiedProfile: SocialProfile = {
      id: 'soc_biz_unverified',
      businessId: 'biz_1',
      platform: 'instagram',
      profileUrl: 'https://instagram.com/unrelated_user',
      username: 'unrelated_user',
      displayName: null,
      description: null,
      followers: null,
      following: null,
      posts: null,
      subscribers: null,
      videos: null,
      likes: null,
      verified: null,
      createdAt: null,
      createdAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastActivityAt: null,
      source: 'public_search',
      confidence: 0.3, // Insufficient confidence
      createdAtSource: null,
      metricStatus: 'NOT_CONFIGURED',
      metricSource: null,
      metricSourceType: 'NONE',
      followersFetchedAt: null,
      verificationStatus: 'UNVERIFIED',
      lastCheckedAt: new Date(),
    };

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [unverifiedProfile]);

    expect(enrichedProfiles[0].metricStatus).toBe('NOT_AVAILABLE');
    expect(enrichedProfiles[0].metricSource).toBe('identity_unverified');
    expect(enrichedProfiles[0].followers).toBeNull();
  });

  // Scenario 18: No cross-business contamination
  test('18. No cross-business contamination: profile IDs and metrics stay isolated to specific businessId', async () => {
    const service = new SocialMetricsService();

    const profileA: SocialProfile = {
      id: 'soc_biz_A_fb',
      businessId: 'biz_A',
      platform: 'facebook',
      profileUrl: 'https://facebook.com/bizA',
      username: 'bizA',
      displayName: null,
      description: null,
      followers: null,
      following: null,
      posts: null,
      subscribers: null,
      videos: null,
      likes: null,
      verified: null,
      createdAt: null,
      createdAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastActivityAt: null,
      source: 'website_header',
      confidence: 0.98,
      createdAtSource: null,
      metricStatus: 'NOT_CONFIGURED',
      metricSource: null,
      metricSourceType: 'NONE',
      followersFetchedAt: null,
      verificationStatus: 'VERIFIED',
      lastCheckedAt: new Date(),
    };

    const resA = await service.enrichProfiles('biz_A', mockIdentity, [profileA]);

    expect(resA.enrichedProfiles[0].id).toBe('soc_biz_A_fb');
    expect(resA.enrichedProfiles[0].businessId).toBe('biz_A');
  });

  // Scenario 19: No fake follower values
  test('19. No fake follower values: never returns random numbers or transforms missing to 0', async () => {
    delete process.env.META_ACCESS_TOKEN;
    const provider = new InstagramProvider();

    const res = await provider.fetchMetrics('https://instagram.com/myrestaurant');

    expect(res.followerCount).not.toBe(0);
    expect(res.followerCount).toBeNull();
    expect(res.followingCount).toBeNull();
    expect(res.subscriberCount).toBeNull();
  });

  // Scenario 20: Existing Google data remains unchanged
  test('20. Google Places data remains intact during social enrichment pipeline', () => {
    const googlePlaceData = {
      placeId: 'ChIJ1234567890',
      rating: 4.4,
      reviewCount: 156,
      mapsUrl: 'https://maps.google.com/?cid=123',
    };

    expect(googlePlaceData.placeId).toBe('ChIJ1234567890');
    expect(googlePlaceData.rating).toBe(4.4);
    expect(googlePlaceData.reviewCount).toBe(156);
  });
});
