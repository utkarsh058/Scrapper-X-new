import { NextRequest, NextResponse } from 'next/server';
import { websiteAuditEngine } from '@/lib/audit/WebsiteAuditEngine';
import { validateUrlForSsrf } from '@/lib/security/ssrfProtection';
import { prisma } from '@/lib/prisma';

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

    const report = await websiteAuditEngine.audit(ssrfCheck.sanitizedUrl, {
      businessId,
      leadId,
      businessName,
    });

    return NextResponse.json({
      success: true,
      audit: report,
      report,
    });
  } catch (error: any) {
    console.error('[Website Audit API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Website audit failed.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const businessId = searchParams.get('businessId');
    const id = searchParams.get('id');

    if (id) {
      const audit = await prisma.websiteAudit.findUnique({
        where: { id },
      });
      if (audit && audit.rawAuditPayload) {
        return NextResponse.json({
          success: true,
          report: JSON.parse(audit.rawAuditPayload),
        });
      }
    }

    if (businessId) {
      const audit = await prisma.websiteAudit.findFirst({
        where: { businessId },
        orderBy: { auditedAt: 'desc' },
      });
      if (audit && audit.rawAuditPayload) {
        return NextResponse.json({
          success: true,
          report: JSON.parse(audit.rawAuditPayload),
        });
      }
    }

    if (url) {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      const audit = await prisma.websiteAudit.findFirst({
        where: { url: { contains: domain } },
        orderBy: { auditedAt: 'desc' },
      });
      if (audit && audit.rawAuditPayload) {
        return NextResponse.json({
          success: true,
          report: JSON.parse(audit.rawAuditPayload),
        });
      }

      // If not yet audited, trigger live audit
      const ssrfCheck = await validateUrlForSsrf(url);
      if (ssrfCheck.valid && ssrfCheck.sanitizedUrl) {
        const fresh = await websiteAuditEngine.audit(ssrfCheck.sanitizedUrl);
        return NextResponse.json({
          success: true,
          report: fresh,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Provide a valid url, businessId, or id parameter.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed fetching audit record.' },
      { status: 500 }
    );
  }
}
