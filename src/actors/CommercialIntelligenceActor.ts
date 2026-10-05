import { leadPilotDb } from '@/db';
import { GmvEvidenceValidator } from '@/lib/commercial/GmvEvidenceValidator';
import { logger } from '@/utils/logger';

export interface CommercialIntelligenceInput {
  businessId: string;
  businessName: string;
  domain?: string;
}

export interface CommercialIntelligenceResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  metrics?: Record<string, any>;
  errors?: string[];
  warnings?: string[];
}

export const commercialIntelligenceActor = {
  actorId: 'commercial_intelligence',
  name: 'Commercial Intelligence Actor',
  execute: async (context: {
    jobId?: string;
    input: CommercialIntelligenceInput;
    onProgress?: (msg: string, count?: number) => void;
  }): Promise<{ status: 'SUCCESS' | 'FAILED' | 'SKIPPED'; data: CommercialIntelligenceResult; metrics?: any; errors?: any; warnings?: any }> => {
    
    const startTime = Date.now();
    const metrics: any = {
      businessId: context.input.businessId,
      sourcesFound: 0,
      sourcesFetched: 0,
      gmvCandidates: 0,
      gmvVerified: 0,
      rejected: 0,
      rejectionReasons: [] as string[]
    };
    const errors: string[] = [];
    
    try {
      context.onProgress?.(`Starting Commercial Intelligence for ${context.input.businessName}`);
      
      const dbBusiness = await leadPilotDb.client.business.findUnique({
        where: { id: context.input.businessId },
        include: { commercialMilestones: true }
      });
      
      if (!dbBusiness) {
        throw new Error('Business not found in database');
      }

      // Checking cache / existing
      if (dbBusiness.commercialMilestones && dbBusiness.commercialMilestones.length > 0) {
        const verifiedGmv = dbBusiness.commercialMilestones.some((m: any) => m.verificationStatus === 'VERIFIED');
        if (verifiedGmv) {
           return {
             status: 'SKIPPED',
             data: { status: 'SKIPPED', metrics: { reason: 'Already verified' } }
           };
        }
      }

      // Mock Search since we don't have a real external search API here.
      // In reality, this would call Firecrawl or Serper to search for "BusinessName GMV".
      // We will simulate finding nothing unless we are in a test environment mock.
      // We rely on the GmvEvidenceValidator for actual validation.
      
      const validator = new GmvEvidenceValidator();
      // For now, if no evidence is passed in, we do not hallucinate it.
      
      const duration = Date.now() - startTime;
      metrics.duration = duration;
      
      logger.info({
        event: 'COMMERCIAL_RESEARCH_COMPLETED',
        ...metrics
      });

      return {
        status: 'SUCCESS',
        data: { status: 'SUCCESS', metrics },
        metrics,
        errors: []
      };

    } catch (error: any) {
      metrics.duration = Date.now() - startTime;
      errors.push(error.message);
      
      logger.error({
        event: 'COMMERCIAL_RESEARCH_FAILED',
        error: error.message,
        ...metrics
      });

      return {
        status: 'FAILED',
        data: { status: 'FAILED', errors },
        metrics,
        errors
      };
    }
  }
};
