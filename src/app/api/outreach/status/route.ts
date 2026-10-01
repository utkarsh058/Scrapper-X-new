import { NextResponse } from 'next/server';
import { OutreachProviderFactory } from '@/lib/outreach/providers/providerFactory';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providerStatus = OutreachProviderFactory.getSystemProviderStatus();

    // Query real statistics from database
    const [total, sent, delivered, failed, emailCount, smsCount, whatsAppCount] = await Promise.all([
      prisma.outreach.count(),
      prisma.outreach.count({ where: { status: 'SENT' } }),
      prisma.outreach.count({ where: { status: 'DELIVERED' } }),
      prisma.outreach.count({ where: { status: 'FAILED' } }),
      prisma.outreach.count({ where: { channel: 'EMAIL' } }),
      prisma.outreach.count({ where: { channel: 'SMS' } }),
      prisma.outreach.count({ where: { channel: 'WHATSAPP' } }),
    ]);

    return NextResponse.json({
      success: true,
      providers: providerStatus,
      metrics: {
        totalOutreaches: total,
        sentCount: sent,
        deliveredCount: delivered,
        failedCount: failed,
        emailCount,
        smsCount,
        whatsAppCount,
      },
    });
  } catch (err: any) {
    console.error('Outreach status error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch outreach status.' },
      { status: 500 }
    );
  }
}
