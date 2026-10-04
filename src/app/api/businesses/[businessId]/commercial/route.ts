import { NextResponse } from 'next/server';
import { commercialMilestoneService } from '@/services/commercial/CommercialMilestoneService';

export async function GET(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  try {
    const milestones = await commercialMilestoneService.getMilestonesForBusiness(params.businessId);

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
