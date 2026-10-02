import { NextRequest, NextResponse } from 'next/server';
import { websiteAuditEngine } from '@/lib/audit/WebsiteAuditEngine';
import { validateUrlForSsrf } from '@/lib/security/ssrfProtection';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload.' },
        { status: 400 }
      );
    }

    const { url, businessId, leadId, businessName } = body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A valid website URL is required.' },
        { status: 400 }
      );
    }

    const ssrfCheck = await validateUrlForSsrf(url);
    if (!ssrfCheck.valid || !ssrfCheck.sanitizedUrl) {
      return NextResponse.json(
        { success: false, error: `Invalid or restricted URL: ${ssrfCheck.reason}` },
        { status: 400 }
      );
    }

    // Run fresh live audit (re-crawling, re-verifying, updating database)
    const freshReport = await websiteAuditEngine.audit(ssrfCheck.sanitizedUrl, {
      businessId,
      leadId,
      businessName,
    });

    return NextResponse.json({
      success: true,
      message: 'Website re-check completed successfully.',
      audit: freshReport,
      report: freshReport,
    });
  } catch (error: any) {
    console.error('[Website Re-check API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Website re-check failed.' },
      { status: 500 }
    );
  }
}
