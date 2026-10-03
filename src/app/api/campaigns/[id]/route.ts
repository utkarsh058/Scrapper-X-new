import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/campaigns/campaignService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await CampaignService.getCampaignDetails(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch campaign details.' },
      { status: 500 }
    );
  }
}
