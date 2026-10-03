import { prisma } from '../prisma';
import { ReplyClassifier } from './replyClassifier';
import { ActionRouter } from '../autonomous/actionRouter';

export interface InboundEmailPayload {
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  provider?: string;
  providerEventId?: string;
}

export class InboundReplyService {
  /**
   * Processes an inbound email reply:
   * 1. Normalizes fields
   * 2. Matches thread / lead without guessing
   * 3. Classifies reply via AI + deterministic rules
   * 4. Persists record and events
   * 5. Triggers Action Router for autonomous follow-up stopping / meeting flow
   */
  static async processInboundReply(payload: InboundEmailPayload) {
    const fromClean = payload.fromEmail.trim().toLowerCase();
    const toClean = payload.toEmail.trim().toLowerCase();
    const subjectClean = payload.subject.trim();
    const bodyClean = payload.bodyText.trim();

    // 1. Thread Matching
    let matchedOutreach = null;
    let matchedLead = null;
    let matchedCampaign = null;

    // A. Match via inReplyTo header
    if (payload.inReplyTo) {
      matchedOutreach = await prisma.outreach.findFirst({
        where: {
          OR: [
            { providerMessageId: payload.inReplyTo },
            { id: payload.inReplyTo },
          ],
        },
        include: { business: true, campaign: true },
      });
    }

    // B. Match via recipient email in Contact / Business table
    if (!matchedOutreach) {
      // Find contact by normalized email
      const contact = await prisma.contact.findFirst({
        where: {
          normalizedValue: fromClean,
        },
        include: {
          business: {
            include: {
              campaignLeads: {
                where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (contact?.business) {
        matchedLead = contact.business;
        const activeCampaignLead = contact.business.campaignLeads[0];
        if (activeCampaignLead) {
          matchedCampaign = await prisma.campaign.findUnique({
            where: { id: activeCampaignLead.campaignId },
          });
        }
      } else {
        // Check business email directly
        const business = await prisma.business.findFirst({
          where: { email: fromClean },
          include: {
            campaignLeads: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        });
        if (business) {
          matchedLead = business;
          const activeCampaignLead = business.campaignLeads[0];
          if (activeCampaignLead) {
            matchedCampaign = await prisma.campaign.findUnique({
              where: { id: activeCampaignLead.campaignId },
            });
          }
        }
      }
    } else {
      matchedLead = matchedOutreach.business;
      matchedCampaign = matchedOutreach.campaign;
    }

    // 2. AI Classification
    const originalMessage = matchedOutreach?.message || undefined;
    const classificationResult = await ReplyClassifier.classify(bodyClean, subjectClean, originalMessage);

    // 3. Store in InboundReply table
    const replyRecord = await prisma.inboundReply.create({
      data: {
        campaignId: matchedCampaign?.id || null,
        leadId: matchedLead?.id || null,
        outreachId: matchedOutreach?.id || null,
        provider: payload.provider || 'resend',
        providerEventId: payload.providerEventId || payload.messageId || null,
        messageId: payload.messageId || null,
        threadId: payload.references || null,
        inReplyTo: payload.inReplyTo || null,
        fromEmail: fromClean,
        toEmail: toClean,
        subject: subjectClean,
        bodyText: bodyClean,
        bodyHtml: payload.bodyHtml || null,
        classification: classificationResult.classification,
        confidence: classificationResult.confidence,
        classificationReason: classificationResult.reason,
        aiDraftResponse: classificationResult.aiDraftResponse || null,
        actionTaken: matchedLead ? 'PENDING_ROUTING' : 'UNMATCHED_REPLY',
      },
    });

    // 4. Log Events
    if (matchedLead) {
      await prisma.emailEvent.create({
        data: {
          campaignId: matchedCampaign?.id || null,
          leadId: matchedLead.id,
          outreachId: matchedOutreach?.id || null,
          eventType: 'EMAIL_RECEIVED',
          provider: payload.provider || 'resend',
          metadata: JSON.stringify({
            replyId: replyRecord.id,
            from: fromClean,
            subject: subjectClean,
          }),
        },
      });

      await prisma.emailEvent.create({
        data: {
          campaignId: matchedCampaign?.id || null,
          leadId: matchedLead.id,
          outreachId: matchedOutreach?.id || null,
          eventType: 'REPLY_CLASSIFIED',
          provider: classificationResult.model,
          metadata: JSON.stringify({
            classification: classificationResult.classification,
            confidence: classificationResult.confidence,
            reason: classificationResult.reason,
          }),
        },
      });

      // 5. Trigger Action Router
      const routingResult = await ActionRouter.routeAction(replyRecord.id);
      return {
        success: true,
        replyId: replyRecord.id,
        classification: classificationResult.classification,
        matchedLeadId: matchedLead.id,
        routingResult,
      };
    }

    return {
      success: true,
      replyId: replyRecord.id,
      classification: classificationResult.classification,
      unmatched: true,
      reason: 'Reply received from sender not registered in database. Stored as UNMATCHED_REPLY.',
    };
  }
}
