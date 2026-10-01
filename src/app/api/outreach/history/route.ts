import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const whereClause: any = {};
    if (leadId) whereClause.businessId = leadId;

    const outreaches = await prisma.outreach.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            category: true,
            city: true,
            state: true,
            phone: true,
            email: true,
            websiteUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: outreaches.length,
      outreaches: outreaches.map((o) => ({
        id: o.id,
        leadId: o.businessId,
        businessName: o.business.name,
        channel: o.channel,
        recipient: o.recipient,
        subject: o.subject,
        message: o.message,
        status: o.status,
        provider: o.provider,
        providerMessageId: o.providerMessageId,
        evidenceUsed: o.evidenceUsed ? JSON.parse(o.evidenceUsed) : [],
        errorCode: o.errorCode,
        errorMessage: o.errorMessage,
        sentAt: o.sentAt,
        deliveredAt: o.deliveredAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('Outreach history API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch outreach history.' },
      { status: 500 }
    );
  }
}
