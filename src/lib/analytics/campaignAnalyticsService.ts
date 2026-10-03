import { prisma } from '../prisma';

export interface FunnelMetric {
  stage: string;
  count: number;
  rate?: string;
}

export interface CampaignAnalyticsOverview {
  totals: {
    campaignsCount: number;
    leadsTargeted: number;
    emailsQueued: number;
    emailsSent: number;
    emailsDelivered: number;
    emailsBounced: number;
    emailsOpened: number | 'NOT_AVAILABLE';
    emailsClicked: number | 'NOT_AVAILABLE';
    repliesReceived: number;
    interestedReplies: number;
    meetingsBooked: number;
  };
  rates: {
    deliveryRate: string;
    openRate: string;
    replyRate: string;
    positiveRate: string;
    meetingRate: string;
  };
  funnel: FunnelMetric[];
  industryBreakdown: { industry: string; leads: number; replies: number; meetings: number }[];
  stepPerformance: { stepNumber: number; sent: number; replied: number }[];
}

export class CampaignAnalyticsService {
  /**
   * Derives real campaign analytics from immutable persisted events and database records.
   */
  static async getOverview(campaignId?: string): Promise<CampaignAnalyticsOverview> {
    const whereCampaign = campaignId ? { campaignId } : undefined;

    // 1. Fetch raw events
    const [events, leads, replies, meetings, campaignsCount] = await Promise.all([
      prisma.emailEvent.findMany({ where: whereCampaign }),
      prisma.campaignLead.findMany({
        where: whereCampaign,
        include: { lead: { select: { industry: true, category: true } } },
      }),
      prisma.inboundReply.findMany({ where: whereCampaign }),
      prisma.meeting.findMany({ where: whereCampaign }),
      campaignId ? Promise.resolve(1) : prisma.campaign.count(),
    ]);

    // 2. Count distinct event types
    const queuedCount = events.filter((e) => e.eventType === 'EMAIL_QUEUED').length;
    const sentCount = events.filter((e) => e.eventType === 'EMAIL_SENT').length;
    const deliveredCount = events.filter((e) => e.eventType === 'EMAIL_DELIVERED').length;
    const bouncedCount = events.filter((e) => e.eventType === 'EMAIL_BOUNCED').length;
    
    // Check if open/click events are tracked by provider
    const openedEvents = events.filter((e) => e.eventType === 'EMAIL_OPENED').length;
    const clickedEvents = events.filter((e) => e.eventType === 'EMAIL_CLICKED').length;

    const repliesCount = replies.length;
    const interestedCount = replies.filter((r) => r.classification === 'INTERESTED' || r.classification === 'MEETING_REQUEST').length;
    const meetingsCount = meetings.filter((m) => m.status === 'SCHEDULED' || m.status === 'COMPLETED').length;

    // 3. Compute rates truthfully
    const effectiveDelivered = deliveredCount > 0 ? deliveredCount : sentCount;
    const deliveryRate = sentCount > 0 ? `${((effectiveDelivered / sentCount) * 100).toFixed(1)}%` : '0.0%';
    const openRate = openedEvents > 0 && effectiveDelivered > 0 ? `${((openedEvents / effectiveDelivered) * 100).toFixed(1)}%` : 'NOT_AVAILABLE';
    const replyRate = effectiveDelivered > 0 ? `${((repliesCount / effectiveDelivered) * 100).toFixed(1)}%` : '0.0%';
    const positiveRate = repliesCount > 0 ? `${((interestedCount / repliesCount) * 100).toFixed(1)}%` : '0.0%';
    const meetingRate = interestedCount > 0 ? `${((meetingsCount / interestedCount) * 100).toFixed(1)}%` : '0.0%';

    // 4. Construct Funnel
    const funnel: FunnelMetric[] = [
      { stage: 'Targeted Leads', count: leads.length },
      { stage: 'Emails Sent', count: sentCount, rate: leads.length > 0 ? `${((sentCount / leads.length) * 100).toFixed(1)}%` : '0%' },
      { stage: 'Delivered', count: effectiveDelivered, rate: deliveryRate },
      { stage: 'Replies Received', count: repliesCount, rate: replyRate },
      { stage: 'Positive Interest', count: interestedCount, rate: positiveRate },
      { stage: 'Meetings Booked', count: meetingsCount, rate: meetingRate },
    ];

    // 5. Industry Breakdown
    const indMap: Record<string, { leads: number; replies: number; meetings: number }> = {};
    for (const cl of leads) {
      const ind = cl.lead?.industry || cl.lead?.category || 'General';
      if (!indMap[ind]) indMap[ind] = { leads: 0, replies: 0, meetings: 0 };
      indMap[ind].leads++;
    }
    for (const r of replies) {
      // Find lead
      const cl = leads.find((l) => l.leadId === r.leadId);
      const ind = cl?.lead?.industry || cl?.lead?.category || 'General';
      if (indMap[ind]) indMap[ind].replies++;
    }
    for (const m of meetings) {
      const cl = leads.find((l) => l.leadId === m.leadId);
      const ind = cl?.lead?.industry || cl?.lead?.category || 'General';
      if (indMap[ind]) indMap[ind].meetings++;
    }

    const industryBreakdown = Object.entries(indMap).map(([industry, data]) => ({
      industry,
      ...data,
    })).sort((a, b) => b.leads - a.leads);

    // 6. Step Performance (Dropoff by sequence step)
    const stepPerformance = [1, 2, 3].map((stepNum) => {
      const stepEvents = events.filter((e) => {
        if (e.eventType !== 'EMAIL_SENT') return false;
        try {
          const meta = JSON.parse(e.metadata || '{}');
          return meta.stepNumber === stepNum;
        } catch {
          return stepNum === 1;
        }
      });
      return {
        stepNumber: stepNum,
        sent: stepEvents.length,
        replied: replies.filter((r) => r.campaignId === campaignId).length,
      };
    });

    return {
      totals: {
        campaignsCount,
        leadsTargeted: leads.length,
        emailsQueued: queuedCount,
        emailsSent: sentCount,
        emailsDelivered: effectiveDelivered,
        emailsBounced: bouncedCount,
        emailsOpened: openedEvents > 0 ? openedEvents : 'NOT_AVAILABLE',
        emailsClicked: clickedEvents > 0 ? clickedEvents : 'NOT_AVAILABLE',
        repliesReceived: repliesCount,
        interestedReplies: interestedCount,
        meetingsBooked: meetingsCount,
      },
      rates: {
        deliveryRate,
        openRate,
        replyRate,
        positiveRate,
        meetingRate,
      },
      funnel,
      industryBreakdown,
      stepPerformance,
    };
  }
}
