import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithAudit } from './WebsiteAuditActor';
import { ScoreBreakdownItem } from '@/models/Lead';

import { calculateLeadScore } from '@/lib/scoring/leadScoreCalculator';

export interface BusinessWithScore extends BusinessWithAudit {
  leadScore: number;
  scoreBreakdown: ScoreBreakdownItem[];
}

export class LeadScoringActor extends BaseActor<BusinessWithAudit[], BusinessWithScore[]> {
  readonly actorId = 'actor_lead_scoring';
  readonly name = 'Lead Scoring Actor';
  readonly priority = 'LOW' as const;
  readonly blocking = false;
  readonly timeoutMs = 5000;
  readonly dependencies = ['actor_lead_qualification'];

  protected async run(context: ActorContext<BusinessWithAudit[]>): Promise<{
    data: BusinessWithScore[];
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Computing evidence-backed commercial opportunity scores...`);

    const results: BusinessWithScore[] = businesses.map((b) => {
      const phone = b.phone || (b as any).contacts?.find((c: any) => c.type === 'phone')?.value;
      const email = b.email || (b as any).contacts?.find((c: any) => c.type === 'email')?.value;
      const reachStatus = (b.reachability?.status as string) || '';
      const isUnreachable =
        reachStatus === 'UNREACHABLE' ||
        reachStatus === 'DNS_ERROR' ||
        reachStatus === 'TIMEOUT' ||
        reachStatus === 'SSL_ERROR';
      const isWorking =
        reachStatus === 'FOUND' ||
        reachStatus === 'LIVE' ||
        reachStatus === 'Working' ||
        reachStatus === 'OK';

      const websiteStatus = !b.websiteUrl
        ? 'No Website'
        : isUnreachable
        ? 'Unreachable'
        : (b.auditResult?.issues?.length || 0) > 0 || (b.auditResult?.overallScore || 100) < 80
        ? 'Needs Improvement'
        : isWorking
        ? 'Working'
        : 'Working';

      const res = calculateLeadScore({
        businessName: b.businessName,
        category: b.category,
        address: (b as any).address,
        city: b.city,
        state: b.state,
        phone,
        email,
        website: b.websiteUrl,
        websiteStatus,
        https: b.reachability?.isHttps ?? (b.websiteUrl?.startsWith('https') || false),
        locationVerificationStatus: (b as any).locationVerificationStatus || 'VERIFIED',
        businessVerificationStatus: 'VERIFIED',
        sources: b.sources || (b.source ? [b.source] : ['google_places']),
        rawTags: b.rawTags,
        audit: b.auditResult,
      });

      return {
        ...b,
        leadScore: res.score,
        scoreBreakdown: res.breakdown,
      };
    });

    context.onProgress?.(`Lead scoring complete for ${results.length} qualified leads.`);

    return {
      data: results,
      sources: ['Opportunity Scoring Engine'],
    };
  }
}

export const leadScoringActor = new LeadScoringActor();
