import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

/**
 * Public LeadPilot API: Get Search Pipeline Status
 * GET /api/searches/:searchId
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { searchId } = await context.params;
    const session = businessDiscoveryService.getSession(searchId);

    if (!session) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Search ${searchId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      searchId: session.searchId,
      status: session.status,
      progress: session.progress,
      providerStatuses: session.providerStatuses,
      persistenceStatus: session.persistenceStatus,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      error: session.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve search status' },
      { status: 500 }
    );
  }
}
