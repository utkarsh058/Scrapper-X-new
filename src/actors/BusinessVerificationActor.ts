import { BaseActor, ActorContext } from '@/models/Actor';
import { RawDiscoveredBusiness } from '@/providers/BusinessDiscoveryProvider';
import { BusinessVerificationStatus } from '@/models/Enums';

export interface VerifiedBusiness extends RawDiscoveredBusiness {
  businessVerificationStatus: BusinessVerificationStatus;
}

export interface BusinessVerificationOutput {
  verified: VerifiedBusiness[];
  rejected: { business: RawDiscoveredBusiness; reason: string }[];
}

export class BusinessVerificationActor extends BaseActor<RawDiscoveredBusiness[], BusinessVerificationOutput> {
  readonly actorId = 'actor_business_verification';
  readonly name = 'Business Verification Actor';

  protected async run(context: ActorContext<RawDiscoveredBusiness[]>): Promise<{
    data: BusinessVerificationOutput;
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Verifying business identity for ${businesses.length} candidates...`);

    const verified: VerifiedBusiness[] = [];
    const rejected: { business: RawDiscoveredBusiness; reason: string }[] = [];

    for (const b of businesses) {
      const name = b.businessName ? b.businessName.trim() : '';

      // Missing name check
      if (!name || name.length < 2 || name.toLowerCase() === 'unnamed' || name.toLowerCase() === 'no name') {
        rejected.push({ business: b, reason: 'MISSING_NAME' });
        continue;
      }

      // Check category sanity
      if (!b.category || b.category.trim().length === 0) {
        rejected.push({ business: b, reason: 'INVALID_CATEGORY' });
        continue;
      }

      let status: BusinessVerificationStatus = 'VERIFIED';
      if (!b.address || (!b.phone && !b.website)) {
        status = 'PARTIAL';
      }

      verified.push({
        ...b,
        businessVerificationStatus: status,
      });
    }

    context.onProgress?.(`Business verification complete: ${verified.length} verified.`);

    return {
      data: { verified, rejected },
      sources: ['Business Identity Engine'],
    };
  }
}

export const businessVerificationActor = new BusinessVerificationActor();
