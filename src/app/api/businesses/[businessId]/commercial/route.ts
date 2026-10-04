import { NextResponse } from 'next/server';
import { commercialMilestoneService } from '@/services/commercial/CommercialMilestoneService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const milestones = await commercialMilestoneService.getMilestonesForBusiness(businessId);

    return NextResponse.json({
      success: true,
      milestones,
    });
  } catch (error) {
    console.error('Error fetching commercial milestones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch commercial milestones' },
      { status: 500 }
    );
  }
}
