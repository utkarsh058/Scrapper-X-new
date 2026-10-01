import { WebsiteAuditProvider, AuditResult } from './WebsiteAuditProvider';
import { CrawlResult } from './WebsiteCrawlerProvider';
import { AuditIssue } from '@/models/Lead';

export class LighthouseAuditProvider implements WebsiteAuditProvider {
  readonly providerId = 'lighthouse_audit';
  readonly name = 'LeadPilot Deterministic Audit Engine';

  public async auditWebsite(crawl: CrawlResult): Promise<AuditResult> {
    const issues: AuditIssue[] = [];
    let deduction = 0;

    // 1. Technical Checks
    if (!crawl.isHttps) {
      issues.push({
        issue: 'Insecure Website (Missing SSL/HTTPS)',
        category: 'technical',
        severity: 'critical',
        evidence: `URL served over insecure HTTP: ${crawl.finalUrl}`,
        sourceUrl: crawl.finalUrl,
      });
      deduction += 25;
    }

    if (crawl.statusCode >= 400 || crawl.statusCode === 0) {
      issues.push({
        issue: 'Server Returned HTTP Error Status',
        category: 'technical',
        severity: 'critical',
        evidence: `HTTP Status Code: ${crawl.statusCode}`,
        sourceUrl: crawl.finalUrl,
      });
      deduction += 35;
    }

    // 2. SEO Checks
    const meta = crawl.meta;
    if (!meta.title || meta.title.length < 5) {
      issues.push({
        issue: 'Missing or Empty Page Title Tag',
        category: 'seo',
        severity: 'critical',
        evidence: 'No valid <title> tag found on homepage',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 15;
    } else if (meta.title.length > 70) {
      issues.push({
        issue: 'Title Tag Exceeds Recommended Length',
        category: 'seo',
        severity: 'low',
        evidence: `Title length is ${meta.title.length} characters (ideal: 50-60)`,
        sourceUrl: crawl.finalUrl,
      });
      deduction += 5;
    }

    if (!meta.description) {
      issues.push({
        issue: 'Missing Meta Description',
        category: 'seo',
        severity: 'high',
        evidence: 'No meta name="description" tag found',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 12;
    }

    if (!meta.hasCanonical) {
      issues.push({
        issue: 'Missing Canonical Link Element',
        category: 'seo',
        severity: 'low',
        evidence: 'No rel="canonical" link specified',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 5;
    }

    if (!meta.hasSchema) {
      issues.push({
        issue: 'Missing Schema.org Structured Data',
        category: 'seo',
        severity: 'medium',
        evidence: 'No JSON-LD LocalBusiness schema detected',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 8;
    }

    // 3. UX Checks
    if (!meta.hasViewport) {
      issues.push({
        issue: 'Not Optimized for Mobile (Missing Viewport Meta)',
        category: 'ux',
        severity: 'critical',
        evidence: 'No meta name="viewport" detected in HTML head',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 20;
    }

    const ctas = crawl.ctas;
    if (!ctas.hasPhoneCTA && !ctas.hasWhatsAppCTA && !ctas.hasEmailCTA) {
      issues.push({
        issue: 'No Direct Contact Call-to-Action on Homepage',
        category: 'ux',
        severity: 'high',
        evidence: 'No click-to-call, WhatsApp chat, or mailto links present',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 10;
    }

    if (!ctas.hasContactForm) {
      issues.push({
        issue: 'Missing Lead Generation Contact Form',
        category: 'ux',
        severity: 'medium',
        evidence: 'No interactive contact or inquiry form found',
        sourceUrl: crawl.finalUrl,
      });
      deduction += 8;
    }

    // 4. Performance Checks
    if (crawl.loadTimeMs > 2500) {
      issues.push({
        issue: 'Slow Initial Server Response Time',
        category: 'performance',
        severity: 'high',
        evidence: `Initial page response took ${crawl.loadTimeMs}ms (threshold: 2500ms)`,
        sourceUrl: crawl.finalUrl,
      });
      deduction += 10;
    }

    if (crawl.pageSizeBytes > 2500000) {
      issues.push({
        issue: 'Heavy Initial Page Size',
        category: 'performance',
        severity: 'medium',
        evidence: `HTML transfer size is ${(crawl.pageSizeBytes / 1024 / 1024).toFixed(2)}MB`,
        sourceUrl: crawl.finalUrl,
      });
      deduction += 8;
    }

    const overallScore = Math.max(10, 100 - deduction);

    return {
      providerName: this.name,
      targetUrl: crawl.finalUrl,
      overallScore,
      issues,
      performance: {
        loadTimeMs: crawl.loadTimeMs,
        pageSizeBytes: crawl.pageSizeBytes,
        mobileFriendly: meta.hasViewport,
        score: Math.max(10, 100 - (crawl.loadTimeMs > 2000 ? 30 : 0) - (crawl.pageSizeBytes > 2000000 ? 25 : 0)),
      },
      seo: {
        hasTitle: Boolean(meta.title && meta.title.length > 0),
        titleLength: meta.title?.length,
        hasDescription: Boolean(meta.description),
        descriptionLength: meta.description?.length,
        hasH1: crawl.pages[0]?.headings.length > 0,
        hasCanonical: meta.hasCanonical,
        hasSchema: meta.hasSchema,
        internalLinksCount: crawl.pages[0]?.links.length || 0,
        externalLinksCount: 0,
      },
      ux: {
        mobileViewport: meta.hasViewport,
        hasPhoneCTA: ctas.hasPhoneCTA,
        hasEmailCTA: ctas.hasEmailCTA,
        hasWhatsAppCTA: ctas.hasWhatsAppCTA,
        hasContactForm: ctas.hasContactForm,
        hasBookingCTA: ctas.hasBookingCTA,
        trustSignalsCount: crawl.socialLinks ? Object.keys(crawl.socialLinks).length : 0,
      },
      auditedAt: new Date().toISOString(),
    };
  }
}

export const lighthouseAuditProvider = new LighthouseAuditProvider();
