import { prisma } from '../prisma';
import { CampaignService } from './campaignService';
import { SuppressionService } from '../outreach/suppressionService';

export interface FollowupSchedulerReport {
  timestamp: string;
  totalDueChecked: number;
  dispatched: number;
  stopped: number;
  skipped: number;
  errors: number;
  details: any[];
}

export class FollowupScheduler {
  /**
   * Scans all running campaigns for leads whose scheduled follow-up is due.
   * Enforces all stop conditions and dispatches the next step.
   */
  static async processDueFollowups(batchSize = 25): Promise<FollowupSchedulerReport> {
    const now = new Date();
    const dueLeads = await prisma.campaignLead.findMany({
      where: {
        campaign: { status: 'RUNNING' },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: [
          { nextFollowupAt: null },
          { nextFollowupAt: { lte: now } },
        ],
      },
      take: batchSize,
      include: {
        campaign: true,
        lead: {
          include: {
            contacts: true,
            inboundReplies: { orderBy: { receivedAt: 'desc' }, take: 1 },
            meetings: { where: { status: { in: ['REQUESTED', 'SCHEDULED', 'COMPLETED'] } }, take: 1 },
          },
        },
      },
    });

    const report: FollowupSchedulerReport = {
      timestamp: now.toISOString(),
      totalDueChecked: dueLeads.length,
      dispatched: 0,
      stopped: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const lead of dueLeads) {
      try {
        // 1. Check Stop Condition: Meeting Booked
        if (lead.lead.meetings.length > 0) {
          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: { status: 'STOPPED', stopReason: 'MEETING_BOOKED' },
          });
          report.stopped++;
          report.details.push({ leadId: lead.leadId, action: 'STOPPED', reason: 'MEETING_BOOKED' });
          continue;
        }

        // 2. Check Stop Condition: Inbound Reply status
        const latestReply = lead.lead.inboundReplies[0];
        if (latestReply) {
          const terminalClassifications = ['INTERESTED', 'NOT_INTERESTED', 'UNSUBSCRIBE', 'MEETING_REQUEST'];
          if (terminalClassifications.includes(latestReply.classification)) {
            await prisma.campaignLead.update({
              where: { id: lead.id },
              data: { status: 'STOPPED', stopReason: `REPLY_${latestReply.classification}` },
            });
            report.stopped++;
            report.details.push({ leadId: lead.leadId, action: 'STOPPED', reason: latestReply.classification });
            continue;
          }

          // OOO Check
          if (latestReply.classification === 'OOO' && lead.nextFollowupAt && lead.nextFollowupAt > now) {
            report.skipped++;
            report.details.push({ leadId: lead.leadId, action: 'SKIPPED_OOO', nextDue: lead.nextFollowupAt });
            continue;
          }
        }

        // 3. Check Stop Condition: Suppression List
        const emailContact = lead.lead.contacts.find((c: any) => c.contactType === 'EMAIL' || (c.normalizedValue && c.normalizedValue.includes('@')));
        const email = emailContact?.normalizedValue || lead.lead.email;
        if (email) {
          const suppressed = await SuppressionService.isSuppressed(email, 'EMAIL');
          if (suppressed) {
            await prisma.campaignLead.update({
              where: { id: lead.id },
              data: { status: 'STOPPED', stopReason: 'SUPPRESSED' },
            });
            report.stopped++;
            report.details.push({ leadId: lead.leadId, action: 'STOPPED', reason: 'SUPPRESSED' });
            continue;
          }
        }

        // 4. Safe to Dispatch Next Step
        const res = await CampaignService.dispatchLeadStep(lead.id);
        if (res.success) {
          report.dispatched++;
          report.details.push({ leadId: lead.leadId, action: 'DISPATCHED', step: lead.currentStep + 1 });
        } else {
          report.errors++;
          report.details.push({ leadId: lead.leadId, action: 'DISPATCH_FAILED', error: res.error });
        }
      } catch (err: any) {
        report.errors++;
        report.details.push({ leadId: lead.leadId, action: 'ERROR', error: err.message });
      }
    }

    return report;
  }
}
