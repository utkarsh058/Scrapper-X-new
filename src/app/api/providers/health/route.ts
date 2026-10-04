import { NextResponse } from 'next/server';
import { providerDiagnosticsService } from '@/services/diagnostics/ProviderDiagnostics';

/**
 * Public Provider Health & Configuration Diagnostics
 * GET /api/providers/health
 * 
 * Boundary Constraints:
 * - Never returns raw API keys or database credentials.
 * - Explicitly reports CONFIGURED / NOT_CONFIGURED.
 */
export async function GET() {
  try {
    const report = await providerDiagnosticsService.getDiagnostics();
    return NextResponse.json(report, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'DIAGNOSTICS_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
