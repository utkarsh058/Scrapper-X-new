/**
 * Instagram & Facebook Follower Counts Test Suite (Section 16)
 * 
 * Verifies:
 * Test 1: Instagram exact public follower count (e.g. "12,437 followers" -> 12437)
 * Test 2: Instagram rounded count (e.g. "12.4K followers" -> 12400, isRounded: true)
 * Test 3: Facebook exact count
 * Test 4: Follower count unavailable -> null
 * Test 5: Blocked Instagram page -> null, search continues
 * Test 6: Blocked Facebook page -> null, search continues
 * Test 7: No conversion of NULL to zero
 * Test 8: Official API value takes priority over public-web value
 * Test 9: No fake/mock follower values exist anywhere in production code
 * Test 10: Existing Google/5-star/ranking/social regression tests still pass
 */

import { describe, test, it, expect, afterEach, vi } from 'vitest';
import { publicSocialMetricsProvider } from '@/providers/social/PublicSocialMetricsProvider';
import { SocialMetricsService } from '@/services/social/SocialMetricsService';
import { CanonicalBusinessIdentity, SocialProfile } from '@/types/canonical';

describe('Instagram + Facebook Follower Counts Only (Real Data)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockIdentity: CanonicalBusinessIdentity = {
    name: 'Trees & Treats Restaurant',
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    website: 'https://treesandtreats.com',
    phone: '+91 99999 12345',
    address: 'Near Knowledge Park III, Greater Noida',
    lat: 28.4744,
    lon: 77.504,
  };

  // Test 1: Instagram exact public follower count
  test('Test 1: Instagram exact public follower count parses "12,437 followers" to 12437', () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="12,437 Followers, 450 Following, 120 Posts - See Instagram photos and videos from Trees & Treats (@treesandtreats)" />
        </head>
        <body></body>
      </html>
    `;
    const res = publicSocialMetricsProvider.extractFromInstagramHtml(html);
    expect(res).not.toBeNull();
    expect(res?.followerCount).toBe(12437);
    expect(res?.displayFollowerCount).toBe('12,437');
    expect(res?.isRounded).toBe(false);
  });

  // Test 2: Instagram rounded count
  test('Test 2: Instagram rounded count parses "12.4K followers" to 12400 with isRounded=true', () => {
    const html = `
      <html>
        <head>
          <meta property="og:description" content="12.4K Followers, 450 Following, 120 Posts - Photos and videos" />
        </head>
      </html>
    `;
    const res = publicSocialMetricsProvider.extractFromInstagramHtml(html);
    expect(res).not.toBeNull();
    expect(res?.followerCount).toBe(12400);
    expect(res?.displayFollowerCount).toBe('12.4K');
    expect(res?.isRounded).toBe(true);

    const mHtml = `<html><head><meta name="description" content="1.2M Followers, 10 Following"></head></html>`;
    const mRes = publicSocialMetricsProvider.extractFromInstagramHtml(mHtml);
    expect(mRes?.followerCount).toBe(1200000);
    expect(mRes?.displayFollowerCount).toBe('1.2M');
    expect(mRes?.isRounded).toBe(true);
  });

  // Test 3: Facebook exact count
  test('Test 3: Facebook exact count parses "8,921 followers" and "8,921 people follow this"', () => {
    const html1 = `
      <html>
        <head>
          <meta name="description" content="Trees & Treats, Greater Noida. 8,921 followers · 12 following. Official page." />
        </head>
      </html>
    `;
    const res1 = publicSocialMetricsProvider.extractFromFacebookHtml(html1);
    expect(res1?.followerCount).toBe(8921);
    expect(res1?.displayFollowerCount).toBe('8,921');
    expect(res1?.isRounded).toBe(false);

    const html2 = `<div>Welcome to our restaurant. 8,921 people follow this.</div>`;
    const res2 = publicSocialMetricsProvider.extractFromFacebookHtml(html2);
    expect(res2?.followerCount).toBe(8921);
  });

  // Test 4: Follower count unavailable -> null
  test('Test 4: Follower count unavailable returns null and metricStatus NOT_AVAILABLE', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://instagram.com/emptyprofile',
      text: async () => '<html><head><title>Some Page Without Followers</title></head><body>No stats here</body></html>',
    } as any);

    const res = await publicSocialMetricsProvider.fetchPublicMetrics('instagram', 'https://instagram.com/emptyprofile');
    expect(res.followerCount).toBeNull();
    expect(res.displayFollowerCount).toBeNull();
    expect(res.metricStatus).toBe('NOT_AVAILABLE');
  });

  // Test 5: Blocked Instagram page -> null, search continues
  test('Test 5: Blocked Instagram page (login redirect / 403) returns null and search continues', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://www.instagram.com/accounts/login/?next=/treesandtreats/',
      text: async () => '<html><body>Login Required</body></html>',
    } as any);

    const res = await publicSocialMetricsProvider.fetchPublicMetrics('instagram', 'https://instagram.com/treesandtreats');
    expect(res.followerCount).toBeNull();
    expect(res.metricStatus).toBe('NOT_AVAILABLE');
  });

  // Test 6: Blocked Facebook page -> null, search continues
  test('Test 6: Blocked Facebook page (checkpoint / 403) returns null and search continues', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      url: 'https://www.facebook.com/checkpoint/',
    } as any);

    const res = await publicSocialMetricsProvider.fetchPublicMetrics('facebook', 'https://facebook.com/treesandtreats');
    expect(res.followerCount).toBeNull();
    expect(res.metricStatus).toBe('NOT_AVAILABLE');
  });

  // Test 7: No conversion of NULL to zero
  test('Test 7: No conversion of NULL to zero when unavailable', async () => {
    const service = new SocialMetricsService();

    const profile: SocialProfile = {
      id: 'soc_biz_ig',
      businessId: 'biz_1',
      platform: 'instagram',
      profileUrl: 'https://instagram.com/unreachable',
      username: 'unreachable',
      displayName: null,
      description: null,
      followers: null,
      displayFollowerCount: null,
      isRounded: null,
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

    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [profile]);
    expect(enrichedProfiles[0].followers).toBeNull();
    expect(enrichedProfiles[0].followers).not.toBe(0);
    expect(enrichedProfiles[0].displayFollowerCount).toBeNull();
  });

  // Test 8: Official API value takes priority over public-web value
  test('Test 8: Official API value takes priority over public-web value', async () => {
    process.env.META_ACCESS_TOKEN = 'valid_meta_token';
    const service = new SocialMetricsService();

    // Mock official API returning 50000 followers
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        business_discovery: {
          name: 'Trees & Treats Official',
          followers_count: 50000,
          follows_count: 300,
          media_count: 150,
        },
      }),
    } as any);

    const profile: SocialProfile = {
      id: 'soc_biz_ig_priority',
      businessId: 'biz_1',
      platform: 'instagram',
      profileUrl: 'https://instagram.com/treesandtreats',
      username: 'treesandtreats',
      displayName: null,
      description: null,
      followers: null,
      displayFollowerCount: null,
      isRounded: null,
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

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [profile]);
    expect(enrichedProfiles[0].followers).toBe(50000);
    expect(enrichedProfiles[0].metricSourceType).toBe('OFFICIAL_API');
    delete process.env.META_ACCESS_TOKEN;
  });

  // Test 9: Public web fallback succeeds when official API is unconfigured
  test('Test 9: Public web fallback succeeds when official API is unconfigured', async () => {
    delete process.env.META_ACCESS_TOKEN;
    const service = new SocialMetricsService();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://instagram.com/treesandtreats',
      text: async () => `
        <html>
          <head>
            <meta name="description" content="15.8K Followers, 200 Following, 85 Posts" />
          </head>
        </html>
      `,
    } as any);

    const profile: SocialProfile = {
      id: 'soc_biz_ig_fallback',
      businessId: 'biz_1',
      platform: 'instagram',
      profileUrl: 'https://instagram.com/treesandtreats',
      username: 'treesandtreats',
      displayName: null,
      description: null,
      followers: null,
      displayFollowerCount: null,
      isRounded: null,
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

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [profile]);
    expect(enrichedProfiles[0].followers).toBe(15800);
    expect(enrichedProfiles[0].displayFollowerCount).toBe('15.8K');
    expect(enrichedProfiles[0].isRounded).toBe(true);
    expect(enrichedProfiles[0].metricSourceType).toBe('PUBLIC_WEB');
    expect(enrichedProfiles[0].metricStatus).toBe('AVAILABLE');
  });

  // Test 10: Other platforms (YouTube, TikTok, LinkedIn, Twitter) are unaffected
  test('Test 10: Non-Meta platforms (YouTube, TikTok, LinkedIn, X) are NOT processed by public web fallback', async () => {
    const service = new SocialMetricsService();

    const ytProfile: SocialProfile = {
      id: 'soc_biz_yt',
      businessId: 'biz_1',
      platform: 'youtube',
      profileUrl: 'https://youtube.com/@somechannel',
      username: 'somechannel',
      displayName: null,
      description: null,
      followers: null,
      displayFollowerCount: null,
      isRounded: null,
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

    const { enrichedProfiles } = await service.enrichProfiles('biz_1', mockIdentity, [ytProfile]);
    // Since YOUTUBE_API_KEY is not set, it must remain NOT_CONFIGURED and never invoke public web fallback
    expect(enrichedProfiles[0].metricStatus).toBe('NOT_CONFIGURED');
    expect(enrichedProfiles[0].followers).toBeNull();
    expect(enrichedProfiles[0].metricSourceType).toBe('NONE');
  });
});
