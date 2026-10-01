import { BaseActor, ActorContext } from '@/models/Actor';
import { RawDiscoveredBusiness } from '@/providers/BusinessDiscoveryProvider';
import { isCoordinateInLocation } from '@/lib/geoResolver';

export interface LocationVerificationInput {
  businesses: RawDiscoveredBusiness[];
  state: string;
  city?: string;
}

export interface LocationVerificationOutput {
  verified: RawDiscoveredBusiness[];
  rejected: { business: RawDiscoveredBusiness; reason: string }[];
}

export class LocationVerificationActor extends BaseActor<LocationVerificationInput, LocationVerificationOutput> {
  readonly actorId = 'actor_location_verification';
  readonly name = 'Location Verification Actor';

  protected async run(context: ActorContext<LocationVerificationInput>): Promise<{
    data: LocationVerificationOutput;
    sources: string[];
  }> {
    const { businesses, state, city } = context.input;
    context.onProgress?.(`Verifying geographic boundaries for ${businesses.length} candidates...`);

    const verified: RawDiscoveredBusiness[] = [];
    const rejected: { business: RawDiscoveredBusiness; reason: string }[] = [];

    for (const b of businesses) {
      if (b.latitude && b.longitude) {
        const inBounds = isCoordinateInLocation(b.latitude, b.longitude, state, city);
        if (!inBounds) {
          rejected.push({ business: b, reason: 'OUTSIDE_LOCATION' });
          continue;
        }
      }
      verified.push(b);
    }

    context.onProgress?.(`Location verification complete: ${verified.length} in boundaries, ${rejected.length} outside bounds.`);

    return {
      data: { verified, rejected },
      sources: ['Municipal Boundary Verifier'],
    };
  }
}

export const locationVerificationActor = new LocationVerificationActor();
