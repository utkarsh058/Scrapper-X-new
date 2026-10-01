import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithContacts } from './ContactExtractionActor';
import { AuditResult, WebsiteAuditProvider } from '@/providers/WebsiteAuditProvider';
import { lighthouseAuditProvider } from '@/providers/LighthouseAuditProvider';
import { leadPilotDb } from '@/db';

export interface BusinessWithAudit extends BusinessWithContacts {
  auditResult?: AuditResult;
}

export class WebsiteAuditActor extends BaseActor<BusinessWithContacts[], BusinessWithAudit[]> {
  readonly actorId = 'actor_website_audit';
  readonly name = 'Website Audit Actor';

  private auditor: WebsiteAuditProvider = lighthouseAuditProvider;

  protected async run(context: ActorContext<BusinessWithContacts[]>): Promise<{
    data: BusinessWithAudit[];
    sources: string[];
  }> {
    const businesses = context.input;
    const withCrawl = businesses.filter((b) => Boolean(b.crawlResult && b.crawlResult.pages.length > 0));

    context.onProgress?.(`Auditing SEO, UX, Performance, and Security for ${withCrawl.length} websites...`);

    const auditMap = new Map<string, AuditResult>();

    for (const b of withCrawl) {
      if (!b.crawlResult) continue;
      const url = b.crawlResult.finalUrl;
      const cacheKey = `audit:${url}`;
      const cached = leadPilotDb.getCache<AuditResult>(cacheKey);

      if (cached) {
        auditMap.set(url, cached);
        continue;
      }

      const audit = await this.auditor.auditWebsite(b.crawlResult);
      leadPilotDb.setCache(cacheKey, audit, 86400000);
      auditMap.set(url, audit);
    }

    const results: BusinessWithAudit[] = businesses.map((b) => ({
      ...b,
      auditResult: b.crawlResult ? auditMap.get(b.crawlResult.finalUrl) : undefined,
    }));

    context.onProgress?.(`Audit complete: ${auditMap.size} websites evaluated.`, auditMap.size);

    return {
      data: results,
      sources: [this.auditor.name],
    };
  }
}

export const websiteAuditActor = new WebsiteAuditActor();
