import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/campaigns/campaignService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await CampaignService.runCampaignBatch(id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to start campaign.' },
      { status: 500 }
    );
  }
}
