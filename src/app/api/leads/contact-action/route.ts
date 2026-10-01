import { NextRequest, NextResponse } from 'next/server';
import { leadHistoryService } from '@/lib/workflow/LeadHistoryService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { placeId, leadId, action = 'CONTACTED', channel = 'manual', notes, result } = body;

    if (!placeId && !leadId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either placeId or leadId is required.',
        },
        { status: 400 }
      );
    }

    const effectiveId = placeId || leadId;
    const trackingResult = leadHistoryService.recordContactAction({
      placeId: effectiveId,
      leadId,
      action,
      channel,
      notes,
      result,
    });

    return NextResponse.json({
      success: true,
      placeId: effectiveId,
      contactStatus: trackingResult.updatedStatus,
      record: trackingResult.record,
      message: `Contact action "${action}" recorded. Lead updated to "${trackingResult.updatedStatus}".`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to record contact action.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get('placeId');

  if (placeId) {
    const history = leadHistoryService.getHistory(placeId);
    return NextResponse.json({
      success: true,
      history: history || null,
    });
  }

  const all = leadHistoryService.getAllHistories();
  return NextResponse.json({
    success: true,
    total: all.length,
    histories: all.slice(0, 100),
  });
}
