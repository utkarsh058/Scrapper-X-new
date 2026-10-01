import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithAudit } from './WebsiteAuditActor';
import { ScoreBreakdownItem } from '@/models/Lead';

export interface BusinessWithScore extends BusinessWithAudit {
  leadScore: number;
  scoreBreakdown: ScoreBreakdownItem[];
}

export class LeadScoringActor extends BaseActor<BusinessWithAudit[], BusinessWithScore[]> {
  readonly actorId = 'actor_lead_scoring';
  readonly name = 'Lead Scoring Actor';

  protected async run(context: ActorContext<BusinessWithAudit[]>): Promise<{
    data: BusinessWithScore[];
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Computing evidence-backed commercial opportunity scores...`);

    const results: BusinessWithScore[] = businesses.map((b) => {
      const breakdown: ScoreBreakdownItem[] = [];
      let score = 20; // Base score for existing registered business

      if (!b.websiteUrl) {
        score += 45;
        breakdown.push({
          rule: 'NO_WEBSITE',
          points: 45,
          reason: 'Business has no digital web presence detected. High opportunity for modern website creation.',
        });
      } else {
        const reachability = b.reachability?.status;
        if (reachability === 'UNREACHABLE' || reachability === 'DNS_ERROR' || reachability === 'TIMEOUT') {
          score += 40;
          breakdown.push({
            rule: 'WEBSITE_UNREACHABLE',
            points: 40,
            reason: `Website is currently unreachable (${reachability}). Urgent recovery/rebuild needed.`,
          });
        }

        if (b.reachability?.isHttps === false) {
          score += 20;
          breakdown.push({
            rule: 'INSECURE_HTTP',
            points: 20,
            reason: 'Website lacks modern SSL/HTTPS encryption.',
          });
        }

        const audit = b.auditResult;
        if (audit) {
          if (!audit.ux.mobileViewport) {
            score += 25;
            breakdown.push({
              rule: 'NO_MOBILE_VIEWPORT',
              points: 25,
              reason: 'Website is not mobile responsive.',
            });
          }

          if (!audit.ux.hasPhoneCTA && !audit.ux.hasWhatsAppCTA) {
            score += 15;
            breakdown.push({
              rule: 'NO_CONTACT_CTA',
              points: 15,
              reason: 'Homepage lacks direct click-to-call or WhatsApp engagement buttons.',
            });
          }

          if (audit.performance.loadTimeMs && audit.performance.loadTimeMs > 2500) {
            score += 10;
            breakdown.push({
              rule: 'SLOW_PAGE_SPEED',
              points: 10,
              reason: `Slow initial server load speed (${audit.performance.loadTimeMs}ms).`,
            });
          }
        }
      }

      // Cap at 99
      const finalScore = Math.min(Math.max(score, 10), 99);

      return {
        ...b,
        leadScore: finalScore,
        scoreBreakdown: breakdown,
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
