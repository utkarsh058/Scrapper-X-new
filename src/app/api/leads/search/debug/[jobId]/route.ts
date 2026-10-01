import { NextRequest, NextResponse } from 'next/server';
import { diagnosticsService } from '@/services/DiagnosticsService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const diagnostics = diagnosticsService.getJobDiagnostics(jobId);

    if (!diagnostics) {
      return NextResponse.json(
        { success: false, error: `Job with ID "${jobId}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      diagnostics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve diagnostics.' },
      { status: 500 }
    );
  }
}
