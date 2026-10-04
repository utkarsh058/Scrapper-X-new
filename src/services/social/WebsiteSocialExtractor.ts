/**
 * Website Social Extractor
 * 
 * Strict Single Responsibility:
 * Extracts public social media links from business website HTML, metadata, and JSON-LD schema.
 * 
 * Platforms supported:
 * - Instagram, Facebook, YouTube, LinkedIn, TikTok, Twitter/X, Pinterest, Threads, WhatsApp Business
 * 
 * Boundary Constraints:
 * - Only extracts links actually present in HTML / DOM / JSON-LD.
 * - Does not invent social handles or followers.
 */

import { SocialPlatform } from '@/types/canonical';

export interface ExtractedSocialLink {
  platform: SocialPlatform;
  url: string;
  username: string | null;
  source: 'website_header' | 'website_footer' | 'website_jsonld' | 'website_body';
}

const SOCIAL_PATTERNS: Array<{
  platform: SocialPlatform;
  regex: RegExp;
  usernameExtractor: (url: string) => string | null;
}> = [
  {
    platform: 'instagram',
    regex: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i);
      const user = match ? match[1] : null;
      if (!user || ['p', 'reel', 'stories', 'explore', 'direct'].includes(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: 'facebook',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.-]+)/i);
      const user = match ? match[1] : null;
      if (!user || ['sharer', 'pages', 'groups', 'events', 'help'].includes(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: 'youtube',
    regex: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)?([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/youtube\.com\/(?:@|c\/|channel\/|user\/)?([a-zA-Z0-9_.-]+)/i);
      const user = match ? match[1] : null;
      if (!user || ['watch', 'feed', 'results', 'playlist', 'live'].includes(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: 'linkedin',
    regex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_.-]+)/i);
      return match ? match[1] : null;
    },
  },
  {
    platform: 'tiktok',
    regex: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
      return match ? match[1] : null;
    },
  },
  {
    platform: 'twitter',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)/i);
      const user = match ? match[1] : null;
      if (!user || ['intent', 'share', 'home', 'search'].includes(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: 'pinterest',
    regex: /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/pinterest\.com\/([a-zA-Z0-9_.-]+)/i);
      const user = match ? match[1] : null;
      if (!user || ['pin', 'search'].includes(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: 'threads',
    regex: /(?:https?:\/\/)?(?:www\.)?threads\.net\/@([a-zA-Z0-9_.-]+)\/?/i,
    usernameExtractor: (url: string) => {
      const match = url.match(/threads\.net\/@([a-zA-Z0-9_.-]+)/i);
      return match ? match[1] : null;
    },
  },
];

export class WebsiteSocialExtractor {
  /**
   * Extracts social links from raw HTML markup
   */
  public extractFromHtml(html: string): ExtractedSocialLink[] {
    const results: ExtractedSocialLink[] = [];
    const seenPlatforms = new Set<string>();

    if (!html || typeof html !== 'string') return results;

    // 1. Check JSON-LD schema blocks
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
    let jsonMatch: RegExpExecArray | null;
    while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const sameAs = Array.isArray(parsed.sameAs)
          ? parsed.sameAs
          : typeof parsed.sameAs === 'string'
          ? [parsed.sameAs]
          : [];

        for (const item of sameAs) {
          if (typeof item === 'string') {
            const detected = this.matchPlatform(item, 'website_jsonld');
            if (detected && !seenPlatforms.has(detected.platform)) {
              results.push(detected);
              seenPlatforms.add(detected.platform);
            }
          }
        }
      } catch {
        // Invalid JSON-LD block, skip
      }
    }

    // 2. Scan all href attributes
    const hrefRegex = /href=["'](https?:\/\/[^"'\s>]+)["']/gi;
    let hrefMatch: RegExpExecArray | null;
    while ((hrefMatch = hrefRegex.exec(html)) !== null) {
      const link = hrefMatch[1];
      const detected = this.matchPlatform(link, 'website_body');
      if (detected && !seenPlatforms.has(detected.platform)) {
        results.push(detected);
        seenPlatforms.add(detected.platform);
      }
    }

    return results;
  }

  /**
   * Matches a single URL against known social platform patterns
   */
  public matchPlatform(
    url: string,
    source: ExtractedSocialLink['source'] = 'website_body'
  ): ExtractedSocialLink | null {
    for (const pattern of SOCIAL_PATTERNS) {
      if (pattern.regex.test(url)) {
        const username = pattern.usernameExtractor(url);
        return {
          platform: pattern.platform,
          url,
          username,
          source,
        };
      }
    }
    return null;
  }
}

export const websiteSocialExtractor = new WebsiteSocialExtractor();
