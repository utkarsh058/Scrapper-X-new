import { WhatsAppProvider, SendWhatsAppInput, SendResult } from './types';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Meta WhatsApp Cloud API Provider
 * Official Meta Graph API v20.0 client for WhatsApp Business Platform.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta_whatsapp_cloud';
  private accessToken?: string;
  private phoneNumberId?: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  isConfigured(): boolean {
    return Boolean(
      this.accessToken &&
      this.phoneNumberId &&
      this.accessToken.trim().length > 0 &&
      this.phoneNumberId.trim().length > 0
    );
  }

  async sendMessage(input: SendWhatsAppInput): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'WHATSAPP',
        errorCode: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
        errorMessage: 'WhatsApp Business API is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
      };
    }

    // WhatsApp requires pure digits (E.164 without '+')
    let rawDigits = input.to.replace(/\D/g, '');
    try {
      if (isValidPhoneNumber(input.to)) {
        const parsed = parsePhoneNumber(input.to);
        rawDigits = parsed.number.replace('+', '');
      } else if (isValidPhoneNumber(input.to, 'IN')) {
        const parsed = parsePhoneNumber(input.to, 'IN');
        rawDigits = parsed.number.replace('+', '');
      }
    } catch {
      // fallback to stripped digits if already formatted
    }

    if (!rawDigits || rawDigits.length < 10) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'WHATSAPP',
        errorCode: 'INVALID_WHATSAPP_PHONE',
        errorMessage: `Phone number ${input.to} is invalid for WhatsApp delivery.`,
      };
    }

    try {
      const url = `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`;

      const payload = input.templateName
        ? {
            messaging_product: 'whatsapp',
            to: rawDigits,
            type: 'template',
            template: {
              name: input.templateName,
              language: { code: input.templateLanguage || 'en_US' },
            },
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: rawDigits,
            type: 'text',
            text: { preview_url: false, body: input.message },
          };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          recipient: rawDigits,
          channel: 'WHATSAPP',
          errorCode: `WHATSAPP_${data.error?.code || response.status}`,
          errorMessage: data.error?.message || `WhatsApp Cloud API returned HTTP ${response.status}`,
          rawResponse: data,
        };
      }

      const messageId = data.messages?.[0]?.id || `wamid_${Date.now()}`;

      return {
        success: true,
        provider: this.name,
        providerMessageId: messageId,
        status: 'SENT',
        recipient: rawDigits,
        channel: 'WHATSAPP',
        sentAt: new Date(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: rawDigits,
        channel: 'WHATSAPP',
        errorCode: 'WHATSAPP_NETWORK_ERROR',
        errorMessage: err.message || 'Failed to connect to Meta WhatsApp endpoint',
      };
    }
  }
}
