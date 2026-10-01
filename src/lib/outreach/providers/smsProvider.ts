import { SmsProvider, SendSmsInput, SendResult } from './types';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Twilio SMS Provider
 * Official Twilio REST API client for outbound SMS delivery.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private accountSid?: string;
  private authToken?: string;
  private fromNumber?: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.SMS_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN || process.env.SMS_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.SMS_FROM_NUMBER;
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
      this.authToken &&
      this.fromNumber &&
      this.accountSid.trim().length > 0 &&
      this.authToken.trim().length > 0 &&
      this.fromNumber.trim().length > 0
    );
  }

  async sendSms(input: SendSmsInput): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'SMS',
        errorCode: 'SMS_PROVIDER_NOT_CONFIGURED',
        errorMessage: 'Twilio SMS credentials are not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
      };
    }

    // Strict E.164 normalization check
    let normalizedTo = input.to.trim();
    try {
      if (isValidPhoneNumber(normalizedTo)) {
        const parsed = parsePhoneNumber(normalizedTo);
        normalizedTo = parsed.format('E.164');
      } else if (isValidPhoneNumber(normalizedTo, 'IN')) {
        const parsed = parsePhoneNumber(normalizedTo, 'IN');
        normalizedTo = parsed.format('E.164');
      } else {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          recipient: input.to,
          channel: 'SMS',
          errorCode: 'INVALID_PHONE_NUMBER',
          errorMessage: `Phone number ${input.to} is not valid E.164 format.`,
        };
      }
    } catch {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: input.to,
        channel: 'SMS',
        errorCode: 'MALFORMED_PHONE_NUMBER',
        errorMessage: `Failed to parse phone number ${input.to}.`,
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const basicAuth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', normalizedTo);
      formData.append('From', this.fromNumber!);
      formData.append('Body', input.message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          recipient: normalizedTo,
          channel: 'SMS',
          errorCode: `TWILIO_${data.code || response.status}`,
          errorMessage: data.message || `Twilio API returned error HTTP ${response.status}`,
          rawResponse: data,
        };
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: data.sid,
        status: 'SENT',
        recipient: normalizedTo,
        channel: 'SMS',
        sentAt: new Date(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        recipient: normalizedTo,
        channel: 'SMS',
        errorCode: 'TWILIO_NETWORK_ERROR',
        errorMessage: err.message || 'Failed to connect to Twilio endpoint',
      };
    }
  }
}
