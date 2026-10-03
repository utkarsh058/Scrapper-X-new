import { prisma } from '../prisma';
import { SuppressionService } from '../outreach/suppressionService';

export interface ActionRouteResult {
  actionTaken: string;
  leadId?: string;
  campaignId?: string;
  meetingId?: string;
  details: string;
}

export class ActionRouter {
  /**
   * Central Action Router:
   * Maps classified intent to deterministic, audit-logged business rules.
   */
  static async routeAction(replyId: string): Promise<ActionRouteResult> {
    const reply = await prisma.inboundReply.findUnique({
      where: { id: replyId },
      include: {
        lead: true,
        campaign: true,
      },
    });

    if (!reply) {
      return { actionTaken: 'FAILED', details: 'Reply not found.' };
    }

    const { leadId, campaignId, classification, fromEmail } = reply;
    let actionTaken = 'NO_ACTION';
    let details = '';
    let meetingId: string | undefined;

    switch (classification) {
      case 'INTERESTED':
      case 'MEETING_REQUEST': {
        // 1. Stop further follow-ups for this lead
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId },
            data: {
              status: 'STOPPED',
              stopReason: classification,
            },
          });
        }

        // 2. Update lead status in Business table
        if (leadId) {
          await prisma.business.update({
            where: { id: leadId },
            data: { status: 'Interested' },
          });

          // 3. Create Meeting Intent in Meeting table
          const meeting = await prisma.meeting.create({
            data: {
              leadId,
              campaignId,
              replyId: reply.id,
              title: `Discovery Discussion with ${reply.lead?.name || 'Prospect'}`,
              status: 'REQUESTED',
              attendeeEmail: fromEmail,
              attendeeName: reply.lead?.name || undefined,
              notes: `Automated meeting intent from positive reply: "${reply.subject}"`,
            },
          });
          meetingId = meeting.id;

          // 4. Log event
          await prisma.emailEvent.create({
            data: {
              campaignId,
              leadId,
              eventType: 'MEETING_BOOKED',
              metadata: JSON.stringify({ meetingId: meeting.id, intent: classification }),
            },
          });
        }

        actionTaken = 'STOPPED_CAMPAIGN_AND_PROPOSED_MEETING';
        details = 'Follow-up sequence stopped; lead status updated to Interested; meeting requested.';
        break;
      }

      case 'QUESTION':
      case 'NEEDS_INFO':
      case 'NEGOTIATION': {
        // Pause sequence so inappropriate automated follow-ups are not sent while answering
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId, status: 'IN_PROGRESS' },
            data: { status: 'PAUSED', stopReason: 'QUESTION_RECEIVED' },
          });
        }
        actionTaken = 'PAUSED_FOR_QUESTION_REVIEW';
        details = 'Campaign paused for lead; AI response draft created and queued for sales review.';
        break;
      }

      case 'OOO': {
        // Reschedule next follow-up (+4 days or detected date)
        if (campaignId && leadId) {
          const resumeDate = new Date();
          resumeDate.setDate(resumeDate.getDate() + 4); // 4 days buffer

          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId, status: 'IN_PROGRESS' },
            data: { nextFollowupAt: resumeDate },
          });
        }
        actionTaken = 'RESCHEDULED_OOO';
        details = 'Detected Out-of-Office; next sequence follow-up rescheduled by +4 days.';
        break;
      }

      case 'NOT_INTERESTED': {
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId },
            data: { status: 'STOPPED', stopReason: 'NOT_INTERESTED' },
          });
        }
        if (leadId) {
          await prisma.business.update({
            where: { id: leadId },
            data: { status: 'Not Interested' },
          });
        }
        actionTaken = 'STOPPED_CAMPAIGN_NOT_INTERESTED';
        details = 'Campaign permanently stopped for this lead; outcome logged.';
        break;
      }

      case 'UNSUBSCRIBE': {
        // Immediate suppression
        await SuppressionService.suppressContact(fromEmail, 'EMAIL', 'UNSUBSCRIBED', 'Inbound Reply');
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId },
            data: { status: 'STOPPED', stopReason: 'UNSUBSCRIBED' },
          });
        }
        actionTaken = 'SUPPRESSED_AND_STOPPED';
        details = `Email ${fromEmail} added to SuppressionList; all active sequences stopped immediately.`;
        break;
      }

      case 'BOUNCE': {
        await SuppressionService.suppressContact(fromEmail, 'EMAIL', 'BOUNCED', 'Delivery Bounce');
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId },
            data: { status: 'STOPPED', stopReason: 'BOUNCED' },
          });
        }
        actionTaken = 'SUPPRESSED_BOUNCE';
        details = `Email ${fromEmail} suppressed due to permanent delivery bounce.`;
        break;
      }

      case 'WRONG_PERSON': {
        if (campaignId && leadId) {
          await prisma.campaignLead.updateMany({
            where: { campaignId, leadId },
            data: { status: 'STOPPED', stopReason: 'WRONG_PERSON' },
          });
        }
        actionTaken = 'STOPPED_WRONG_PERSON';
        details = 'Stopped outreach to this contact; lead marked for contact reassignment.';
        break;
      }

      default: {
        actionTaken = 'HUMAN_REVIEW_REQUIRED';
        details = 'Intent ambiguous; flagged for human rep review.';
        break;
      }
    }

    // Persist action taken in InboundReply record
    await prisma.inboundReply.update({
      where: { id: reply.id },
      data: { actionTaken },
    });

    return {
      actionTaken,
      leadId: leadId || undefined,
      campaignId: campaignId || undefined,
      meetingId,
      details,
    };
  }
}
