import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/campaigns/campaignService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await CampaignService.stopCampaign(id);
    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to stop campaign.' },
      { status: 500 }
    );
  }
}
