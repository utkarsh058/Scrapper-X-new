import { NextRequest, NextResponse } from 'next/server';
import { CampaignAnalyticsService } from '@/lib/analytics/campaignAnalyticsService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const analytics = await CampaignAnalyticsService.getOverview(campaignId);
    return NextResponse.json({ success: true, analytics });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch campaign analytics.' },
      { status: 500 }
    );
  }
}
