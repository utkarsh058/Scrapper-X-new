import { CrawlResult } from './WebsiteCrawlerProvider';
import { AuditIssue, PerformanceMetrics, SeoMetrics, UxMetrics } from '@/models/Lead';

export interface AuditResult {
  providerName: string;
  targetUrl: string;
  overallScore: number; // 0 - 100
  issues: AuditIssue[];
  performance: PerformanceMetrics;
  seo: SeoMetrics;
  ux: UxMetrics;
  auditedAt: string;
}

export interface WebsiteAuditProvider {
  readonly providerId: string;
  readonly name: string;

  auditWebsite(crawlResult: CrawlResult): Promise<AuditResult>;
}
