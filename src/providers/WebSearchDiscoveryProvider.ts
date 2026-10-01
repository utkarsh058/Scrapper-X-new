import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { leadPilotDb } from '@/db';
import { extractPhonesFromText, normalizePhone } from '@/utils/phoneUtils';
import { extractEmailsFromText, normalizeEmail } from '@/utils/emailUtils';
import { canonicalizeUrl, extractDomain } from '@/utils/urlUtils';

// Generic non-business platforms, directories, and aggregator blogs to filter out
const AGGREGATOR_DOMAINS = new Set([
  'tripadvisor.com',
  'tripadvisor.in',
  'zomato.com',
  'swiggy.com',
  'magicpin.in',
  'magicpin.com',
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
  'wanderlog.com',
  'yappe.in',
  'cafeinindia.pro',
  'tripoto.com',
  'lbb.in',
  'holidify.com',
  'so.city',
  'eazydiner.com',
  'dineout.co.in',
  'dineout.com',
  'whatshot.in',
  'mouthshut.com',
  'sulekha.com',
  'mapsofindia.com',
  'yellowpages.in',
]);

export interface EnrichedContactResult {
  phone?: string;
  email?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  snippet?: string;
  confidence?: 'verified' | 'high' | 'medium';
}

export class WebSearchDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'web_search';
  readonly name = 'Public Web Discovery Engine';

  // Configurable failure simulation hook for automated test suites
  private static simulateFailureMode = false;

  public static setSimulateFailure(value: boolean) {
    WebSearchDiscoveryProvider.simulateFailureMode = value;
  }

  /**
   * Generates targeted search queries for candidate business discovery
   */
  private generateQueries(industry: string, city: string, state: string): string[] {
    const loc = city ? `${city} ${state}` : state;
    return [
      `"${industry}" in "${loc}"`,
      `"${industry}" in "${loc}" contact phone`,
      `"${industry}" in "${loc}" official website`,
      `popular "${industry}" in "${loc}"`,
    ];
  }

  /**
   * Identifies listicles, roundups, and directory titles.
   */
  private isListicleTitle(title: string): boolean {
    const lower = title.toLowerCase();
    if (/^(the\s+\d+|\d+\s+best|top\s+\d+|best\s+\d+|the\s+best|best\s+top)/i.test(lower)) return true;
    if (/(best|top\s+rated|popular)\s+(cafes|restaurants|hotels|gyms|coffee shops|places|bars|salons)\s+in/i.test(lower)) return true;
    if (/\b(list of|guide to|directory of|reviews of|rankings?|10 best|20 best|30 best|top 10)\b/i.test(lower)) return true;
    return false;
  }

  /**
   * Cleans title string to isolate the actual business name.
   */
  private cleanBusinessName(title: string, industry: string, city?: string): string {
    if (this.isListicleTitle(title)) {
      return '';
    }

    let clean = title;

    // Remove common search snippet suffixes
    clean = clean.replace(/\s*[-–|:]\s*(Tripadvisor|Zomato|Swiggy|Justdial|Magicpin|VenueLook|Restaurant Guru|Facebook|Instagram|Wikipedia|Wanderlog|Yappe).*$/i, '');
    clean = clean.replace(/\s*[-–|:]\s*(Updated\s+\d+|Menu|Reviews|Order Online|Contact Us|Home|Official Website|Best in.*|About Us).*$/i, '');
    clean = clean.replace(/^(THE\s+\d+\s+BEST|Top\s+\d+\s+Best|Top\s+\d+|\d+\s+Best)\s+.*?\s+in\s+.*?[–-]\s*/i, '');

    // If city name is trailing, clean it
    if (city) {
      const cityRegex = new RegExp(`\\s*[-–|,]?\\s*${city}\\s*.*$`, 'i');
      clean = clean.replace(cityRegex, '');
    }

    clean = clean.replace(/<[^>]+>/g, '').trim();

    // Check if clean title is still generic
    if (
      clean.length < 3 ||
      clean.length > 50 ||
      (/^(top|best|\d+|the \d+|cafes|restaurants|hotels|coffee)/i.test(clean) && clean.split(/\s+/).length < 3)
    ) {
      return '';
    }

    return clean;
  }

  /**
   * Executes search query with fallbacks (DuckDuckGo Lite -> DuckDuckGo HTML)
   */
  public async executeSearchQuery(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
    try {
      // 1. Try DuckDuckGo Lite first (lightweight, highly reliable, rarely rate-limited)
      const items = await this.queryDuckDuckGoLite(query);
      if (items.length > 0) return items;

      // 2. Fallback to DuckDuckGo HTML only if Lite returned empty quickly
      return await this.queryDuckDuckGoHtml(query);
    } catch {
      return [];
    }
  }

  private async queryDuckDuckGoLite(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const searchUrl = `https://lite.duckduckgo.com/lite/`;
      const params = new URLSearchParams();
      params.set('q', query);

      const res = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) return [];

      const html = await res.text();
      const items: { title: string; link: string; snippet: string }[] = [];

      // Parse Lite table structure
      const rowMatches = html.split(/<tr[^>]*>/i);
      let currentTitle = '';
      let currentLink = '';

      for (const row of rowMatches) {
        const linkMatch = row.match(/<a[^>]*class=["']result-link["'][^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (linkMatch) {
          currentLink = linkMatch[1];
          currentTitle = linkMatch[2].replace(/<[^>]+>/g, '').trim();
          continue;
        }

        const snippetMatch = row.match(/<td[^>]*class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/i);
        if (snippetMatch && currentLink) {
          const snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
          let link = currentLink;
          if (link.includes('uddg=')) {
            try {
              const u = new URL(link, 'https://lite.duckduckgo.com');
              link = decodeURIComponent(u.searchParams.get('uddg') || link);
            } catch {}
          }
          items.push({ title: currentTitle, link, snippet });
          currentLink = '';
          currentTitle = '';
        }
      }

      return items;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  private async queryDuckDuckGoHtml(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) return [];

      const html = await res.text();
      const resultBlocks = html.split(/<div[^>]*class="[^"]*result\s+results_links[^"]*"[^>]*>/i).slice(1);
      const items: { title: string; link: string; snippet: string }[] = [];

      for (const block of resultBlocks) {
        const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

        if (!linkMatch) continue;

        let link = linkMatch[1];
        if (link.includes('uddg=')) {
          try {
            const u = new URL(link, 'https://html.duckduckgo.com');
            link = decodeURIComponent(u.searchParams.get('uddg') || link);
          } catch {}
        }

        const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        items.push({ title, link, snippet });
      }

      return items;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  /**
   * Public Contact & Website Enrichment:
   * Searches public index for structured queries: "${businessName}" "${city}" phone contact email
   */
  public async enrichBusinessContacts(
    businessName: string,
    city?: string,
    state?: string,
    industry?: string
  ): Promise<EnrichedContactResult> {
    const loc = city ? `${city} ${state || ''}`.trim() : (state || '');
    const cacheKey = `enrich:${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}:${loc.toLowerCase()}`;
    const cached = leadPilotDb.getCache<EnrichedContactResult>(cacheKey);
    if (cached) return cached;

    // Structured query
    const query = `"${businessName}" "${city || state || ''}" phone contact`;
    const items = await this.executeSearchQuery(query);

    let phone: string | undefined;
    let email: string | undefined;
    let websiteUrl: string | undefined;
    let sourceUrl: string | undefined;
    let bestSnippet = '';

    for (const item of items) {
      const combinedText = `${item.title} ${item.snippet}`;
      const phones = extractPhonesFromText(combinedText);
      const emails = extractEmailsFromText(combinedText);

      if (!phone && phones.length > 0) {
        phone = normalizePhone(phones[0]);
        sourceUrl = item.link;
        bestSnippet = item.snippet;
      }

      if (!email && emails.length > 0) {
        email = normalizeEmail(emails[0]);
        sourceUrl = item.link;
        bestSnippet = item.snippet;
      }

      // Check official direct domain (excluding aggregators)
      if (!websiteUrl) {
        const domain = extractDomain(item.link);
        if (domain && !AGGREGATOR_DOMAINS.has(domain)) {
          // Check if domain or title bears resemblance to business name
          const normBiz = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normDom = domain.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normDom.includes(normBiz) || normBiz.includes(normDom)) {
            websiteUrl = canonicalizeUrl(item.link);
          }
        }
      }

      if (phone && email && websiteUrl) break;
    }

    const result: EnrichedContactResult = {
      phone,
      email,
      websiteUrl,
      sourceUrl,
      snippet: bestSnippet.slice(0, 250),
      confidence: phone || email ? 'high' : 'medium',
    };

    leadPilotDb.setCache(cacheKey, result, 86400000); // 24 hours
    return result;
  }

  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();

    // Check simulated failure for testing
    if (WebSearchDiscoveryProvider.simulateFailureMode) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: params.city ? `${params.city}, ${params.state}` : params.state,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'FAILED',
        statusReason: 'Simulated web search upstream gateway failure (HTTP 502 Bad Gateway)',
        errors: ['Simulated web search gateway failure for test verification.'],
        durationMs: Date.now() - startTime,
      };
    }

    const city = params.city || '';
    const state = params.state;
    const industry = params.industry;

    const cacheKey = `web_discovery_v3:${industry}:${state}:${city || 'all'}`;
    const cached = leadPilotDb.getCache<DiscoveryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const queries = this.generateQueries(industry, city, state);
    const candidateMap = new Map<string, RawDiscoveredBusiness>();

    for (const q of queries) {
      const items = await this.executeSearchQuery(q);

      for (const item of items) {
        const rawTitle = item.title;
        const snippet = item.snippet;
        const link = item.link;

        const domain = extractDomain(link);
        const isAggregator = domain ? AGGREGATOR_DOMAINS.has(domain) : false;

        const businessName = this.cleanBusinessName(rawTitle, industry, city);
        if (!businessName || businessName.length < 3) {
          // If title was a listicle, try to extract first business mentioned in snippet
          const listMatch = snippet.match(/(?:1\.|#1|•)\s*([A-Z][A-Za-z0-9'&.\s]{3,30}?)(?:\s*[-––,|:]|\s+in\s+|\s+is\s+)/);
          if (listMatch) {
            const subName = listMatch[1].trim();
            const norm = subName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (subName.length >= 3 && !candidateMap.has(norm)) {
              candidateMap.set(norm, {
                source: 'web_search',
                sources: ['web_search'],
                sourceId: `web_${norm}`,
                sourceUrl: link,
                confidence: 'search_snippet',
                name: subName,
                businessName: subName,
                category: industry,
                address: city ? `${city}, ${state}` : state,
                city: city || undefined,
                state,
                postalCode: undefined,
                postcode: undefined,
                rawTags: {
                  searchQuery: q,
                  snippet: snippet.slice(0, 300),
                  extractedFromListicle: true,
                },
              });
            }
          }
          continue;
        }

        const normKey = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (candidateMap.has(normKey)) continue;

        // Check if link is an official direct website (not aggregator)
        let website: string | undefined = undefined;
        if (domain && !isAggregator) {
          website = canonicalizeUrl(link);
        }

        // Extract contacts from snippet
        const phones = extractPhonesFromText(snippet);
        const emails = extractEmailsFromText(snippet);
        const phone = phones.length > 0 ? normalizePhone(phones[0]) : undefined;
        const email = emails.length > 0 ? normalizeEmail(emails[0]) : undefined;

        // Construct candidate
        const candidate: RawDiscoveredBusiness = {
          source: 'web_search',
          sources: ['web_search'],
          sourceId: `web_${normKey}`,
          sourceUrl: link,
          confidence: website ? 'verified_domain' : 'search_snippet',
          name: businessName,
          businessName,
          category: industry,
          address: city ? `${city}, ${state}` : state,
          city: city || undefined,
          state,
          phone,
          email,
          website,
          rawTags: {
            searchQuery: q,
            snippet: snippet.slice(0, 300),
            sourceDomain: domain,
          },
        };

        candidateMap.set(normKey, candidate);
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    const businesses = Array.from(candidateMap.values());
    const result: DiscoveryResult = {
      providerId: this.providerId,
      providerName: this.name,
      resolvedAreaName: city ? `${city}, ${state}` : state,
      rawCount: businesses.length,
      businesses,
      sourceComplete: businesses.length > 0,
      status: businesses.length > 0 ? 'COMPLETE' : 'NO_RESULTS',
      statusReason: `Discovered ${businesses.length} real candidates via targeted public web searches.`,
      durationMs: Date.now() - startTime,
    };

    leadPilotDb.setCache(cacheKey, result, 3600000); // 1 hour cache
    return result;
  }
}

export const webSearchDiscoveryProvider = new WebSearchDiscoveryProvider();
