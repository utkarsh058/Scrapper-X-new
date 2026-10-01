import { EmailProvider, SendEmailInput, SendResult } from './types';

/**
 * Resend Email Provider
 * Direct REST API client for Resend transactional email.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private apiKey?: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'LeadPilot <outreach@leadpilot.co>';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async sendEmail(input: SendEmailInput): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'EMAIL',
        errorCode: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        errorMessage: 'Resend API key is not configured. Add RESEND_API_KEY to your environment.',
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: input.from || this.fromEmail,
          to: [input.to],
          subject: input.subject,
          text: input.bodyText,
          html: input.bodyHtml || input.bodyText.replace(/\n/g, '<br />'),
          reply_to: input.replyTo || process.env.EMAIL_REPLY_TO,
          tags: [
            { name: 'leadId', value: input.leadId },
            { name: 'source', value: 'leadpilot' },
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          recipient: input.to,
          channel: 'EMAIL',
          errorCode: `RESEND_${response.status}`,
          errorMessage: data.message || `Resend API returned HTTP ${response.status}`,
          rawResponse: data,
        };
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: data.id,
        status: 'SENT',
        recipient: input.to,
        channel: 'EMAIL',
        sentAt: new Date(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'EMAIL',
        errorCode: 'RESEND_NETWORK_ERROR',
        errorMessage: err.message || 'Failed to connect to Resend API endpoint',
      };
    }
  }
}

/**
 * SendGrid Email Provider
 * Direct REST API client for SendGrid transactional email.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private apiKey?: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'outreach@leadpilot.co';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async sendEmail(input: SendEmailInput): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'EMAIL',
        errorCode: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        errorMessage: 'SendGrid API key is not configured. Add SENDGRID_API_KEY to your environment.',
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: input.to }],
              subject: input.subject,
            },
          ],
          from: { email: input.from || this.fromEmail },
          reply_to: input.replyTo ? { email: input.replyTo } : undefined,
          content: [
            {
              type: 'text/plain',
              value: input.bodyText,
            },
            ...(input.bodyHtml
              ? [{ type: 'text/html', value: input.bodyHtml }]
              : []),
          ],
          custom_args: { leadId: input.leadId },
        }),
      });

      const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;

      if (!response.ok && response.status !== 202) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          recipient: input.to,
          channel: 'EMAIL',
          errorCode: `SENDGRID_${response.status}`,
          errorMessage: JSON.stringify(errorData.errors || errorData),
          rawResponse: errorData,
        };
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: messageId,
        status: 'SENT',
        recipient: input.to,
        channel: 'EMAIL',
        sentAt: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'EMAIL',
        errorCode: 'SENDGRID_NETWORK_ERROR',
        errorMessage: err.message || 'Failed to connect to SendGrid API endpoint',
      };
    }
  }
}
