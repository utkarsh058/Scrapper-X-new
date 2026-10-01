import { LeadEntity } from '@/models/Lead';
import { leadHistoryService, LeadHistoryRecord } from './LeadHistoryService';

export interface RotationResult {
  orderedLeads: LeadEntity[];
  stats: {
    totalEvaluated: number;
    deliveredCount: number;
    neverReturnedCount: number;
    previouslyReturnedCount: number;
    previouslyContactedCount: number;
    excludedDoNotContactCount: number;
  };
}

export class SmartRotationService {
  /**
   * Applies deterministic 6-tier smart rotation ranking to candidate leads.
   * Maximizes unique, uncontacted business opportunities across repeated identical searches.
   */
  public rotateCandidates(
    candidates: LeadEntity[],
    requestedLimit: number,
    fingerprintKey: string,
    searchParams?: {
      country?: string;
      state: string;
      city?: string;
      industry: string;
      contactFilter?: string;
      websiteFilter?: string;
    }
  ): RotationResult {
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const tier1: LeadEntity[] = []; // Never returned + contactable
    const tier2: LeadEntity[] = []; // Previously returned + never contacted
    const tier3: LeadEntity[] = []; // Previously returned + not contacted recently (> 7 days)
    const tier4: LeadEntity[] = []; // Previously contacted (> 7 days ago)
    const tier5: LeadEntity[] = []; // Recently contacted (<= 7 days ago)
    const excluded: LeadEntity[] = []; // DO_NOT_CONTACT / INVALID_CONTACT

    for (const lead of candidates) {
      const placeId = lead.googlePlaceId || lead.osmId || lead.leadId;
      const history: LeadHistoryRecord | undefined = leadHistoryService.getHistory(placeId);

      // Check contact criteria
      const hasPhone = Boolean(lead.phone);
      const hasEmail = Boolean(lead.email);
      const hasContact = hasPhone || hasEmail;

      if (!history || history.timesReturned === 0) {
        // Never returned
        if (hasContact) {
          tier1.push(lead);
        } else {
          tier2.push(lead);
        }
      } else {
        // Has prior history
        const status = history.contactStatus;

        if (status === 'DO_NOT_CONTACT' || status === 'INVALID_CONTACT') {
          excluded.push(lead);
        } else if (status === 'NOT_CONTACTED') {
          tier2.push(lead);
        } else {
          // Contacted, check freshness
          const lastContactMs = history.lastContactedAt ? new Date(history.lastContactedAt).getTime() : 0;
          const timeSinceContact = now - lastContactMs;

          if (timeSinceContact > SEVEN_DAYS_MS) {
            tier4.push(lead);
          } else {
            tier5.push(lead);
          }
        }
      }
    }

    // --- SORTING WITHIN TIERS ---
    // Tier 1: Prefer both phone & email, then phone, then email
    tier1.sort((a, b) => {
      const aScore = (a.phone ? 2 : 0) + (a.email ? 1 : 0);
      const bScore = (b.phone ? 2 : 0) + (b.email ? 1 : 0);
      return bScore - aScore;
    });

    // Tier 2: Prefer candidates returned fewer times, then oldest seen
    tier2.sort((a, b) => {
      const aId = a.googlePlaceId || a.osmId || a.leadId;
      const bId = b.googlePlaceId || b.osmId || b.leadId;
      const aHist = leadHistoryService.getHistory(aId);
      const bHist = leadHistoryService.getHistory(bId);

      const aTimes = aHist?.timesReturned || 0;
      const bTimes = bHist?.timesReturned || 0;
      if (aTimes !== bTimes) return aTimes - bTimes;

      const aLast = aHist?.lastSeenAt ? new Date(aHist.lastSeenAt).getTime() : 0;
      const bLast = bHist?.lastSeenAt ? new Date(bHist.lastSeenAt).getTime() : 0;
      return aLast - bLast;
    });

    // Tier 4: Longest time since contacted first
    tier4.sort((a, b) => {
      const aId = a.googlePlaceId || a.osmId || a.leadId;
      const bId = b.googlePlaceId || b.osmId || b.leadId;
      const aHist = leadHistoryService.getHistory(aId);
      const bHist = leadHistoryService.getHistory(bId);
      const aLast = aHist?.lastContactedAt ? new Date(aHist.lastContactedAt).getTime() : 0;
      const bLast = bHist?.lastContactedAt ? new Date(bHist.lastContactedAt).getTime() : 0;
      return aLast - bLast;
    });

    // Combine tiers according to priority
    const prioritized = [...tier1, ...tier2, ...tier3, ...tier4, ...tier5];
    const delivered = prioritized.slice(0, requestedLimit);

    // Record delivery in history for delivered candidates
    const deliveredPlaceIds = delivered.map((l) => l.googlePlaceId || l.osmId || l.leadId);
    const metaMap = new Map<string, { name: string; city?: string; state?: string; leadId?: string }>();
    for (const l of delivered) {
      const pId = l.googlePlaceId || l.osmId || l.leadId;
      metaMap.set(pId, {
        name: l.businessName,
        city: l.city,
        state: l.state,
        leadId: l.leadId,
      });
    }

    leadHistoryService.recordDelivery(fingerprintKey, deliveredPlaceIds, metaMap, searchParams);

    return {
      orderedLeads: delivered,
      stats: {
        totalEvaluated: candidates.length,
        deliveredCount: delivered.length,
        neverReturnedCount: tier1.length,
        previouslyReturnedCount: tier2.length + tier3.length,
        previouslyContactedCount: tier4.length + tier5.length,
        excludedDoNotContactCount: excluded.length,
      },
    };
  }
}

export const smartRotationService = new SmartRotationService();
