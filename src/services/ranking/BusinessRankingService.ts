/**
 * Business Ranking Service
 * 
 * Strict Single Responsibility:
 * Deterministic, explainable ranking of Canonical Businesses.
 * 
 * Ranking Logic:
 * 1. Eligible businesses always rank above excluded businesses.
 * 2. reviewCount DESC (higher review counts demonstrate proven market presence).
 * 3. rating DESC (higher ratings ranked higher for same review count tier).
 * 4. name ASC (stable deterministic tie-breaker).
 * 
 * Boundary Constraints:
 * - Independent of any provider API.
 * - Does not use opaque unexplainable AI scores.
 * - Assigns explicit ranks: reviewCountRank, ratingRank, overallRank.
 */

import { CanonicalBusiness, SearchSort } from '@/types/canonical';

export interface RankingOptions {
  sort?: SearchSort;
}

export class BusinessRankingService {
  /**
   * Ranks an array of CanonicalBusiness objects deterministically.
   * Modifies each business's ranking object and returns the sorted array.
   */
  public rank(
    businesses: CanonicalBusiness[],
    options?: RankingOptions
  ): CanonicalBusiness[] {
    const list = [...businesses];

    const sortField = options?.sort?.field || 'reviewCount';
    const sortDirection = options?.sort?.direction || 'desc';
    const isAsc = sortDirection === 'asc';

    list.sort((a, b) => {
      // 1. Ineligible (e.g. 5.0 excluded) always placed after eligible
      if (a.eligibility.included !== b.eligibility.included) {
        return a.eligibility.included ? -1 : 1;
      }

      // 2. Primary sorting by requested field
      if (sortField === 'reviewCount') {
        const rCountA = a.google?.reviewCount ?? -1;
        const rCountB = b.google?.reviewCount ?? -1;
        if (rCountA !== rCountB) {
          return isAsc ? rCountA - rCountB : rCountB - rCountA;
        }
        // Secondary sort: rating DESC
        const ratingA = a.google?.rating ?? -1;
        const ratingB = b.google?.rating ?? -1;
        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }
      } else if (sortField === 'rating') {
        const ratingA = a.google?.rating ?? -1;
        const ratingB = b.google?.rating ?? -1;
        if (ratingA !== ratingB) {
          return isAsc ? ratingA - ratingB : ratingB - ratingA;
        }
        // Secondary sort: reviewCount DESC
        const rCountA = a.google?.reviewCount ?? -1;
        const rCountB = b.google?.reviewCount ?? -1;
        if (rCountA !== rCountB) {
          return rCountB - rCountA;
        }
      } else if (sortField === 'name') {
        const comp = a.identity.name.localeCompare(b.identity.name);
        if (comp !== 0) return isAsc ? comp : -comp;
      }

      // Final stable tie-breaker: deterministic alphabetical
      return a.identity.name.localeCompare(b.identity.name);
    });

    // Assign rank positions to eligible businesses
    let overallRank = 1;
    for (const b of list) {
      if (b.eligibility.included) {
        b.ranking = {
          overallRank,
          reviewCountRank: overallRank, // for default sort
          ratingRank: overallRank,
        };
        overallRank++;
      } else {
        b.ranking = {
          overallRank: undefined,
          reviewCountRank: undefined,
          ratingRank: undefined,
        };
      }
    }

    return list;
  }
}

export const businessRankingService = new BusinessRankingService();
