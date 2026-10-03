import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/campaigns/campaignService';

export async function GET() {
  try {
    const campaigns = await CampaignService.getCampaigns();
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch campaigns.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await CampaignService.createCampaign(body);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create campaign.' },
      { status: 400 }
    );
  }
}
