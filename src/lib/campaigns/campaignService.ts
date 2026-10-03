import { prisma } from '../prisma';
import { AIPersonalizedOutreachService } from '../ai/aiPersonalizedOutreach';
import { OutreachProviderFactory } from '../outreach/providers/providerFactory';
import { SuppressionService } from '../outreach/suppressionService';
import { OutreachIdempotencyGuard } from '../outreach/outreachIdempotency';

export interface CreateCampaignStepInput {
  stepNumber: number;
  delayDays: number;
  channel?: string;
  templateSubject?: string;
  templateBody: string;
  useAiPersonalization?: boolean;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  scheduleType?: 'IMMEDIATE' | 'SCHEDULED' | 'SEQUENCE';
  dailyLimit?: number;
  leadIds: string[];
  steps?: CreateCampaignStepInput[];
  defaultSubject?: string;
  defaultBody?: string;
  useAiPersonalization?: boolean;
}

export class CampaignService {
  /**
   * Creates a multi-lead campaign with sequences and persisted lead states.
   */
  static async createCampaign(input: CreateCampaignInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Campaign name is required.');
    }
    if (!input.leadIds || input.leadIds.length === 0) {
      throw new Error('At least one qualified lead must be selected for the campaign.');
    }

    // 1. Create Campaign Record
    const campaign = await prisma.campaign.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim(),
        status: 'READY',
        scheduleType: input.scheduleType || 'IMMEDIATE',
        dailyLimit: input.dailyLimit || 50,
      },
    });

    // 2. Create Steps (Defaults to standard 3-step sequence if not provided)
    const stepsInput: CreateCampaignStepInput[] = input.steps && input.steps.length > 0
      ? input.steps
      : [
          {
            stepNumber: 1,
            delayDays: 0,
            channel: 'EMAIL',
            templateSubject: input.defaultSubject || 'A quick thought for {{businessName}}',
            templateBody: input.defaultBody || 'Hi {{recipientName}},\n\nI was looking into your online presence and noticed an opportunity...',
            useAiPersonalization: input.useAiPersonalization ?? true,
          },
          {
            stepNumber: 2,
            delayDays: 3,
            channel: 'EMAIL',
            templateSubject: 'Re: A quick thought for {{businessName}}',
            templateBody: 'Hi {{recipientName}},\n\nFollowing up on my previous note. Did you have a moment to review this?',
            useAiPersonalization: false,
          },
          {
            stepNumber: 3,
            delayDays: 7,
            channel: 'EMAIL',
            templateSubject: 'Final follow up for {{businessName}}',
            templateBody: 'Hi {{recipientName}},\n\nI will not trouble you further if this is not a priority right now, but feel free to let me know if things change.',
            useAiPersonalization: false,
          },
        ];

    for (const step of stepsInput) {
      await prisma.campaignStep.create({
        data: {
          campaignId: campaign.id,
          stepNumber: step.stepNumber,
          delayDays: step.delayDays,
          channel: step.channel || 'EMAIL',
          templateSubject: step.templateSubject,
          templateBody: step.templateBody,
          useAiPersonalization: step.useAiPersonalization ?? true,
        },
      });
    }

    // 3. Attach Leads to Campaign and prepare initial AI outreach
    const createdLeads = [];
    for (const leadId of input.leadIds) {
      // Pre-generate or prepare copy
      let aiPersonalization: any = null;
      let customSubject = input.defaultSubject;
      let customBody = input.defaultBody;

      if (input.useAiPersonalization ?? true) {
        try {
          const generated = await AIPersonalizedOutreachService.generate(leadId);
          if (generated.success) {
            customSubject = generated.subject;
            customBody = generated.bodyText;
            aiPersonalization = {
              provider: generated.provider,
              model: generated.model,
              evidenceUsed: generated.evidenceUsed,
              isAiGenerated: generated.isAiGenerated,
              fallbackReason: generated.fallbackReason,
            };
          }
        } catch (err) {
          console.warn(`AI pre-generation skipped for lead ${leadId}:`, err);
        }
      }

      const campaignLead = await prisma.campaignLead.create({
        data: {
          campaignId: campaign.id,
          leadId,
          status: 'PENDING',
          currentStep: 0,
          customSubject,
          customBody,
          aiPersonalization: aiPersonalization ? JSON.stringify(aiPersonalization) : null,
          nextFollowupAt: new Date(), // Due immediately
        },
      });

      // Log event
      await prisma.emailEvent.create({
        data: {
          campaignId: campaign.id,
          leadId,
          eventType: 'EMAIL_QUEUED',
          metadata: JSON.stringify({ stepNumber: 1 }),
        },
      });

      createdLeads.push(campaignLead);
    }

    return {
      campaign,
      totalLeads: createdLeads.length,
      totalSteps: stepsInput.length,
    };
  }

  /**
   * Retrieves all campaigns with calculated real statistics from events and leads.
   */
  static async getCampaigns() {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        campaignLeads: {
          select: {
            id: true,
            status: true,
            stopReason: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        events: {
          select: {
            eventType: true,
          },
        },
        replies: {
          select: {
            id: true,
            classification: true,
          },
        },
        meetings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return campaigns.map((c) => {
      const totalLeads = c.campaignLeads.length;
      const sentCount = c.events.filter((e) => e.eventType === 'EMAIL_SENT').length;
      const deliveredCount = c.events.filter((e) => e.eventType === 'EMAIL_DELIVERED').length;
      const repliedCount = c.replies.length;
      const interestedCount = c.replies.filter((r) => r.classification === 'INTERESTED' || r.classification === 'MEETING_REQUEST').length;
      const meetingCount = c.meetings.length;

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        scheduleType: c.scheduleType,
        dailyLimit: c.dailyLimit,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        stepsCount: c.steps.length,
        totalLeads,
        stats: {
          queued: c.campaignLeads.filter((l) => l.status === 'PENDING').length,
          inProgress: c.campaignLeads.filter((l) => l.status === 'IN_PROGRESS').length,
          completed: c.campaignLeads.filter((l) => l.status === 'COMPLETED').length,
          stopped: c.campaignLeads.filter((l) => l.status === 'STOPPED').length,
          sent: sentCount,
          delivered: deliveredCount,
          replied: repliedCount,
          interested: interestedCount,
          meetings: meetingCount,
        },
      };
    });
  }

  /**
   * Retrieves detailed campaign information including leads, steps, and activity.
   */
  static async getCampaignDetails(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        campaignLeads: {
          include: {
            lead: {
              include: {
                contacts: true,
                websites: { take: 1 },
                audits: { take: 1 },
              },
            },
          },
        },
        replies: {
          orderBy: { receivedAt: 'desc' },
        },
        meetings: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    return campaign;
  }

  /**
   * Dispatches the next step for a campaign lead.
   * Ensures idempotency, suppression checking, real provider transmit, and DB persistence.
   */
  static async dispatchLeadStep(campaignLeadId: string) {
    const campaignLead = await prisma.campaignLead.findUnique({
      where: { id: campaignLeadId },
      include: {
        campaign: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        lead: { include: { contacts: true, audits: { take: 1 } } },
      },
    });

    if (!campaignLead) {
      return { success: false, error: 'CampaignLead not found.' };
    }

    if (campaignLead.status === 'STOPPED' || campaignLead.status === 'COMPLETED') {
      return { success: false, error: `Lead is already ${campaignLead.status}.` };
    }

    // Determine target step
    const nextStepNumber = campaignLead.currentStep + 1;
    const stepConfig = campaignLead.campaign.steps.find((s) => s.stepNumber === nextStepNumber);
    if (!stepConfig) {
      // Sequence completed
      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: 'COMPLETED' },
      });
      return { success: true, completed: true };
    }

    // Find email contact
    const contact = campaignLead.lead.contacts.find((c) => c.contactType === 'EMAIL' || (c.normalizedValue && c.normalizedValue.includes('@'))) || campaignLead.lead.contacts[0];
    const email = contact?.normalizedValue?.includes('@') ? contact.normalizedValue : campaignLead.lead.email;

    if (!email) {
      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: {
          status: 'STOPPED',
          stopReason: 'NO_VALID_EMAIL',
        },
      });
      return { success: false, error: 'No valid email found for lead.' };
    }

    // Check suppression list
    const isSuppressed = await SuppressionService.isSuppressed(email, 'EMAIL');
    if (isSuppressed) {
      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: {
          status: 'STOPPED',
          stopReason: 'SUPPRESSED',
        },
      });
      return { success: false, error: `Recipient ${email} is suppressed.` };
    }

    // Idempotency check: campaign:leadId:stepNumber
    const idempotencyKey = `cmp_${campaignLead.campaignId}_${campaignLead.leadId}_step${nextStepNumber}`;
    const existingOutreach = await prisma.outreach.findFirst({
      where: {
        campaignId: campaignLead.campaignId,
        businessId: campaignLead.leadId,
        message: { contains: idempotencyKey },
      },
    });

    if (existingOutreach) {
      return { success: true, duplicateSkipped: true };
    }

    // Prepare message copy
    let subject = stepConfig.templateSubject || `Update for ${campaignLead.lead.name}`;
    let bodyText = stepConfig.templateBody;

    if (nextStepNumber === 1 && campaignLead.customSubject && campaignLead.customBody) {
      subject = campaignLead.customSubject;
      bodyText = campaignLead.customBody;
    } else {
      // Substitute placeholders
      subject = subject.replace(/{{businessName}}/g, campaignLead.lead.name).replace(/{{recipientName}}/g, contact?.name || campaignLead.lead.name);
      bodyText = bodyText.replace(/{{businessName}}/g, campaignLead.lead.name).replace(/{{recipientName}}/g, contact?.name || campaignLead.lead.name);
    }

    // Create Outreach record
    const outreach = await prisma.outreach.create({
      data: {
        businessId: campaignLead.leadId,
        campaignId: campaignLead.campaignId,
        channel: 'EMAIL',
        recipient: email,
        subject,
        message: `${bodyText}\n\n[Ref: ${idempotencyKey}]`,
        status: 'SENDING',
        verificationStatus: 'VERIFIED',
      },
    });

    // Execute send via provider
    const emailProvider = OutreachProviderFactory.getEmailProvider();
    const sendResult = await emailProvider.sendEmail({
      to: email,
      subject,
      bodyText,
      businessName: campaignLead.lead.name,
      leadId: campaignLead.leadId,
      idempotencyKey,
    });

    const now = new Date();
    if (sendResult.success) {
      await prisma.outreach.update({
        where: { id: outreach.id },
        data: {
          status: 'SENT',
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId,
          sentAt: now,
        },
      });

      // Calculate next step due date
      const followingStep = campaignLead.campaign.steps.find((s) => s.stepNumber === nextStepNumber + 1);
      let nextFollowupAt: Date | null = null;
      if (followingStep) {
        nextFollowupAt = new Date(now.getTime() + followingStep.delayDays * 24 * 60 * 60 * 1000);
      }

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: {
          status: followingStep ? 'IN_PROGRESS' : 'COMPLETED',
          currentStep: nextStepNumber,
          lastContactedAt: now,
          nextFollowupAt,
        },
      });

      await prisma.emailEvent.create({
        data: {
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          outreachId: outreach.id,
          eventType: 'EMAIL_SENT',
          provider: sendResult.provider,
          providerEventId: sendResult.providerMessageId,
          metadata: JSON.stringify({ stepNumber: nextStepNumber }),
        },
      });

      return { success: true, outreachId: outreach.id, status: 'SENT' };
    } else {
      // Send failed
      await prisma.outreach.update({
        where: { id: outreach.id },
        data: {
          status: 'FAILED',
          provider: sendResult.provider,
          errorCode: sendResult.errorCode,
          errorMessage: sendResult.errorMessage,
          failedAt: now,
        },
      });

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: {
          status: 'FAILED',
          stopReason: sendResult.errorCode || 'SEND_FAILED',
        },
      });

      await prisma.emailEvent.create({
        data: {
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          outreachId: outreach.id,
          eventType: 'EMAIL_FAILED',
          provider: sendResult.provider,
          metadata: JSON.stringify({
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage,
            stepNumber: nextStepNumber,
          }),
        },
      });

      return {
        success: false,
        error: sendResult.errorMessage,
        errorCode: sendResult.errorCode,
      };
    }
  }

  /**
   * Executes a batch run for due leads in a campaign with bounded concurrency.
   */
  static async runCampaignBatch(campaignId: string, concurrency = 5) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignLeads: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            OR: [
              { nextFollowupAt: null },
              { nextFollowupAt: { lte: new Date() } },
            ],
          },
          take: 25,
        },
      },
    });

    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status === 'PAUSED' || campaign.status === 'CANCELLED') {
      return { success: false, message: `Campaign is currently ${campaign.status}.` };
    }

    // Set campaign status to RUNNING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    const leads = campaign.campaignLeads;
    const results: any[] = [];

    // Bounded concurrency pool
    for (let i = 0; i < leads.length; i += concurrency) {
      const slice = leads.slice(i, i + concurrency);
      const batchPromises = slice.map((lead) => this.dispatchLeadStep(lead.id));
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })));
      // Gentle pacing between batches
      if (i + concurrency < leads.length) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    return {
      success: true,
      processed: leads.length,
      results,
    };
  }

  /**
   * Pauses a running campaign.
   */
  static async pauseCampaign(campaignId: string) {
    return prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Resumes a paused campaign.
   */
  static async resumeCampaign(campaignId: string) {
    return prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });
  }

  /**
   * Stops a campaign permanently.
   */
  static async stopCampaign(campaignId: string) {
    return prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' },
    });
  }
}
