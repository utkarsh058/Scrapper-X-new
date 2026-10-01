import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SuppressionService } from '@/lib/outreach/suppressionService';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Support Resend webhook event structure
    if (payload.type && payload.data) {
      const { type, data } = payload;
      const messageId = data.email_id || data.id;

      if (messageId) {
        const outreach = await prisma.outreach.findFirst({
          where: { providerMessageId: messageId },
        });

        if (outreach) {
          const now = new Date();
          if (type === 'email.delivered') {
            await prisma.outreach.update({
              where: { id: outreach.id },
              data: { status: 'DELIVERED', deliveredAt: now },
            });
          } else if (type === 'email.bounced') {
            await prisma.outreach.update({
              where: { id: outreach.id },
              data: { status: 'BOUNCED', failedAt: now, errorCode: 'BOUNCE', errorMessage: 'Email bounced by recipient mail server' },
            });
            // Automatically suppress bounced recipient
            await SuppressionService.suppressContact(outreach.recipient, 'EMAIL', 'BOUNCED', 'Resend Webhook');
          } else if (type === 'email.opened') {
            await prisma.outreach.update({
              where: { id: outreach.id },
              data: { readAt: now },
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Email webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 400 });
  }
}
