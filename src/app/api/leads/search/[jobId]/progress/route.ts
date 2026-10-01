import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/services/SearchService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const progress = searchService.getJobProgress(jobId);

    if (!progress) {
      return NextResponse.json(
        { success: false, error: `Job with ID "${jobId}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...progress,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve job progress.' },
      { status: 500 }
    );
  }
}
