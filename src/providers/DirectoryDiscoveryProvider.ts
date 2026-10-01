import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { leadPilotDb } from '@/db';
import { extractPhonesFromText } from '@/utils/phoneUtils';
import { extractEmailsFromText } from '@/utils/emailUtils';

export class DirectoryDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'directory';
  readonly name = 'Public Business Directory Provider';

  private generateDirectoryQueries(industry: string, city: string, state: string): string[] {
    const loc = city ? `${city} ${state}` : state;
    return [
      `"${industry}" "${loc}" phone contact directory`,
      `"${industry}" in "${loc}" listing address contact`,
    ];
  }

  private async fetchDirectorySnippetResults(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

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

  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const city = params.city || '';
    const state = params.state;
    const industry = params.industry;

    const cacheKey = `dir_discovery:${industry}:${state}:${city || 'all'}`;
    const cached = leadPilotDb.getCache<DiscoveryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const queries = this.generateDirectoryQueries(industry, city, state);
    const candidateMap = new Map<string, RawDiscoveredBusiness>();

    for (const q of queries) {
      const items = await this.fetchDirectorySnippetResults(q);

      for (const item of items) {
        const rawTitle = item.title;
        const snippet = item.snippet;

        // Isolate business name
        let businessName = rawTitle.replace(/\s*[-–|:].*$/g, '').trim();
        if (!businessName || businessName.length < 3 || /^(top|best|\d+|directory|list)/i.test(businessName)) {
          continue;
        }

        const normKey = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (candidateMap.has(normKey)) continue;

        const phones = extractPhonesFromText(snippet);
        const emails = extractEmailsFromText(snippet);

        const candidate: RawDiscoveredBusiness = {
          source: 'directory',
          sourceId: `dir_${normKey}`,
          sourceUrl: item.link,
          confidence: 'directory_listing',
          name: businessName,
          businessName,
          category: industry,
          address: city ? `${city}, ${state}` : state,
          city: city || undefined,
          state,
          postalCode: undefined,
          postcode: undefined,
          phone: phones[0],
          email: emails[0],
          rawTags: {
            directoryQuery: q,
            snippet: snippet.slice(0, 300),
          },
        };

        candidateMap.set(normKey, candidate);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    const businesses = Array.from(candidateMap.values());
    const result: DiscoveryResult = {
      providerId: this.providerId,
      providerName: this.name,
      resolvedAreaName: city ? `${city}, ${state}` : state,
      rawCount: businesses.length,
      businesses,
      sourceComplete: true,
      status: businesses.length > 0 ? 'COMPLETE' : 'NO_RESULTS',
      statusReason: `Discovered ${businesses.length} candidates from public local directory listings.`,
      durationMs: Date.now() - startTime,
    };

    leadPilotDb.setCache(cacheKey, result, 3600000);
    return result;
  }
}

export const directoryDiscoveryProvider = new DirectoryDiscoveryProvider();
