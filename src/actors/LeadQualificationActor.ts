import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithAudit } from './WebsiteAuditActor';

export interface LeadQualificationInput {
  businesses: BusinessWithAudit[];
  contactFilter?: string;
  websiteFilter?: string;
}

export interface LeadQualificationOutput {
  qualified: BusinessWithAudit[];
  rejected: { business: BusinessWithAudit; reason: string }[];
}

export class LeadQualificationActor extends BaseActor<LeadQualificationInput, LeadQualificationOutput> {
  readonly actorId = 'actor_lead_qualification';
  readonly name = 'Lead Qualification Actor';

  private evaluateContact(b: BusinessWithAudit, filter: string = 'All Contacts'): { match: boolean; reason?: string } {
    const hasPhone = Boolean(b.phone && b.phone.trim().length > 0);
    const hasEmail = Boolean(b.email && b.email.trim().length > 0);
    const norm = filter.toUpperCase().replace(/\s+/g, '_');

    if (norm === 'ALL_CONTACTS' || norm === 'ANY_CONTACT') return { match: true };
    if (norm === 'EMAIL_AND_PHONE' || norm === 'EMAIL_+_PHONE') {
      return hasPhone && hasEmail ? { match: true } : { match: false, reason: 'NO_CONTACT' };
    }
    if (norm === 'EMAIL_ONLY') {
      return hasEmail && !hasPhone ? { match: true } : { match: false, reason: 'NO_CONTACT' };
    }
    if (norm === 'PHONE_ONLY') {
      return hasPhone && !hasEmail ? { match: true } : { match: false, reason: 'NO_CONTACT' };
    }
    if (norm === 'NO_CONTACT') {
      return !hasPhone && !hasEmail ? { match: true } : { match: false, reason: 'NOT_QUALIFIED' };
    }
    if (norm === 'PHONE_OR_EMAIL' || norm === 'HAS_PHONE_OR_EMAIL') {
      return hasPhone || hasEmail ? { match: true } : { match: false, reason: 'NO_CONTACT' };
    }
    return { match: true };
  }

  private evaluateWebsite(b: BusinessWithAudit, filter: string = 'Any Website'): { match: boolean; reason?: string } {
    const hasUrl = Boolean(b.websiteUrl);
    const reachability = b.reachability?.status;
    const norm = filter.toUpperCase().replace(/\s+/g, '_');

    if (norm === 'ANY_WEBSITE' || norm === 'ALL_WEBSITES') return { match: true };

    if (norm === 'NO_WEBSITE') {
      return !hasUrl || reachability === 'UNREACHABLE' || reachability === 'DNS_ERROR'
        ? { match: true }
        : { match: false, reason: 'HAS_WEBSITE' };
    }

    if (norm === 'WEBSITE_AVAILABLE') {
      return hasUrl && reachability !== 'UNREACHABLE' && reachability !== 'DNS_ERROR'
        ? { match: true }
        : { match: false, reason: 'NO_WEBSITE' };
    }

    if (norm === 'NEEDS_IMPROVEMENT') {
      const issues = b.auditResult?.issues || [];
      const score = b.auditResult?.overallScore ?? 100;
      return hasUrl && (issues.length > 0 || score < 80)
        ? { match: true }
        : { match: false, reason: 'AUDIT_FAILED' };
    }

    if (norm === 'UNREACHABLE') {
      return hasUrl && (reachability === 'UNREACHABLE' || reachability === 'DNS_ERROR' || reachability === 'TIMEOUT')
        ? { match: true }
        : { match: false, reason: 'WEBSITE_UNREACHABLE' };
    }

    return { match: true };
  }

  protected async run(context: ActorContext<LeadQualificationInput>): Promise<{
    data: LeadQualificationOutput;
    sources: string[];
  }> {
    const { businesses, contactFilter = 'All Contacts', websiteFilter = 'Any Website' } = context.input;
    context.onProgress?.(`Applying qualification filters: Contact="${contactFilter}", Website="${websiteFilter}"...`);

    const qualified: BusinessWithAudit[] = [];
    const rejected: { business: BusinessWithAudit; reason: string }[] = [];

    for (const b of businesses) {
      const contactEval = this.evaluateContact(b, contactFilter);
      if (!contactEval.match) {
        rejected.push({ business: b, reason: contactEval.reason || 'NO_CONTACT' });
        continue;
      }

      const websiteEval = this.evaluateWebsite(b, websiteFilter);
      if (!websiteEval.match) {
        rejected.push({ business: b, reason: websiteEval.reason || 'NO_WEBSITE' });
        continue;
      }

      qualified.push(b);
    }

    context.onProgress?.(`Finding qualified leads: ${qualified.length} matching criteria.`, qualified.length);

    return {
      data: { qualified, rejected },
      sources: ['Lead Qualification Engine'],
    };
  }
}

export const leadQualificationActor = new LeadQualificationActor();
