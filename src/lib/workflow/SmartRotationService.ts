import { LeadEntity } from '@/models/Lead';
import { leadHistoryService, LeadHistoryRecord } from './LeadHistoryService';

export interface RotationResult {
  orderedLeads: LeadEntity[];
  stats: {
    totalEvaluated: number;
    deliveredCount: number;
    newEligibleCount: number;
    recentlyDeliveredCount: number;
  };
}

function createSeededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(array: T[], rng: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export class SmartRotationService {
  /**
   * Genuine diversification: separates candidates into unseen vs recently-delivered,
   * then applies search-specific seeded randomization for fair distribution.
   */
  public async rotateCandidates(
    jobId: string,
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
  ): Promise<RotationResult> {
    const recentPlaceIds = await leadHistoryService.getRecentDeliveredPlaceIds(fingerprintKey, 7); // exclude last 7 days

    const newCandidates: LeadEntity[] = [];
    const seenCandidates: LeadEntity[] = [];

    for (const lead of candidates) {
      const placeId = lead.googlePlaceId || lead.osmId || lead.leadId;
      if (recentPlaceIds.has(placeId)) {
        seenCandidates.push(lead);
      } else {
        newCandidates.push(lead);
      }
    }

    const rng = createSeededRandom(jobId);
    shuffle(newCandidates, rng);
    shuffle(seenCandidates, rng);

    // Prefer new/unseen candidates, but allow seen candidates to backfill if we don't have enough
    const prioritized = [...newCandidates, ...seenCandidates];
    const delivered = prioritized.slice(0, requestedLimit);

    // Persist delivery so they are excluded in the immediate next identical search
    const deliveryRecords = delivered.map(l => ({
      placeId: l.googlePlaceId || l.osmId || l.leadId,
      name: l.businessName
    }));
    await leadHistoryService.recordDeliveryToDb(fingerprintKey, jobId, deliveryRecords);

    return {
      orderedLeads: delivered,
      stats: {
        totalEvaluated: candidates.length,
        deliveredCount: delivered.length,
        newEligibleCount: newCandidates.length,
        recentlyDeliveredCount: seenCandidates.length,
      },
    };
  }
}

export const smartRotationService = new SmartRotationService();
