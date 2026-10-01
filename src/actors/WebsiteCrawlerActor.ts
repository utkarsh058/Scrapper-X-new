import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithReachability } from './WebsiteReachabilityActor';
import { CrawlResult, WebsiteCrawlerProvider } from '@/providers/WebsiteCrawlerProvider';
import { internalCrawlerProvider } from '@/providers/InternalCrawlerProvider';
import { leadPilotDb } from '@/db';

export interface BusinessWithCrawl extends BusinessWithReachability {
  crawlResult?: CrawlResult;
}

export class WebsiteCrawlerActor extends BaseActor<BusinessWithReachability[], BusinessWithCrawl[]> {
  readonly actorId = 'actor_website_crawler';
  readonly name = 'Website Crawler Actor';
  readonly timeoutMs = 60000;

  private crawler: WebsiteCrawlerProvider = internalCrawlerProvider;

  protected async run(context: ActorContext<BusinessWithReachability[]>): Promise<{
    data: BusinessWithCrawl[];
    sources: string[];
    warnings?: string[];
  }> {
    const businesses = context.input;
    const reachable = businesses.filter(
      (b) => b.websiteUrl && (b.reachability?.status === 'LIVE' || b.reachability?.status === 'REDIRECTED')
    );

    context.onProgress?.(`Crawling ${reachable.length} reachable websites...`);

    const crawlMap = new Map<string, CrawlResult>();
    const batchSize = 6; // safe concurrency

    for (let i = 0; i < reachable.length; i += batchSize) {
      const batch = reachable.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (b) => {
          if (!b.websiteUrl) return;
          const cacheKey = `crawl:${b.websiteUrl}`;
          const cached = leadPilotDb.getCache<CrawlResult>(cacheKey);

          if (cached) {
            crawlMap.set(b.websiteUrl, cached);
            return;
          }

          try {
            const crawl = await this.crawler.crawlWebsite(b.websiteUrl, 2);
            leadPilotDb.setCache(cacheKey, crawl, 86400000); // 24 hour cache
            crawlMap.set(b.websiteUrl, crawl);
          } catch (err) {
            console.warn(`[WebsiteCrawlerActor] Crawl failed for ${b.websiteUrl}:`, err);
          }
        })
      );
    }

    const results: BusinessWithCrawl[] = businesses.map((b) => ({
      ...b,
      crawlResult: b.websiteUrl ? crawlMap.get(b.websiteUrl) : undefined,
    }));

    context.onProgress?.(`Crawled ${crawlMap.size} websites successfully.`, crawlMap.size);

    return {
      data: results,
      sources: [this.crawler.name],
    };
  }
}

export const websiteCrawlerActor = new WebsiteCrawlerActor();
