import { prisma } from '../prisma';

export class SuppressionService {
  /**
   * Check if a contact (email or phone) is suppressed for a specific channel or ALL.
   */
  static async isSuppressed(contact: string, channel: string = 'ALL'): Promise<{ isSuppressed: boolean; reason?: string }> {
    const normalized = contact.trim().toLowerCase();

    try {
      const entry = await prisma.suppressionList.findFirst({
        where: {
          contact: normalized,
          OR: [
            { channel: 'ALL' },
            { channel: channel.toUpperCase() },
          ],
        },
      });

      if (entry) {
        return { isSuppressed: true, reason: entry.reason };
      }
      return { isSuppressed: false };
    } catch (err: any) {
      console.warn('[SuppressionService] Check warning:', err.message);
      return { isSuppressed: false };
    }
  }

  /**
   * Add a contact to the suppression list.
   */
  static async suppressContact(
    contact: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'ALL',
    reason: 'UNSUBSCRIBED' | 'BOUNCED' | 'INVALID' | 'USER_SUPPRESSED' | 'PROVIDER_BLOCKED',
    source?: string
  ): Promise<void> {
    const normalized = contact.trim().toLowerCase();

    try {
      await prisma.suppressionList.upsert({
        where: {
          contact_channel: {
            contact: normalized,
            channel,
          },
        },
        create: {
          contact: normalized,
          channel,
          reason,
          source: source || 'LeadPilot Outreach Guard',
        },
        update: {
          reason,
          source: source || 'LeadPilot Outreach Guard',
        },
      });
    } catch (err: any) {
      console.error('[SuppressionService] Failed to suppress contact:', err.message);
    }
  }
}
