import { canonicalizeUrl, extractDomain } from '@/utils/urlUtils';
import { WebsiteReachabilityStatus } from '@/models/Enums';
import { leadPilotDb } from '@/db';

const AGGREGATOR_DOMAINS = new Set([
  'tripadvisor.com',
  'tripadvisor.in',
  'zomato.com',
  'swiggy.com',
  'magicpin.in',
  'restaurant-guru.in',
  'justdial.com',
  'indiamart.com',
  'venuelook.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'linkedin.com',
  'wikipedia.org',
  'reddit.com',
  'quora.com',
  'eatsure.com',
]);

export interface WebsiteResolutionResult {
  websiteUrl?: string;
  domain?: string;
  status: WebsiteReachabilityStatus;
  canonicalUrl?: string;
  evidence?: string;
}

export class WebsiteDiscoveryProvider {
  readonly providerId = 'website_discovery_provider';
  readonly name = 'Website Discovery & Domain Resolver';

  /**
   * Resolves, canonicalizes, and verifies potential official websites.
   * Do NOT assume website=null means "No Website".
   * Returns UNKNOWN, NOT_FOUND, FOUND, etc.
   */
  public async resolveWebsite(
    businessName: string,
    city?: string,
    state?: string,
    initialWebsite?: string
  ): Promise<WebsiteResolutionResult> {
    // 1. If an initial website is already provided from OSM or search
    if (initialWebsite && initialWebsite.trim().length > 4) {
      const canonical = canonicalizeUrl(initialWebsite);
      const domain = extractDomain(canonical);
      if (canonical && domain && !AGGREGATOR_DOMAINS.has(domain)) {
        return {
          websiteUrl: canonical,
          domain,
          canonicalUrl: canonical,
          status: 'FOUND',
          evidence: 'Provided by source record',
        };
      }
    }

    // 2. Check cache for previous domain resolution
    const cacheKey = `website_res:${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}:${(city || '').toLowerCase()}`;
    const cached = leadPilotDb.getCache<WebsiteResolutionResult>(cacheKey);
    if (cached) return cached;

    // 3. Search public search for official website
    const query = `"${businessName}" "${city || state || ''}" official website`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const fallback: WebsiteResolutionResult = { status: 'UNKNOWN' };
        return fallback;
      }

      const html = await res.text();
      const resultBlocks = html.split(/<div[^>]*class="[^"]*result\s+results_links[^"]*"[^>]*>/i).slice(1, 6);

      for (const block of resultBlocks) {
        const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        let link = linkMatch[1];
        if (link.includes('uddg=')) {
          try {
            const u = new URL(link, 'https://html.duckduckgo.com');
            link = decodeURIComponent(u.searchParams.get('uddg') || link);
          } catch {}
        }

        const domain = extractDomain(link);
        if (domain && !AGGREGATOR_DOMAINS.has(domain)) {
          const canonical = canonicalizeUrl(link);
          const result: WebsiteResolutionResult = {
            websiteUrl: canonical,
            domain,
            canonicalUrl: canonical,
            status: 'FOUND',
            evidence: `Discovered from official public web listing: ${domain}`,
          };
          leadPilotDb.setCache(cacheKey, result, 86400000); // 24hr cache
          return result;
        }
      }

      // If we searched specifically and found no official domain among top results
      const notFoundResult: WebsiteResolutionResult = {
        status: 'NOT_FOUND',
        evidence: 'No official domain found in top search results',
      };
      leadPilotDb.setCache(cacheKey, notFoundResult, 86400000);
      return notFoundResult;
    } catch {
      clearTimeout(timeout);
      return { status: 'UNKNOWN' };
    }
  }
}

export const websiteDiscoveryProvider = new WebsiteDiscoveryProvider();
