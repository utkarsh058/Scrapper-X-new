import { prisma } from '../prisma';
import { FollowupScheduler } from '../campaigns/followupScheduler';
import { CampaignService } from '../campaigns/campaignService';
import { LLMProviderFactory } from '../ai/llmProvider';
import { CalendarProviderFactory } from '../meetings/calendarProvider';
import { OutreachProviderFactory } from '../outreach/providers/providerFactory';

export interface AutonomousEngineReport {
  timestamp: string;
  status: 'ACTIVE' | 'IDLE' | 'ERROR';
  providers: {
    llm: { configured: boolean; provider: string };
    email: { configured: boolean; provider: string };
    calendar: { configured: boolean; provider: string };
  };
  campaignsActive: number;
  batchResults: any[];
  followupReport: any;
}

export class AutonomousCampaignEngine {
  /**
   * Executes one complete autonomous sales cycle:
   * 1. Evaluates all running campaigns
   * 2. Processes due follow-ups through the FollowupScheduler
   * 3. Dispatches queued steps with bounded concurrency
   * 4. Reports live provider status truthfully
   */
  static async runAutonomousCycle(): Promise<AutonomousEngineReport> {
    const now = new Date().toISOString();

    // 1. Check real provider configurations
    const llmStatus = LLMProviderFactory.getProviderStatus();
    const emailProvider = OutreachProviderFactory.getEmailProvider();
    const calStatus = CalendarProviderFactory.getProviderStatus();

    const providers = {
      llm: llmStatus,
      email: {
        configured: emailProvider.isConfigured(),
        provider: emailProvider.isConfigured() ? emailProvider.name : 'none (EMAIL_NOT_CONFIGURED)',
      },
      calendar: calStatus,
    };

    // 2. Query running campaigns
    const runningCampaigns = await prisma.campaign.findMany({
      where: { status: 'RUNNING' },
      select: { id: true, name: true },
    });

    const batchResults: any[] = [];
    for (const cmp of runningCampaigns) {
      try {
        const batch = await CampaignService.runCampaignBatch(cmp.id, 5);
        batchResults.push({ campaignId: cmp.id, name: cmp.name, ...batch });
      } catch (err: any) {
        batchResults.push({ campaignId: cmp.id, name: cmp.name, success: false, error: err.message });
      }
    }

    // 3. Process due follow-ups across all running campaigns
    const followupReport = await FollowupScheduler.processDueFollowups(25);

    return {
      timestamp: now,
      status: 'ACTIVE',
      providers,
      campaignsActive: runningCampaigns.length,
      batchResults,
      followupReport,
    };
  }
}
