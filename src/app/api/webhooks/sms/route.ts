import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SuppressionService } from '@/lib/outreach/suppressionService';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string;
    const errorMessage = formData.get('ErrorMessage') as string;

    if (messageSid) {
      const outreach = await prisma.outreach.findFirst({
        where: { providerMessageId: messageSid },
      });

      if (outreach) {
        const now = new Date();
        if (messageStatus === 'delivered') {
          await prisma.outreach.update({
            where: { id: outreach.id },
            data: { status: 'DELIVERED', deliveredAt: now },
          });
        } else if (messageStatus === 'failed' || messageStatus === 'undelivered') {
          await prisma.outreach.update({
            where: { id: outreach.id },
            data: {
              status: 'FAILED',
              failedAt: now,
              errorCode: errorCode || 'TWILIO_DELIVERY_FAILURE',
              errorMessage: errorMessage || `SMS delivery status: ${messageStatus}`,
            },
          });

          if (errorCode === '30007' || errorCode === '21610') {
            // Recipient opted out / unsubscribed
            await SuppressionService.suppressContact(outreach.recipient, 'SMS', 'UNSUBSCRIBED', 'Twilio Webhook');
          }
        }
      }
    }

    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err: any) {
    console.error('SMS webhook error:', err);
    return new NextResponse('Webhook processing error', { status: 400 });
  }
}
