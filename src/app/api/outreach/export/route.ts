import { NextRequest, NextResponse } from 'next/server';
import { OutreachExcelExporter } from '@/lib/export/outreachExcel';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const status = searchParams.get('status') || undefined;
    const channel = searchParams.get('channel') || undefined;

    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const buffer = await OutreachExcelExporter.generateWorkbookBuffer({
      campaignId,
      leadId,
      status,
      channel,
      from,
      to,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `leadpilot-outreach-${dateStr}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('Outreach export error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate Excel export.' },
      { status: 500 }
    );
  }
}
