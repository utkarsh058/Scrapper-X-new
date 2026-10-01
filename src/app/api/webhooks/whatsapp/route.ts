import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'leadpilot_webhook_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
    if (Array.isArray(statuses)) {
      for (const item of statuses) {
        const messageId = item.id;
        const status = item.status; // "delivered" | "read" | "failed"

        if (messageId) {
          const outreach = await prisma.outreach.findFirst({
            where: { providerMessageId: messageId },
          });

          if (outreach) {
            const now = new Date();
            if (status === 'delivered') {
              await prisma.outreach.update({
                where: { id: outreach.id },
                data: { status: 'DELIVERED', deliveredAt: now },
              });
            } else if (status === 'read') {
              await prisma.outreach.update({
                where: { id: outreach.id },
                data: { readAt: now },
              });
            } else if (status === 'failed') {
              const err = item.errors?.[0];
              await prisma.outreach.update({
                where: { id: outreach.id },
                data: {
                  status: 'FAILED',
                  failedAt: now,
                  errorCode: String(err?.code || 'WHATSAPP_FAILED'),
                  errorMessage: err?.message || err?.title || 'WhatsApp transmission failed',
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('WhatsApp webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 400 });
  }
}
