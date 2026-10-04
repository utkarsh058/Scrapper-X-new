import { CommercialResearchProvider, ParsedMilestone, commercialResearchProvider } from './providers/CommercialResearchProvider';
import { prisma } from '@/lib/prisma';
import { CanonicalBusinessIdentity } from '@/types/canonical';

export class CommercialMilestoneService {
  private provider: CommercialResearchProvider;

  constructor() {
    this.provider = commercialResearchProvider;
  }

  /**
   * Main entry point to enrich a business with commercial milestones.
   */
  public async enrichMilestones(
    businessId: string,
    identity: CanonicalBusinessIdentity,
    options?: {
      providedTexts?: Array<{ text: string; sourceUrl: string; sourceType: ParsedMilestone['sourceType'] }>;
    }
  ) {
    let allDiscovered: ParsedMilestone[] = [];

    // If text context is provided (e.g. from tests or website crawler), parse it.
    if (options?.providedTexts && options.providedTexts.length > 0) {
      for (const item of options.providedTexts) {
        const milestones = this.provider.parseMilestonesFromText(item.text, item.sourceUrl, item.sourceType);
        allDiscovered.push(...milestones);
      }
    }

    // Identify the earliest milestone by sorting by date ascending.
    // If we have multiple milestones, we keep all of them but we can flag the earliest.
    // Actually, we should just persist all discovered verifiable milestones.
    const uniqueMilestones = this.deduplicateMilestones(allDiscovered);

    // Persist milestones
    for (const milestone of uniqueMilestones) {
      await this.persistMilestone(businessId, milestone);
    }

    return uniqueMilestones;
  }

  private deduplicateMilestones(milestones: ParsedMilestone[]): ParsedMilestone[] {
    const seen = new Set<string>();
    const unique: ParsedMilestone[] = [];
    
    for (const m of milestones) {
      const key = `${m.metricType}-${m.amount}-${m.period || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }
    
    return unique;
  }

  private async persistMilestone(businessId: string, milestone: ParsedMilestone) {
    try {
      // Find if an existing milestone with same type and period/amount exists
      const existing = await prisma.commercialMilestone.findFirst({
        where: {
          businessId,
          metricType: milestone.metricType,
          amount: milestone.amount,
          period: milestone.period
        }
      });

      if (!existing) {
        await prisma.commercialMilestone.create({
          data: {
            businessId,
            metricType: milestone.metricType,
            amount: milestone.amount,
            currency: milestone.currency,
            formattedAmount: milestone.formattedAmount,
            date: milestone.date,
            datePrecision: milestone.datePrecision,
            period: milestone.period,
            sourceUrl: milestone.sourceUrl,
            sourceType: milestone.sourceType,
            evidenceText: milestone.evidenceText,
            confidence: milestone.confidence,
            status: 'VERIFIED'
          }
        });
      }
    } catch (e) {
      console.error('Error persisting commercial milestone:', e);
    }
  }

  public async getMilestonesForBusiness(businessId: string) {
    return await prisma.commercialMilestone.findMany({
      where: { businessId },
      orderBy: {
        date: 'asc'
      }
    });
  }
}

export const commercialMilestoneService = new CommercialMilestoneService();
