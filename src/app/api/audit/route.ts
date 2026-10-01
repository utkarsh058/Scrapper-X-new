import { NextRequest, NextResponse } from 'next/server';
import { websiteAuditor } from '@/lib/providers/websiteAuditProvider';
import { validateUrlForSsrf } from '@/lib/security/ssrfProtection';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A valid website URL is required.' },
        { status: 400 }
      );
    }

    const ssrfCheck = await validateUrlForSsrf(url);
    if (!ssrfCheck.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid or restricted URL: ${ssrfCheck.reason}` },
        { status: 400 }
      );
    }

    const audit = await websiteAuditor.auditWebsite(ssrfCheck.sanitizedUrl || url);

    return NextResponse.json({
      success: true,
      audit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Website audit failed.' },
      { status: 500 }
    );
  }
}
