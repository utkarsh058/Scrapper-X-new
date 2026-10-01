import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithWebsite } from './WebsiteDiscoveryActor';
import { WebsiteReachabilityStatus } from '@/models/Enums';
import { leadPilotDb } from '@/db';

export interface ReachabilityResult {
  status: WebsiteReachabilityStatus;
  statusCode: number;
  isHttps: boolean;
  responseTimeMs: number;
  finalUrl?: string;
}

export interface BusinessWithReachability extends BusinessWithWebsite {
  reachability?: ReachabilityResult;
}

export class WebsiteReachabilityActor extends BaseActor<BusinessWithWebsite[], BusinessWithReachability[]> {
  readonly actorId = 'actor_website_reachability';
  readonly name = 'Website Reachability Actor';
  readonly timeoutMs = 60000;

  private async checkUrl(url: string): Promise<ReachabilityResult> {
    const cacheKey = `reachability:${url}`;
    const cached = leadPilotDb.getCache<ReachabilityResult>(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadPilotVerifier/1.0',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const responseTimeMs = Date.now() - startTime;
      const isHttps = (res.url || url).startsWith('https://');

      let status: WebsiteReachabilityStatus = 'LIVE';
      if (res.status >= 400) {
        status = 'UNREACHABLE';
      } else if (res.url && res.url !== url) {
        status = 'REDIRECTED';
      }

      const result: ReachabilityResult = {
        status,
        statusCode: res.status,
        isHttps,
        responseTimeMs,
        finalUrl: res.url,
      };

      leadPilotDb.setCache(cacheKey, result, 7200000); // 2 hours cache
      return result;
    } catch (err: any) {
      clearTimeout(timeout);
      const msg = err.message?.toLowerCase() || '';
      let status: WebsiteReachabilityStatus = 'UNREACHABLE';
      if (msg.includes('abort') || msg.includes('timeout')) status = 'TIMEOUT';
      if (msg.includes('enotfound') || msg.includes('dns')) status = 'DNS_ERROR';
      if (msg.includes('cert') || msg.includes('ssl') || msg.includes('tls')) status = 'SSL_ERROR';

      const result: ReachabilityResult = {
        status,
        statusCode: 0,
        isHttps: url.startsWith('https://'),
        responseTimeMs: Date.now() - startTime,
      };

      leadPilotDb.setCache(cacheKey, result, 7200000);
      return result;
    }
  }

  protected async run(context: ActorContext<BusinessWithWebsite[]>): Promise<{
    data: BusinessWithReachability[];
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Testing reachability and SSL certificates for websites...`);

    const results: BusinessWithReachability[] = [];
    const candidatesWithUrl = businesses.filter((b) => Boolean(b.websiteUrl));

    // Check reachable candidates in parallel batches of 5
    const checkMap = new Map<string, ReachabilityResult>();
    const batchSize = 10;

    for (let i = 0; i < candidatesWithUrl.length; i += batchSize) {
      const batch = candidatesWithUrl.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (b) => {
          if (b.websiteUrl) {
            const check = await this.checkUrl(b.websiteUrl);
            checkMap.set(b.websiteUrl, check);
          }
        })
      );
    }

    for (const b of businesses) {
      if (b.websiteUrl) {
        const reachability = checkMap.get(b.websiteUrl);
        results.push({
          ...b,
          reachability,
        });
      } else {
        results.push({
          ...b,
          reachability: {
            status: (b as any).websiteStatus || 'NOT_FOUND',
            statusCode: 0,
            isHttps: false,
            responseTimeMs: 0,
          },
        });
      }
    }

    const liveCount = Array.from(checkMap.values()).filter((c) => c.status === 'LIVE' || c.status === 'REDIRECTED').length;
    context.onProgress?.(`Reachability testing complete: ${liveCount} live websites.`);

    return {
      data: results,
      sources: ['Network HTTP/SSL Verifier'],
    };
  }
}

export const websiteReachabilityActor = new WebsiteReachabilityActor();
