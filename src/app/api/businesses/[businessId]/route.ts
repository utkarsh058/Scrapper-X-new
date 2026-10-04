import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

/**
 * Public LeadPilot API: Get Business Entity
 * GET /api/businesses/:businessId
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

    return NextResponse.json(business, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve business' },
      { status: 500 }
    );
  }
}
