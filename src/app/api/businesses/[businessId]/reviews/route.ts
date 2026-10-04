import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

/**
 * Public LeadPilot API: Get Business Reviews & Summary
 * GET /api/businesses/:businessId/reviews
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params;
    const business = businessDiscoveryService.getBusiness(businessId);

    if (!business) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Business ${businessId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        businessId,
        google: business.google || null,
        reviews: business.reviews || {
          summary: {
            rating: business.google?.rating ?? null,
            reviewCount: business.google?.reviewCount ?? null,
            reviewLevelDataAvailable: false,
            earliestAvailableReviewDate: null,
            source: 'google_places',
            capturedAt: business.createdAt,
          },
          items: [],
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve reviews' },
      { status: 500 }
    );
  }
}
