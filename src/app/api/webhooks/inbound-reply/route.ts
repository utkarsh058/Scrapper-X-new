import { NextRequest, NextResponse } from 'next/server';
import { InboundReplyService } from '@/lib/replies/inboundReplyService';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Support both standardized format and common webhook shapes (Resend, SendGrid, etc.)
    const fromEmail = payload.from || payload.fromEmail || payload.sender || payload.data?.from;
    const toEmail = payload.to || payload.toEmail || payload.recipient || payload.data?.to?.[0];
    const subject = payload.subject || payload.data?.subject || 'Re: Outreach';
    const bodyText = payload.text || payload.bodyText || payload.body || payload.data?.text || '';
    const bodyHtml = payload.html || payload.bodyHtml || payload.data?.html || undefined;
    const inReplyTo = payload.inReplyTo || payload['in-reply-to'] || payload.headers?.['in-reply-to'] || payload.data?.in_reply_to;
    const messageId = payload.messageId || payload['message-id'] || payload.headers?.['message-id'] || payload.data?.email_id;

    if (!fromEmail || !bodyText) {
      return NextResponse.json(
        { success: false, error: 'fromEmail and bodyText are required fields.' },
        { status: 400 }
      );
    }

    const result = await InboundReplyService.processInboundReply({
      fromEmail,
      toEmail: toEmail || 'outreach@leadpilot.co',
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
      messageId,
      provider: payload.provider || 'webhook',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Inbound reply webhook error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Error processing inbound reply.' },
      { status: 500 }
    );
  }
}
