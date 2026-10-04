/**
 * Business Eligibility Service
 * 
 * Strict Single Responsibility:
 * Evaluates business eligibility against business rules, specifically the 5-star rating exclusion.
 * 
 * Rules:
 * - 5.0 rating -> EXCLUDE (Reason: PERFECT_5_STAR_RATING)
 * - 4.9 rating -> KEEP (Included: true)
 * - 4.8 rating -> KEEP (Included: true)
 * - null rating -> KEEP (Included: true, NEVER assume null === 5.0)
 * - Excluded businesses are NOT deleted; they are preserved with eligibility metadata
 * - Optional minReviews / maxReviews checks
 */

import { CanonicalBusiness, SearchFilters } from '@/types/canonical';

export interface EligibilityResult {
  included: boolean;
  excludedReason: string | null;
}

export class BusinessEligibilityService {
  /**
   * Evaluates whether a business passes search eligibility criteria
   */
  public evaluate(
    business: CanonicalBusiness,
    filters?: SearchFilters
  ): EligibilityResult {
    const rating = business.google?.rating ?? null;
    const reviewCount = business.google?.reviewCount ?? null;

    // Rule 1: Exclude perfect 5.0 ratings by default (or if explicitly requested)
    const shouldExcludePerfect = filters?.excludePerfectRating !== false; // default true
    if (shouldExcludePerfect && rating !== null && Math.abs(rating - 5.0) < 0.001) {
      return {
        included: false,
        excludedReason: 'PERFECT_5_STAR_RATING',
      };
    }

    // Rule 2: Minimum Reviews
    if (typeof filters?.minReviews === 'number' && filters.minReviews > 0) {
      if (reviewCount === null || reviewCount < filters.minReviews) {
        return {
          included: false,
          excludedReason: `INSUFFICIENT_REVIEWS: Has ${reviewCount ?? 0}, minimum required is ${filters.minReviews}`,
        };
      }
    }

    // Rule 3: Maximum Reviews
    if (typeof filters?.maxReviews === 'number') {
      if (reviewCount !== null && reviewCount > filters.maxReviews) {
        return {
          included: false,
          excludedReason: `EXCEEDS_MAX_REVIEWS: Has ${reviewCount}, maximum allowed is ${filters.maxReviews}`,
        };
      }
    }

    // Rule 4: Minimum Rating
    if (typeof filters?.minRating === 'number') {
      if (rating !== null && rating < filters.minRating) {
        return {
          included: false,
          excludedReason: `RATING_BELOW_MINIMUM: Has ${rating}, minimum is ${filters.minRating}`,
        };
      }
    }

    // Rule 5: Maximum Rating
    if (typeof filters?.maxRating === 'number') {
      if (rating !== null && rating > filters.maxRating) {
        return {
          included: false,
          excludedReason: `RATING_ABOVE_MAXIMUM: Has ${rating}, maximum is ${filters.maxRating}`,
        };
      }
    }

    // Rule 6: Website requirement
    if (filters?.hasWebsite === true && !business.identity.website) {
      return {
        included: false,
        excludedReason: 'MISSING_WEBSITE',
      };
    }

    // Rule 7: Phone requirement
    if (filters?.hasPhone === true && !business.identity.phone) {
      return {
        included: false,
        excludedReason: 'MISSING_PHONE',
      };
    }

    // Rule 8: Email requirement
    if (filters?.hasEmail === true && !business.identity.email) {
      return {
        included: false,
        excludedReason: 'MISSING_EMAIL',
      };
    }

    return {
      included: true,
      excludedReason: null,
    };
  }

  /**
   * Applies eligibility evaluation in-place and returns partitioned arrays
   */
  public filterBusinesses(
    businesses: CanonicalBusiness[],
    filters?: SearchFilters
  ): { eligible: CanonicalBusiness[]; excluded: CanonicalBusiness[] } {
    const eligible: CanonicalBusiness[] = [];
    const excluded: CanonicalBusiness[] = [];

    for (const b of businesses) {
      const result = this.evaluate(b, filters);
      b.eligibility = result;
      if (result.included) {
        eligible.push(b);
      } else {
        excluded.push(b);
      }
    }

    return { eligible, excluded };
  }
}

export const businessEligibilityService = new BusinessEligibilityService();
