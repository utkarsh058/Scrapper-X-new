import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';
import { SearchRequest } from '@/types/canonical';

/**
 * Public LeadPilot API: Start Search
 * POST /api/searches
 * 
 * Boundary Constraints:
 * - Does NOT contain Google API logic
 * - Does NOT contain Instagram scraping
 * - Does NOT contain ranking algorithms
 * - Does NOT contain website crawling
 * - Only initializes the pipeline and returns searchId and status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Query string is required.' },
        { status: 400 }
      );
    }

    if (!body.location || !body.location.state) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Location with state is required.' },
        { status: 400 }
      );
    }

    const tenantId = body.tenantId || req.headers.get('x-tenant-id') || 'tenant_default';
    const userId = body.userId || req.headers.get('x-user-id') || null;

    const searchRequest: SearchRequest = {
      tenantId,
      userId,
      query: body.query.trim(),
      location: {
        city: body.location.city || '',
        state: body.location.state || '',
        country: body.location.country || 'India',
        countryCode: body.location.countryCode,
        postalCode: body.location.postalCode,
      },
      filters: {
        excludePerfectRating: body.filters?.excludePerfectRating !== false, // default true
        minReviews: typeof body.filters?.minReviews === 'number' ? body.filters.minReviews : 0,
        maxReviews: body.filters?.maxReviews,
        minRating: body.filters?.minRating,
        maxRating: body.filters?.maxRating,
        hasWebsite: body.filters?.hasWebsite,
        hasPhone: body.filters?.hasPhone,
        hasEmail: body.filters?.hasEmail,
        hasInstagram: body.filters?.hasInstagram,
        hasFacebook: body.filters?.hasFacebook,
        hasYouTube: body.filters?.hasYouTube,
        hasLinkedIn: body.filters?.hasLinkedIn,
        hasTikTok: body.filters?.hasTikTok,
        hasAnySocial: body.filters?.hasAnySocial,
      },
      sort: {
        field: body.sort?.field || 'reviewCount',
        direction: body.sort?.direction || 'desc',
      },
      page: body.page || 1,
      limit: body.limit || 50,
    };

    // 1. Create pipeline session
    const session = businessDiscoveryService.createSearchSession(searchRequest);

    // 2. Start background execution asynchronously (without blocking HTTP response)
    businessDiscoveryService.executeSearch(session.searchId).catch((err) => {
      console.error(`[POST /api/searches] Execution failed for ${session.searchId}:`, err);
    });

    // 3. Return immediate status
    return NextResponse.json(
      {
        searchId: session.searchId,
        status: session.status,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to initialize search' },
      { status: 500 }
    );
  }
}
