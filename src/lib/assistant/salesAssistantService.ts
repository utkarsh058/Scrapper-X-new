import { prisma } from '../prisma';
import { LLMProviderFactory } from '../ai/llmProvider';
import { CampaignAnalyticsService } from '../analytics/campaignAnalyticsService';

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantResponse {
  message: string;
  toolUsed?: string;
  dataSummary?: any;
  provider: string;
}

export class SalesAssistantService {
  /**
   * Main conversational entry point for Sales Copilot.
   * Leverages real database queries and tool calling.
   */
  static async chat(userMessage: string, history: AssistantMessage[] = []): Promise<AssistantResponse> {
    const queryLower = userMessage.toLowerCase();

    // 1. Identify intent & dispatch tool query
    let toolResult: any = null;
    let toolName = 'none';

    if (queryLower.includes('replied') || queryLower.includes('reply') || queryLower.includes('interested')) {
      toolName = 'getRecentReplies';
      toolResult = await this.getRecentReplies();
    } else if (queryLower.includes('campaign') || queryLower.includes('performance') || queryLower.includes('analytics') || queryLower.includes('rate')) {
      toolName = 'getCampaignPerformance';
      toolResult = await CampaignAnalyticsService.getOverview();
    } else if (queryLower.includes('meeting') || queryLower.includes('calendar') || queryLower.includes('call')) {
      toolName = 'getUpcomingMeetings';
      toolResult = await this.getUpcomingMeetings();
    } else if (queryLower.includes('followup') || queryLower.includes('due') || queryLower.includes('follow-up')) {
      toolName = 'getDueFollowups';
      toolResult = await this.getDueFollowups();
    } else if (queryLower.includes('lead') || queryLower.includes('business') || queryLower.includes('find')) {
      toolName = 'searchLeads';
      toolResult = await this.searchQualifiedLeads();
    }

    // 2. Synthesize with LLM if available
    const llm = LLMProviderFactory.getProvider();
    if (!llm.isConfigured()) {
      // Deterministic truthful answer without LLM
      const deterministicResponse = formatDeterministicAnswer(toolName, toolResult, userMessage);
      return {
        message: deterministicResponse,
        toolUsed: toolName,
        dataSummary: toolResult,
        provider: 'database_direct (LLM_NOT_CONFIGURED)',
      };
    }

    const systemPrompt = `You are LeadPilot's AI Sales Copilot.
You have direct, real-time read access to the actual LeadPilot database.

CRITICAL RULES:
1. TRUTHFULNESS: Only report data present in the REAL DATABASE CONTEXT below.
2. If data is empty or unavailable, state: "I don't have that data in the database."
3. Distinguish FACT from AI SUGGESTION clearly.
4. Keep responses concise, actionable, and formatted in clear markdown bullets.`;

    const userPrompt = `USER QUESTION:
${userMessage}

REAL DATABASE CONTEXT (Tool: ${toolName}):
${JSON.stringify(toolResult, null, 2)}

Provide a direct, helpful, and grounded answer to the user.`;

    try {
      const response = await llm.generateText(userPrompt, systemPrompt);
      return {
        message: response.text.trim(),
        toolUsed: toolName,
        dataSummary: toolResult,
        provider: llm.name,
      };
    } catch {
      return {
        message: formatDeterministicAnswer(toolName, toolResult, userMessage),
        toolUsed: toolName,
        dataSummary: toolResult,
        provider: 'database_direct',
      };
    }
  }

  static async getRecentReplies() {
    const replies = await prisma.inboundReply.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 10,
      include: {
        lead: { select: { id: true, name: true, city: true, phone: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    return replies.map((r) => ({
      replyId: r.id,
      from: r.fromEmail,
      subject: r.subject,
      classification: r.classification,
      confidence: r.confidence,
      actionTaken: r.actionTaken,
      businessName: r.lead?.name || 'Unmatched',
      city: r.lead?.city,
      receivedAt: r.receivedAt,
    }));
  }

  static async getUpcomingMeetings() {
    const meetings = await prisma.meeting.findMany({
      where: { status: { in: ['REQUESTED', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        lead: { select: { id: true, name: true, city: true, phone: true } },
      },
    });

    return meetings.map((m) => ({
      meetingId: m.id,
      title: m.title,
      status: m.status,
      startTime: m.startTime,
      meetingUrl: m.meetingUrl,
      attendeeEmail: m.attendeeEmail,
      businessName: m.lead.name,
      city: m.lead.city,
    }));
  }

  static async getDueFollowups() {
    const now = new Date();
    const due = await prisma.campaignLead.findMany({
      where: {
        campaign: { status: 'RUNNING' },
        status: 'IN_PROGRESS',
        nextFollowupAt: { lte: now },
      },
      take: 10,
      include: {
        lead: { select: { id: true, name: true, city: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    return due.map((d) => ({
      leadId: d.leadId,
      businessName: d.lead.name,
      campaignName: d.campaign.name,
      currentStep: d.currentStep,
      nextFollowupDue: d.nextFollowupAt,
    }));
  }

  static async searchQualifiedLeads() {
    const leads = await prisma.business.findMany({
      where: {
        opportunityScore: { gte: 50 },
      },
      orderBy: { opportunityScore: 'desc' },
      take: 8,
      include: {
        audits: { take: 1 },
        contacts: { take: 1 },
      },
    });

    return leads.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      city: l.city,
      opportunityScore: l.opportunityScore,
      status: l.status,
      phone: l.phone,
      website: l.websiteUrl,
    }));
  }
}

function formatDeterministicAnswer(toolName: string, data: any, query: string): string {
  if (toolName === 'getRecentReplies') {
    if (!data || data.length === 0) return 'No inbound email replies have been recorded in the database yet.';
    const interested = data.filter((r: any) => r.classification === 'INTERESTED' || r.classification === 'MEETING_REQUEST');
    let out = `### Inbound Replies (${data.length} recent)\n\n`;
    if (interested.length > 0) {
      out += `**Positive Interest (${interested.length}):**\n`;
      interested.forEach((r: any) => {
        out += `- **${r.businessName}** (${r.city || 'India'}) · "${r.subject}" [Intent: ${r.classification}]\n`;
      });
      out += '\n';
    }
    out += `**Other replies (${data.length - interested.length}):**\n`;
    data.filter((r: any) => !interested.includes(r)).slice(0, 5).forEach((r: any) => {
      out += `- **${r.businessName}**: ${r.classification} · "${r.subject}"\n`;
    });
    return out;
  }

  if (toolName === 'getUpcomingMeetings') {
    if (!data || data.length === 0) return 'No scheduled or requested meetings found in the database.';
    let out = `### Meetings & Inquiries (${data.length})\n\n`;
    data.forEach((m: any) => {
      out += `- **${m.businessName}** · Status: \`${m.status}\` · Attendee: ${m.attendeeEmail}\n`;
      if (m.meetingUrl) out += `  Meeting Link: ${m.meetingUrl}\n`;
    });
    return out;
  }

  if (toolName === 'getCampaignPerformance') {
    return `### Campaign Performance Overview
- **Campaigns Active**: ${data.totals.campaignsCount}
- **Total Leads Targeted**: ${data.totals.leadsTargeted}
- **Emails Sent**: ${data.totals.emailsSent}
- **Delivery Rate**: ${data.rates.deliveryRate}
- **Replies Received**: ${data.totals.repliesReceived} (Reply Rate: ${data.rates.replyRate})
- **Positive Interest**: ${data.totals.interestedReplies} (Positive Rate: ${data.rates.positiveRate})
- **Meetings Booked**: ${data.totals.meetingsBooked}`;
  }

  if (toolName === 'getDueFollowups') {
    if (!data || data.length === 0) return 'There are currently 0 campaign follow-ups pending or due right now.';
    let out = `### Follow-ups Due (${data.length})\n\n`;
    data.forEach((d: any) => {
      out += `- **${d.businessName}** in "${d.campaignName}" · Advancing to Step ${d.currentStep + 1}\n`;
    });
    return out;
  }

  if (toolName === 'searchLeads') {
    if (!data || data.length === 0) return 'No qualified leads found matching that criteria in the database.';
    let out = `### High-Priority Qualified Leads (${data.length})\n\n`;
    data.forEach((l: any) => {
      out += `- **${l.name}** (${l.category} in ${l.city}) · Score: ${l.opportunityScore}/100 · Status: \`${l.status}\`\n`;
    });
    return out;
  }

  return 'I am ready to assist you with real database intelligence. You can ask me about campaign performance, recent replies, upcoming meetings, or due follow-ups.';
}
