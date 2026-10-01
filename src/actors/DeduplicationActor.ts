import { BaseActor, ActorContext } from '@/models/Actor';
import { VerifiedBusiness } from './BusinessVerificationActor';

export interface DeduplicationOutput {
  unique: VerifiedBusiness[];
  duplicatesCount: number;
}

export class DeduplicationActor extends BaseActor<VerifiedBusiness[], DeduplicationOutput> {
  readonly actorId = 'actor_deduplication';
  readonly name = 'Deduplication Actor';

  protected async run(context: ActorContext<VerifiedBusiness[]>): Promise<{
    data: DeduplicationOutput;
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Deduplicating ${businesses.length} candidate businesses...`);

    const seenSourceIds = new Set<string>();
    const seenLocations = new Map<string, { lat: number; lon: number }>();
    const unique: VerifiedBusiness[] = [];
    let duplicatesCount = 0;

    for (const b of businesses) {
      // 1. Primary Source ID check
      const primaryKey = `${b.source}:${b.sourceId}`;
      if (seenSourceIds.has(primaryKey)) {
        duplicatesCount++;
        continue;
      }

      // 2. Secondary Name + Proximity check
      // Multiple branches (e.g. McDonald's in different locations) must NOT be merged.
      // Only merge if normalized name matches AND location is within ~50 meters.
      const normalizedName = b.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let isDuplicateLocation = false;

      if (b.latitude && b.longitude) {
        const existingLoc = seenLocations.get(normalizedName);
        if (existingLoc) {
          const latDiff = Math.abs(existingLoc.lat - b.latitude);
          const lonDiff = Math.abs(existingLoc.lon - b.longitude);
          // ~0.0005 degrees is approx 50 meters
          if (latDiff < 0.0005 && lonDiff < 0.0005) {
            isDuplicateLocation = true;
          }
        }
      }

      if (isDuplicateLocation) {
        duplicatesCount++;
        continue;
      }

      seenSourceIds.add(primaryKey);
      if (b.latitude && b.longitude) {
        seenLocations.set(normalizedName, { lat: b.latitude, lon: b.longitude });
      }
      unique.push(b);
    }

    context.onProgress?.(`Deduplication complete: ${unique.length} unique businesses retained.`);

    return {
      data: { unique, duplicatesCount },
      sources: ['Deduplication Matrix'],
    };
  }
}

export const deduplicationActor = new DeduplicationActor();
