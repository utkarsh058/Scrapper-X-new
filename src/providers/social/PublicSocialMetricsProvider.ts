/**
 * Public Social Metrics Provider (Public-Web Fallback)
 * 
 * Strict Single Responsibility:
 * Fallback follower-count extraction for Instagram and Facebook from public HTML / metadata / schema.org.
 * 
 * Boundary Constraints:
 * - REAL DATA ONLY. ZERO FAKE DATA POLICY.
 * - No logins, no session cookies, no bot-protection bypass, no CAPTCHA solving.
 * - Bounded request with short timeout (max 4 seconds).
 * - Only extracts explicitly stated follower counts (e.g. "12,437 followers", "12.4K followers").
 * - Never converts likes, following, posts, or missing values to follower count.
 * - If blocked (HTTP 403, 429, 302 to login, checkpoint), returns followerCount: null and metricStatus: 'NOT_AVAILABLE'.
 * - Preserves displayFollowerCount (e.g. "12.4K") and flags isRounded: true when rounded.
 */

import { SocialMetricsResult } from './SocialMetricsProvider';

export interface ExtractedFollowerMetric {
  followerCount: number | null;
  displayFollowerCount: string | null;
  isRounded: boolean;
  evidence: string;
}

export class PublicSocialMetricsProvider {
  public readonly name = 'Public Web Fallback';

  /**
   * Deterministically parses a follower count string.
   * Handles formats:
   * - "12,437 followers" -> 12437, isRounded: false, display: "12,437"
   * - "12.4K followers"  -> 12400, isRounded: true, display: "12.4K"
   * - "1.2M followers"   -> 1200000, isRounded: true, display: "1.2M"
   * - "1234 followers"   -> 1234, isRounded: false, display: "1234"
   */
  public parseFollowerString(raw: string): ExtractedFollowerMetric | null {
    if (!raw || typeof raw !== 'string') return null;

    // Matches patterns like:
    // "12,437 Followers", "12.4K followers", "1.2M Followers", "1,234 followers"
    // Also covers Spanish/French/other common suffixes if preceded by followers keyword
    const match = raw.match(/([\d,.]+\s*[KkMmBb]?)\s*(?:followers|Followers|Seguidores|abonnés)/i);
    if (!match) return null;

    const rawNumStr = match[1].trim();
    return this.parseNumberToken(rawNumStr, match[0]);
  }

  /**
   * Converts numeric tokens like "12.4K", "1.2M", "12,437" into integer followerCount and display string.
   */
  public parseNumberToken(token: string, evidenceStr?: string): ExtractedFollowerMetric | null {
    if (!token) return null;

    const cleaned = token.trim();
    const upper = cleaned.toUpperCase();

    // Check for K (thousands)
    if (upper.endsWith('K')) {
      const numPart = parseFloat(upper.replace('K', '').replace(/,/g, ''));
      if (isNaN(numPart) || numPart < 0) return null;
      const count = Math.round(numPart * 1000);
      return {
        followerCount: count,
        displayFollowerCount: cleaned,
        isRounded: true,
        evidence: evidenceStr || `${cleaned} followers`,
      };
    }

    // Check for M (millions)
    if (upper.endsWith('M')) {
      const numPart = parseFloat(upper.replace('M', '').replace(/,/g, ''));
      if (isNaN(numPart) || numPart < 0) return null;
      const count = Math.round(numPart * 1000000);
      return {
        followerCount: count,
        displayFollowerCount: cleaned,
        isRounded: true,
        evidence: evidenceStr || `${cleaned} followers`,
      };
    }

    // Check for B (billions)
    if (upper.endsWith('B')) {
      const numPart = parseFloat(upper.replace('B', '').replace(/,/g, ''));
      if (isNaN(numPart) || numPart < 0) return null;
      const count = Math.round(numPart * 1000000000);
      return {
        followerCount: count,
        displayFollowerCount: cleaned,
        isRounded: true,
        evidence: evidenceStr || `${cleaned} followers`,
      };
    }

    // Exact number with or without commas
    const withoutCommas = cleaned.replace(/,/g, '');
    const intVal = parseInt(withoutCommas, 10);
    if (isNaN(intVal) || intVal < 0) return null;

    return {
      followerCount: intVal,
      displayFollowerCount: cleaned,
      isRounded: false,
      evidence: evidenceStr || `${cleaned} followers`,
    };
  }

  /**
   * Extracts follower count from Instagram public HTML or meta tags
   */
  public extractFromInstagramHtml(html: string): ExtractedFollowerMetric | null {
    if (!html || typeof html !== 'string') return null;

    // Instagram meta description format:
    // <meta name="description" content="12.4K Followers, 450 Following, 120 Posts - See Instagram photos and videos from ...">
    // <meta property="og:description" content="12,437 Followers, 450 Following, ...">
    const descMatch =
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);

    if (descMatch) {
      const content = descMatch[1];
      const parsed = this.parseFollowerString(content);
      if (parsed) return parsed;
    }

    // JSON-LD or embedded JSON search (e.g. edge_followed_by: { count: 12345 })
    const jsonCountMatch = html.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)\s*\}/);
    if (jsonCountMatch) {
      const count = parseInt(jsonCountMatch[1], 10);
      if (!isNaN(count)) {
        return {
          followerCount: count,
          displayFollowerCount: count.toLocaleString(),
          isRounded: false,
          evidence: `"edge_followed_by":{"count":${count}}`,
        };
      }
    }

    return null;
  }

  /**
   * Extracts follower count from Facebook public HTML or meta tags
   */
  public extractFromFacebookHtml(html: string): ExtractedFollowerMetric | null {
    if (!html || typeof html !== 'string') return null;

    // Facebook meta description formats:
    // <meta name="description" content="... 8,921 followers · 12 following ...">
    // <meta property="og:description" content="... 12K followers ...">
    const descMatch =
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);

    if (descMatch) {
      const content = descMatch[1];
      const parsed = this.parseFollowerString(content);
      if (parsed) return parsed;
    }

    // Search body text for patterns like: "8,921 people follow this" or "8.9K followers"
    const followThisMatch = html.match(/([\d,.]+\s*[KkMm]?)\s*people follow this/i);
    if (followThisMatch) {
      const parsed = this.parseNumberToken(followThisMatch[1], followThisMatch[0]);
      if (parsed) return parsed;
    }

    const generalFollowerMatch = this.parseFollowerString(html);
    if (generalFollowerMatch) return generalFollowerMatch;

    return null;
  }

  /**
   * Executes a bounded public web fetch and parses the follower count.
   * If blocked (e.g. 401, 403, 429, login redirection, CAPTCHA), returns null without failing.
   */
  public async fetchPublicMetrics(
    platform: 'instagram' | 'facebook',
    profileUrl: string,
    username?: string | null
  ): Promise<SocialMetricsResult> {
    const now = new Date();

    if (!profileUrl || !profileUrl.startsWith('http')) {
      return {
        platform,
        profileUrl,
        username: username || null,
        followerCount: null,
        displayFollowerCount: null,
        isRounded: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'NOT_AVAILABLE',
        metricSource: 'public_web',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // 4-second bounded timeout

      const res = await fetch(profileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      // Handle blocking / login redirects
      if (!res.ok) {
        return {
          platform,
          profileUrl,
          username: username || null,
          followerCount: null,
          displayFollowerCount: null,
          isRounded: null,
          followingCount: null,
          subscriberCount: null,
          videoCount: null,
          postCount: null,
          likeCount: null,
          isVerified: null,
          accountCreatedAt: null,
          accountCreatedAtType: 'NOT_AVAILABLE',
          metricStatus: 'NOT_AVAILABLE',
          metricSource: 'public_web',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const finalUrl = res.url || '';
      if (finalUrl.includes('login') || finalUrl.includes('accounts/login') || finalUrl.includes('checkpoint')) {
        // Platform redirected to login checkpoint
        return {
          platform,
          profileUrl,
          username: username || null,
          followerCount: null,
          displayFollowerCount: null,
          isRounded: null,
          followingCount: null,
          subscriberCount: null,
          videoCount: null,
          postCount: null,
          likeCount: null,
          isVerified: null,
          accountCreatedAt: null,
          accountCreatedAtType: 'NOT_AVAILABLE',
          metricStatus: 'NOT_AVAILABLE',
          metricSource: 'public_web',
          metricSourceType: 'NONE',
          retrievedAt: now,
        };
      }

      const html = await res.text();
      const extracted =
        platform === 'instagram'
          ? this.extractFromInstagramHtml(html)
          : this.extractFromFacebookHtml(html);

      if (extracted && extracted.followerCount !== null) {
        return {
          platform,
          profileUrl,
          username: username || null,
          followerCount: extracted.followerCount,
          displayFollowerCount: extracted.displayFollowerCount,
          isRounded: extracted.isRounded,
          followingCount: null,
          subscriberCount: null,
          videoCount: null,
          postCount: null,
          likeCount: null,
          isVerified: null,
          accountCreatedAt: null,
          accountCreatedAtType: 'NOT_AVAILABLE',
          metricStatus: 'AVAILABLE',
          metricSource: 'public_web',
          metricSourceType: 'PUBLIC_WEB',
          retrievedAt: now,
        };
      }

      // No follower count found in public HTML
      return {
        platform,
        profileUrl,
        username: username || null,
        followerCount: null,
        displayFollowerCount: null,
        isRounded: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'NOT_AVAILABLE',
        metricSource: 'public_web',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    } catch {
      // Timeout, connection reset, or network error: never fail search
      return {
        platform,
        profileUrl,
        username: username || null,
        followerCount: null,
        displayFollowerCount: null,
        isRounded: null,
        followingCount: null,
        subscriberCount: null,
        videoCount: null,
        postCount: null,
        likeCount: null,
        isVerified: null,
        accountCreatedAt: null,
        accountCreatedAtType: 'NOT_AVAILABLE',
        metricStatus: 'NOT_AVAILABLE',
        metricSource: 'public_web',
        metricSourceType: 'NONE',
        retrievedAt: now,
      };
    }
  }
}

export const publicSocialMetricsProvider = new PublicSocialMetricsProvider();
