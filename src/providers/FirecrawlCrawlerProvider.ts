import { WebsiteCrawlerProvider, CrawlResult } from './WebsiteCrawlerProvider';
import { internalCrawlerProvider } from './InternalCrawlerProvider';

export class FirecrawlCrawlerProvider implements WebsiteCrawlerProvider {
  readonly providerId = 'firecrawl';
  readonly name = 'Firecrawl Distributed Crawler';

  public async crawlWebsite(targetUrl: string, maxPages: number = 2): Promise<CrawlResult> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      // Fallback to internal crawler if no API key
      return internalCrawlerProvider.crawlWebsite(targetUrl, maxPages);
    }

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown', 'html'],
        }),
      });

      if (!response.ok) {
        return internalCrawlerProvider.crawlWebsite(targetUrl, maxPages);
      }

      const json = await response.json();
      const data = json.data || {};

      // If firecrawl returned successfully, map it into our CrawlResult
      return {
        providerName: this.name,
        originalUrl: targetUrl,
        finalUrl: data.metadata?.sourceURL || targetUrl,
        statusCode: data.metadata?.statusCode || 200,
        isHttps: (data.metadata?.sourceURL || targetUrl).startsWith('https://'),
        loadTimeMs: 1200,
        pageSizeBytes: (data.markdown || '').length,
        pages: [
          {
            url: data.metadata?.sourceURL || targetUrl,
            title: data.metadata?.title || '',
            statusCode: data.metadata?.statusCode || 200,
            textSnippet: (data.markdown || '').slice(0, 500),
            headings: [],
            links: [],
          },
        ],
        extractedEmails: [],
        extractedPhones: [],
        socialLinks: {},
        extractedServices: [],
        ctas: {
          hasPhoneCTA: false,
          hasEmailCTA: false,
          hasWhatsAppCTA: false,
          hasBookingCTA: false,
          hasContactForm: false,
        },
        meta: {
          title: data.metadata?.title,
          description: data.metadata?.description,
          hasViewport: true,
          hasCanonical: Boolean(data.metadata?.canonical),
          hasSchema: false,
          hasRobotsMeta: false,
        },
        crawledAt: new Date().toISOString(),
      };
    } catch {
      return internalCrawlerProvider.crawlWebsite(targetUrl, maxPages);
    }
  }
}

export const firecrawlCrawlerProvider = new FirecrawlCrawlerProvider();
