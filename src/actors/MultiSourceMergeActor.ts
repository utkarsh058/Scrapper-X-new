import { BaseActor, ActorContext } from '@/models/Actor';
import { RawDiscoveredBusiness } from '@/providers/BusinessDiscoveryProvider';
import { extractDomain } from '@/utils/urlUtils';
import { normalizePhone } from '@/utils/phoneUtils';

export interface MultiSourceMergeOutput {
  merged: RawDiscoveredBusiness[];
  deduplicatedCount: number;
}

export class MultiSourceMergeActor extends BaseActor<RawDiscoveredBusiness[], MultiSourceMergeOutput> {
  readonly actorId = 'actor_multi_source_merge';
  readonly name = 'Multi-Source Merge & Deduplication Actor';

  /**
   * Calculates distance in meters between two lat/lon coordinates using Haversine formula.
   */
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Normalizes business name for loose matching.
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Detects if address contains distinct branch/locality identifiers (e.g. Sector 18 vs Sector 62).
   */
  private extractLocalitySector(address: string, name: string): string {
    const combined = `${name} ${address}`.toLowerCase();
    const sectorMatch = combined.match(/sector\s*[-–]?\s*(\d+[a-z]?)/i);
    if (sectorMatch) return `sector_${sectorMatch[1]}`;

    const blockMatch = combined.match(/block\s*[-–]?\s*([a-z0-9]+)/i);
    if (blockMatch) return `block_${blockMatch[1]}`;

    const mallMatch = combined.match(/(dlf|gip|ansal|venice|logix|gaur|pacific)\s*(mall)?/i);
    if (mallMatch) return `mall_${mallMatch[1]}`;

    return '';
  }

  protected async run(context: ActorContext<RawDiscoveredBusiness[]>): Promise<{
    data: MultiSourceMergeOutput;
    sources: string[];
  }> {
    const candidates = context.input;
    context.onProgress?.(`Merging and cross-deduplicating ${candidates.length} multi-source candidate businesses...`);

    const mergedList: RawDiscoveredBusiness[] = [];
    const seenPrimaryKeys = new Set<string>();
    let deduplicatedCount = 0;

    for (const item of candidates) {
      const primaryKey = `${item.source}:${item.sourceId}`;
      if (seenPrimaryKeys.has(primaryKey)) {
        deduplicatedCount++;
        continue;
      }

      const itemNormName = this.normalizeName(item.businessName);
      const itemDomain = item.website ? extractDomain(item.website) : undefined;
      const itemPhone = normalizePhone(item.phone);
      const itemEmail = item.email?.toLowerCase().trim();
      const itemLocality = this.extractLocalitySector(item.address, item.businessName);

      // Check if this item matches an already accepted candidate in mergedList
      let matchedIndex = -1;

      for (let i = 0; i < mergedList.length; i++) {
        const existing = mergedList[i];
        const existingNormName = this.normalizeName(existing.businessName);
        const existingDomain = existing.website ? extractDomain(existing.website) : undefined;
        const existingPhone = normalizePhone(existing.phone);
        const existingEmail = existing.email?.toLowerCase().trim();
        const existingLocality = this.extractLocalitySector(existing.address, existing.businessName);

        // Branch safety: If both specify distinct sectors/localities (e.g. Sector 18 vs Sector 62),
        // they MUST NOT be merged, even if brand name is identical!
        if (itemLocality && existingLocality && itemLocality !== existingLocality) {
          continue;
        }

        // Branch safety: If both have coordinates and distance > 250 meters, do not merge!
        if (
          item.latitude &&
          item.longitude &&
          existing.latitude &&
          existing.longitude
        ) {
          const distanceMeters = this.getDistanceMeters(
            item.latitude,
            item.longitude,
            existing.latitude,
            existing.longitude
          );
          if (distanceMeters > 250) {
            continue;
          }
        }

        // Rule 1: Matching verified phone or email
        if (
          (itemPhone && existingPhone && itemPhone === existingPhone) ||
          (itemEmail && existingEmail && itemEmail === existingEmail)
        ) {
          matchedIndex = i;
          break;
        }

        // Rule 2: Matching domain AND normalized name
        if (
          itemDomain &&
          existingDomain &&
          itemDomain === existingDomain &&
          (itemNormName.includes(existingNormName) || existingNormName.includes(itemNormName))
        ) {
          matchedIndex = i;
          break;
        }

        // Rule 3: Highly similar name in same city + nearby location
        if (
          itemNormName === existingNormName &&
          (item.city || '').toLowerCase() === (existing.city || '').toLowerCase()
        ) {
          // If neither has coordinates, or coordinates are within 250m
          if (
            (!item.latitude || !existing.latitude) ||
            this.getDistanceMeters(item.latitude!, item.longitude!, existing.latitude!, existing.longitude!) < 250
          ) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        // Merge into existing record!
        deduplicatedCount++;
        const target = mergedList[matchedIndex];

        // Enrich missing fields from new source
        if (!target.phone && item.phone) target.phone = item.phone;
        if (!target.email && item.email) target.email = item.email;
        if (!target.website && item.website) target.website = item.website;
        if (!target.latitude && item.latitude) {
          target.latitude = item.latitude;
          target.longitude = item.longitude;
        }
        if (!target.address && item.address) target.address = item.address;

        // Preserve all source tags
        const existingSources = target.sources || [target.source];
        if (!existingSources.includes(item.source)) {
          existingSources.push(item.source);
        }
        target.sources = existingSources;

        const evidence = target.sourceEvidence || [
          {
            source: target.source,
            sourceId: target.sourceId,
            sourceUrl: target.sourceUrl,
            rawTags: target.rawTags,
          },
        ];
        evidence.push({
          source: item.source,
          sourceId: item.sourceId,
          sourceUrl: item.sourceUrl,
          rawTags: item.rawTags,
        });
        target.sourceEvidence = evidence;
      } else {
        // New unique candidate
        seenPrimaryKeys.add(primaryKey);
        item.sources = item.sources || [item.source];
        item.sourceEvidence = item.sourceEvidence || [
          {
            source: item.source,
            sourceId: item.sourceId,
            sourceUrl: item.sourceUrl,
            rawTags: item.rawTags,
          },
        ];
        mergedList.push(item);
      }
    }

    context.onProgress?.(
      `Multi-source merge complete: ${mergedList.length} unique candidates retained, ${deduplicatedCount} duplicates merged.`,
      mergedList.length
    );

    return {
      data: {
        merged: mergedList,
        deduplicatedCount,
      },
      sources: ['Multi-Source Merge & Deduplication Engine'],
    };
  }
}

export const multiSourceMergeActor = new MultiSourceMergeActor();
