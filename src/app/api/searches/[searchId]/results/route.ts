import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

/**
 * Public LeadPilot API: Get Search Results
 * GET /api/searches/:searchId/results
 * 
 * Supports server-side pagination, sorting, and multi-channel filtering.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { searchId } = await context.params;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const minReviewsStr = searchParams.get('minReviews');
    const maxReviewsStr = searchParams.get('maxReviews');
    const minRatingStr = searchParams.get('minRating');
    const maxRatingStr = searchParams.get('maxRating');

    const sortField = searchParams.get('sort') || searchParams.get('sortField');
    const sortDirection = searchParams.get('direction') || 'desc';

    const results = businessDiscoveryService.getResults(searchId, {
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 50 : limit,
      minReviews: minReviewsStr !== null ? parseInt(minReviewsStr, 10) : undefined,
      maxReviews: maxReviewsStr !== null ? parseInt(maxReviewsStr, 10) : undefined,
      minRating: minRatingStr !== null ? parseFloat(minRatingStr) : undefined,
      maxRating: maxRatingStr !== null ? parseFloat(maxRatingStr) : undefined,
      hasWebsite: searchParams.get('hasWebsite') === 'true',
      hasPhone: searchParams.get('hasPhone') === 'true',
      hasEmail: searchParams.get('hasEmail') === 'true',
      hasInstagram: searchParams.get('hasInstagram') === 'true',
      hasFacebook: searchParams.get('hasFacebook') === 'true',
      hasYouTube: searchParams.get('hasYouTube') === 'true',
      hasLinkedIn: searchParams.get('hasLinkedIn') === 'true',
      hasAnySocial: searchParams.get('hasAnySocial') === 'true',
      sortField: (sortField as any) || undefined,
      sortDirection: (sortDirection as any) || 'desc',
    });

    if (!results) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Search ${searchId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(results, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve search results' },
      { status: 500 }
    );
  }
}
