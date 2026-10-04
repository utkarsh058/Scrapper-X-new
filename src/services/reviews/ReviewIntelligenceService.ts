/**
 * Review Intelligence Service
 * 
 * Strict Single Responsibility:
 * Processes and canonicalizes Google Place review metrics and review-level items.
 * 
 * Boundary Constraints:
 * - Does NOT invent positive/negative review count or fake sentiment distributions.
 * - Only reports reviewLevelDataAvailable = true when actual review text is genuinely retrieved.
 * - earliestAvailableReviewDate derived strictly from real retrieved reviews, never guessed.
 */

import { ReviewSummary } from '@/types/canonical';
import { googlePlacesProvider } from '@/providers/google/GooglePlacesProvider';

export class ReviewIntelligenceService {
  /**
   * Fetches review summary for a given placeId from Google Places (New) Details
   */
  public async getReviewSummary(placeId: string): Promise<ReviewSummary> {
    const detailsResult = await googlePlacesProvider.getPlaceDetails(placeId);

    if (detailsResult.status !== 'SUCCESS' || !detailsResult.details) {
      return {
        rating: null,
        reviewCount: null,
        reviewLevelDataAvailable: false,
        earliestAvailableReviewDate: null,
        source: 'google_places',
        capturedAt: new Date(),
      };
    }

    const { details } = detailsResult;
    const reviews = details.reviews || [];
    const reviewLevelDataAvailable = reviews.length > 0;

    let earliestAvailableReviewDate: Date | null = null;
    if (reviewLevelDataAvailable) {
      const dates = reviews
        .map((r) => r.publishTime)
        .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

      if (dates.length > 0) {
        dates.sort((a, b) => a.getTime() - b.getTime());
        earliestAvailableReviewDate = dates[0];
      }
    }

    // Only compute sentiment distribution if actual review text items exist
    let sentimentDistribution: ReviewSummary['sentimentDistribution'] = undefined;
    if (reviewLevelDataAvailable) {
      let positive = 0;
      let neutral = 0;
      let negative = 0;

      for (const r of reviews) {
        if (r.rating >= 4) {
          positive++;
        } else if (r.rating === 3) {
          neutral++;
        } else if (r.rating > 0) {
          negative++;
        }
      }

      sentimentDistribution = {
        positive,
        neutral,
        negative,
      };
    }

    return {
      rating: details.rating,
      reviewCount: details.reviewCount,
      reviewLevelDataAvailable,
      earliestAvailableReviewDate,
      sentimentDistribution,
      source: 'google_places',
      capturedAt: new Date(),
    };
  }

  /**
   * Pure summary builder from an existing candidate (when place details fetch isn't invoked)
   */
  public buildSummaryFromCandidate(
    rating: number | null,
    reviewCount: number | null,
    source: string = 'google_places'
  ): ReviewSummary {
    return {
      rating,
      reviewCount,
      reviewLevelDataAvailable: false,
      earliestAvailableReviewDate: null,
      source,
      capturedAt: new Date(),
    };
  }
}

export const reviewIntelligenceService = new ReviewIntelligenceService();
