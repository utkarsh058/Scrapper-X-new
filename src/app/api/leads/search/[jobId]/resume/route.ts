import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/services/SearchService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const resumed = await searchService.resumeSearch(jobId);

    return NextResponse.json({
      success: true,
      jobId: resumed.id,
      status: resumed.status,
      message: `Job ${jobId} resumed.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resume job.' },
      { status: 500 }
    );
  }
}
