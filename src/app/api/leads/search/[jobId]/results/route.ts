import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/services/SearchService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const results = await searchService.getJobResultsAsync(jobId);

    if (!results) {
      return NextResponse.json(
        { success: false, error: `Job with ID "${jobId}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve job results.' },
      { status: 500 }
    );
  }
}
