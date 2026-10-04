import { BaseActor, ActorContext } from '@/models/Actor';
import { VerifiedBusiness } from './BusinessVerificationActor';
import { websiteDiscoveryProvider } from '@/providers/WebsiteDiscoveryProvider';
import { WebsiteReachabilityStatus } from '@/models/Enums';

export interface BusinessWithWebsite extends VerifiedBusiness {
  websiteUrl?: string;
  domain?: string;
  officialWebsite: boolean;
  websiteStatus?: WebsiteReachabilityStatus;
  websiteEvidence?: string;
}

export class WebsiteDiscoveryActor extends BaseActor<VerifiedBusiness[], BusinessWithWebsite[]> {
  readonly actorId = 'actor_website_discovery';
  readonly name = 'Website Discovery Actor';
  readonly timeoutMs = 60000;

  protected async run(context: ActorContext<VerifiedBusiness[]>): Promise<{
    data: BusinessWithWebsite[];
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Discovering and validating websites for ${businesses.length} businesses...`);

    const result: BusinessWithWebsite[] = [];
    let withWebsiteCount = 0;
    let unwebbedSearchCount = 0;
    const MAX_UNWEBBED_SEARCHES = 5; // Targeted search budget to prevent external throttling

    const batchSize = 10;
    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);
      const resolvedBatch = await Promise.all(
        batch.map(async (b) => {
          // If business already has website from OSM or WebSearch
          if (b.website) {
            const res = await websiteDiscoveryProvider.resolveWebsite(
              b.businessName,
              b.city,
              b.state,
              b.website
            );

            const hasWebsite = Boolean(res.websiteUrl && res.domain);
            if (hasWebsite) withWebsiteCount++;

            return {
              ...b,
              websiteUrl: res.websiteUrl,
              domain: res.domain,
              officialWebsite: hasWebsite,
              websiteStatus: res.status,
              websiteEvidence: res.evidence,
            };
          }

          // If no website in source, perform targeted search within budget
          if (unwebbedSearchCount < MAX_UNWEBBED_SEARCHES) {
            unwebbedSearchCount++;
            const res = await websiteDiscoveryProvider.resolveWebsite(
              b.businessName,
              b.city,
              b.state,
              undefined
            );

            const hasWebsite = Boolean(res.websiteUrl && res.domain);
            if (hasWebsite) withWebsiteCount++;

            return {
              ...b,
              websiteUrl: res.websiteUrl,
              domain: res.domain,
              officialWebsite: hasWebsite,
              websiteStatus: res.status,
              websiteEvidence: res.evidence,
            };
          }

          // Outside search budget and no website provided in sources
          return {
            ...b,
            websiteUrl: b.websiteUrl ?? b.website ?? undefined,
            officialWebsite: false,
            websiteStatus: 'NOT_FOUND' as const,
            websiteEvidence: 'No website recorded in source discovery',
          };
        })
      );

      result.push(...resolvedBatch);
    }

    context.onProgress?.(`Website discovery complete: ${withWebsiteCount} websites identified.`, withWebsiteCount);

    return {
      data: result,
      sources: [websiteDiscoveryProvider.name],
    };
  }
}

export const websiteDiscoveryActor = new WebsiteDiscoveryActor();
