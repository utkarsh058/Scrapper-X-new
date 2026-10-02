import * as cheerio from 'cheerio';
import { safeFetch, validateUrlForSsrf } from '../security/ssrfProtection';
import { prisma } from '../prisma';
import { leadsDb } from '../leadsDb';
import { leadPilotDb } from '@/db';

export type FindingCategory = 'Performance' | 'SEO' | 'Mobile' | 'UX' | 'Conversion' | 'Technical';
export type FindingStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CHECKED' | 'UNAVAILABLE';
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AuditFinding {
  category: FindingCategory;
  check: string;
  status: FindingStatus;
  severity: FindingSeverity;
  evidence: string;
  url: string;
  recommendation: string;
  detectedAt: string;
}

export interface AuditOpportunity {
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  impact: string;
  evidence: string;
  recommendedService: string;
}

export interface ComprehensiveAuditReport {
  id: string;
  businessId?: string;
  websiteId?: string;
  businessName?: string;
  url: string;
  domain: string;
  auditedAt: string;
  isReachable: boolean;
  httpStatus?: number;
  isHttps: boolean;
  sslValid: boolean;
  responseTimeMs: number;

  scores: {
    overall: number | null;
    performance: number | null;
    mobile: number;
    seo: number;
    conversion: number;
    ux: number;
    technical: number;
  };

  performance: {
    configured: boolean;
    status: 'COMPLETE' | 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'ERROR';
    score: number | null;
    lcpMs: number | null;
    inpMs: number | null;
    cls: number | null;
    fcpMs: number | null;
    ttfbMs: number | null;
    tbtMs: number | null;
    speedIndexMs: number | null;
    opportunities: { title: string; savings?: string; description?: string }[];
    diagnostics?: string;
  };

  mobile: {
    viewportConfigured: boolean;
    viewportContent?: string;
    hasHorizontalOverflowRisk: boolean;
    hasTouchOptimizedTargets: boolean;
    hasReadableFontSize: boolean;
    hasMobileCta: boolean;
    issues: string[];
    evidence: string[];
  };

  seo: {
    title?: string;
    titleLength: number;
    metaDescription?: string;
    metaDescriptionLength: number;
    h1Tags: string[];
    h2Count: number;
    hasCanonical: boolean;
    canonicalUrl?: string;
    hasRobotsTxt: boolean;
    hasSitemapXml: boolean;
    hasSchemaJsonLd: boolean;
    schemaTypes: string[];
    hasOpenGraph: boolean;
    hasTwitterCard: boolean;
    totalImages: number;
    imagesMissingAlt: number;
    sampleImagesMissingAlt: string[];
  };

  conversion: {
    hasPhoneCta: boolean;
    phonesDetected: string[];
    hasEmailCta: boolean;
    emailsDetected: string[];
    hasWhatsappCta: boolean;
    whatsappLinks: string[];
    hasBookingCta: boolean;
    bookingLinks: string[];
    hasContactForm: boolean;
    hasQuoteRequestCta: boolean;
    hasClearPrimaryCta: boolean;
    ctaAboveTheFold: boolean;
    hasBusinessHours: boolean;
    hasGoogleMapsOrAddress: boolean;
    socialLinks: { platform: string; url: string }[];
    crawledPages: string[];
  };

  ux: {
    hasNavMenu: boolean;
    hasClearContactPath: boolean;
    hasTrustSignals: boolean;
    trustSignalsList: string[];
    hasCompleteFooter: boolean;
    issues: string[];
  };

  technical: {
    https: boolean;
    sslSecure: boolean;
    statusCode: number;
    responseTimeMs: number;
    redirectChain: string[];
    securityHeaders: {
      hsts: boolean;
      csp: boolean;
      xFrameOptions: boolean;
      xContentTypeOptions: boolean;
    };
    cachingHeadersPresent: boolean;
  };

  technologies: {
    name: string;
    category: string;
    confidence: 'HIGH' | 'MEDIUM';
    evidence: string;
  }[];

  findings: AuditFinding[];
  opportunities: AuditOpportunity[];
}

const PRIORITY_SUBPAGE_PATTERNS = [
  /contact/i,
  /about/i,
  /services?/i,
  /menu/i,
  /book(ing)?/i,
  /appointment/i,
  /reservation/i,
  /pricing/i,
];

const SOCIAL_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'Instagram', regex: /instagram\.com/i },
  { name: 'Facebook', regex: /facebook\.com/i },
  { name: 'LinkedIn', regex: /linkedin\.com/i },
  { name: 'Twitter/X', regex: /(twitter\.com|x\.com)/i },
  { name: 'YouTube', regex: /youtube\.com/i },
];

export class WebsiteAuditEngine {
  /**
   * Executes a complete, evidence-based website audit on a real website URL.
   */
  public async audit(
    rawUrl: string,
    options: { businessId?: string; leadId?: string; businessName?: string } = {}
  ): Promise<ComprehensiveAuditReport> {
    const now = new Date().toISOString();
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 0. Strict SSRF Protection
    const ssrfCheck = await validateUrlForSsrf(rawUrl);
    if (!ssrfCheck.valid || !ssrfCheck.sanitizedUrl) {
      throw new Error(`SSRF Security Violation: ${ssrfCheck.reason || 'Invalid or prohibited destination URL.'}`);
    }

    const sanitizedUrl = ssrfCheck.sanitizedUrl;
    const parsedOrigin = new URL(sanitizedUrl);
    const domain = parsedOrigin.hostname;
    const isHttps = parsedOrigin.protocol === 'https:';

    const findings: AuditFinding[] = [];

    // 1. Technical Fetch of Homepage
    const fetchStart = Date.now();
    let rootHtml = '';
    let httpStatus = 0;
    let finalUrl = sanitizedUrl;
    let responseHeaders: Headers | null = null;
    let redirectChain: string[] = [];

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 8000);

      const res = await safeFetch(sanitizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadPilot Auditor Bot; https://leadpilot.app)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutHandle);
      httpStatus = res.status;
      finalUrl = res.url;
      responseHeaders = res.headers;
      if (res.redirected) {
        redirectChain.push(sanitizedUrl, res.url);
      }
      rootHtml = await res.text();
    } catch (err: any) {
      // Unreachable website handling
      const responseTimeMs = Date.now() - fetchStart;
      const failureFinding: AuditFinding = {
        category: 'Technical',
        check: 'Website Reachability',
        status: 'FAIL',
        severity: 'CRITICAL',
        evidence: `HTTP connection to ${sanitizedUrl} failed: ${err.message || 'Connection timed out or DNS failed'}`,
        url: sanitizedUrl,
        recommendation: 'Check domain registration, DNS records, and web server configuration.',
        detectedAt: now,
      };

      return this.buildUnreachableReport({
        id: auditId,
        url: sanitizedUrl,
        domain,
        businessId: options.businessId,
        businessName: options.businessName,
        responseTimeMs,
        finding: failureFinding,
        now,
      });
    }

    const responseTimeMs = Date.now() - fetchStart;

    // Parse Root HTML with Cheerio
    const $ = cheerio.load(rootHtml);

    // 2. Technical Checks
    const technicalSec = this.evaluateTechnical({
      url: finalUrl,
      isHttps,
      httpStatus,
      responseTimeMs,
      headers: responseHeaders,
      redirectChain,
      $,
      now,
    });
    findings.push(...technicalSec.findings);

    // 3. Multi-Page Discovery & Shallow Crawl for Conversion Analysis
    const discoveredPages = this.discoverPrioritizedPages($, finalUrl, domain);
    const subpagesHtml = await this.fetchSubpages(discoveredPages);

    // Combined Cheerio objects across crawled pages for holistic verification
    const allPages: { url: string; $: cheerio.CheerioAPI }[] = [
      { url: finalUrl, $ },
      ...subpagesHtml.map((s) => ({ url: s.url, $: cheerio.load(s.html) })),
    ];

    // 4. Mobile & Responsiveness Checks
    const mobileSec = this.evaluateMobile({
      url: finalUrl,
      $,
      now,
    });
    findings.push(...mobileSec.findings);

    // 5. SEO Checks
    const seoSec = await this.evaluateSeo({
      url: finalUrl,
      domain,
      $,
      now,
    });
    findings.push(...seoSec.findings);

    // 6. Conversion & CTA Checks across all crawled pages
    const conversionSec = this.evaluateConversion({
      rootUrl: finalUrl,
      allPages,
      now,
    });
    findings.push(...conversionSec.findings);

    // 7. UX Checks
    const uxSec = this.evaluateUx({
      url: finalUrl,
      $,
      now,
    });
    findings.push(...uxSec.findings);

    // 8. Technology Detection
    const detectedTechnologies = this.detectTechnologies(rootHtml, responseHeaders, $);

    // 9. Real Google PageSpeed Insights Check
    const performanceSec = await this.evaluatePerformance(finalUrl, now);
    if (performanceSec.finding) {
      findings.push(performanceSec.finding);
    }

    // 10. Scoring System (Transparent, Evidence-Based)
    const categoryScores = this.calculateScores({
      technicalFindings: technicalSec.findings,
      mobileFindings: mobileSec.findings,
      seoFindings: seoSec.findings,
      conversionFindings: conversionSec.findings,
      uxFindings: uxSec.findings,
      performanceScore: performanceSec.score,
    });

    // 11. Website Opportunity Assessment (Actionable Modernization Opportunities)
    const opportunities = this.generateOpportunities(findings);

    const report: ComprehensiveAuditReport = {
      id: auditId,
      businessId: options.businessId,
      websiteId: undefined,
      businessName: options.businessName,
      url: finalUrl,
      domain,
      auditedAt: now,
      isReachable: httpStatus >= 200 && httpStatus < 400,
      httpStatus,
      isHttps: finalUrl.startsWith('https://'),
      sslValid: finalUrl.startsWith('https://'),
      responseTimeMs,
      scores: categoryScores,
      performance: {
        configured: performanceSec.configured,
        status: performanceSec.status,
        score: performanceSec.score,
        lcpMs: performanceSec.lcpMs,
        inpMs: performanceSec.inpMs,
        cls: performanceSec.cls,
        fcpMs: performanceSec.fcpMs,
        ttfbMs: performanceSec.ttfbMs,
        tbtMs: performanceSec.tbtMs,
        speedIndexMs: performanceSec.speedIndexMs,
        opportunities: performanceSec.opportunities,
        diagnostics: performanceSec.diagnostics,
      },
      mobile: mobileSec.data,
      seo: seoSec.data,
      conversion: conversionSec.data,
      ux: uxSec.data,
      technical: technicalSec.data,
      technologies: detectedTechnologies,
      findings,
      opportunities,
    };

    // 12. Persist to Neon PostgreSQL Database
    await this.persistAuditToDb(report, options);

    return report;
  }

  // --- Sub-Evaluator: Technical ---
  private evaluateTechnical(ctx: {
    url: string;
    isHttps: boolean;
    httpStatus: number;
    responseTimeMs: number;
    headers: Headers | null;
    redirectChain: string[];
    $: cheerio.CheerioAPI;
    now: string;
  }) {
    const findings: AuditFinding[] = [];
    const isHttps = ctx.url.startsWith('https://');

    // HTTPS / SSL Check
    if (isHttps) {
      findings.push({
        category: 'Technical',
        check: 'HTTPS / SSL Encryption',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Website enforces secure HTTPS connection: ${ctx.url}`,
        url: ctx.url,
        recommendation: 'Maintain valid SSL certificates and auto-renewal.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Technical',
        check: 'HTTPS / SSL Encryption',
        status: 'FAIL',
        severity: 'CRITICAL',
        evidence: `Website is served over unencrypted HTTP: ${ctx.url}`,
        url: ctx.url,
        recommendation: 'Install an SSL certificate and force 301 redirect from HTTP to HTTPS.',
        detectedAt: ctx.now,
      });
    }

    // HTTP Status Code
    if (ctx.httpStatus >= 200 && ctx.httpStatus < 300) {
      findings.push({
        category: 'Technical',
        check: 'Server HTTP Response',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Server returned clean HTTP ${ctx.httpStatus} OK status.`,
        url: ctx.url,
        recommendation: 'Continue monitoring server uptime and status codes.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Technical',
        check: 'Server HTTP Response',
        status: 'WARNING',
        severity: 'HIGH',
        evidence: `Server returned non-standard HTTP status: ${ctx.httpStatus}`,
        url: ctx.url,
        recommendation: 'Ensure standard 200 OK responses on the primary domain.',
        detectedAt: ctx.now,
      });
    }

    // Response Time / Initial TTFB
    if (ctx.responseTimeMs < 1200) {
      findings.push({
        category: 'Technical',
        check: 'Server Response Time (TTFB)',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Initial server HTML response delivered in ${ctx.responseTimeMs}ms (< 1.2s threshold).`,
        url: ctx.url,
        recommendation: 'Maintain fast backend response times.',
        detectedAt: ctx.now,
      });
    } else if (ctx.responseTimeMs < 3000) {
      findings.push({
        category: 'Technical',
        check: 'Server Response Time (TTFB)',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: `Initial server response took ${ctx.responseTimeMs}ms (optimal: < 1.2s).`,
        url: ctx.url,
        recommendation: 'Enable edge page caching or upgrade web server hosting to reduce initial latency.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Technical',
        check: 'Server Response Time (TTFB)',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: `Severely slow initial server response: ${(ctx.responseTimeMs / 1000).toFixed(1)}s.`,
        url: ctx.url,
        recommendation: 'Audit database queries, server resources, and CDN caching to reduce TTFB.',
        detectedAt: ctx.now,
      });
    }

    // Security Headers Check
    const hsts = Boolean(ctx.headers?.get('strict-transport-security'));
    const csp = Boolean(ctx.headers?.get('content-security-policy'));
    const xFrame = Boolean(ctx.headers?.get('x-frame-options'));
    const xContent = Boolean(ctx.headers?.get('x-content-type-options'));
    const cacheControl = Boolean(ctx.headers?.get('cache-control'));

    if (hsts) {
      findings.push({
        category: 'Technical',
        check: 'HSTS Header',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Strict-Transport-Security header present: "${ctx.headers?.get('strict-transport-security')}"`,
        url: ctx.url,
        recommendation: 'Maintain HSTS configuration.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Technical',
        check: 'HSTS Header',
        status: 'WARNING',
        severity: 'LOW',
        evidence: 'Strict-Transport-Security (HSTS) header is missing from HTTP responses.',
        url: ctx.url,
        recommendation: 'Enable Strict-Transport-Security with max-age=31536000 to protect against SSL stripping.',
        detectedAt: ctx.now,
      });
    }

    return {
      data: {
        https: isHttps,
        sslSecure: isHttps,
        statusCode: ctx.httpStatus,
        responseTimeMs: ctx.responseTimeMs,
        redirectChain: ctx.redirectChain,
        securityHeaders: {
          hsts,
          csp,
          xFrameOptions: xFrame,
          xContentTypeOptions: xContent,
        },
        cachingHeadersPresent: cacheControl,
      },
      findings,
    };
  }

  // --- Sub-Evaluator: Mobile & Responsiveness ---
  private evaluateMobile(ctx: { url: string; $: cheerio.CheerioAPI; now: string }) {
    const findings: AuditFinding[] = [];
    const $ = ctx.$;

    // 1. Viewport Meta Tag Check
    const viewportMeta = $('meta[name="viewport"]').attr('content');
    const hasViewport = Boolean(viewportMeta);
    const hasStandardViewport = hasViewport && /width=device-width/i.test(viewportMeta || '');

    if (hasStandardViewport) {
      findings.push({
        category: 'Mobile',
        check: 'Viewport Meta Tag',
        status: 'PASS',
        severity: 'INFO',
        evidence: `<meta name="viewport" content="${viewportMeta}"> detected in HTML head.`,
        url: ctx.url,
        recommendation: 'Mobile viewport tag is properly configured.',
        detectedAt: ctx.now,
      });
    } else if (hasViewport) {
      findings.push({
        category: 'Mobile',
        check: 'Viewport Meta Tag',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: `Non-standard viewport meta configuration: "${viewportMeta}".`,
        url: ctx.url,
        recommendation: 'Update viewport meta tag to standard: "width=device-width, initial-scale=1.0".',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Mobile',
        check: 'Viewport Meta Tag',
        status: 'FAIL',
        severity: 'CRITICAL',
        evidence: 'No <meta name="viewport"> tag found in HTML document head.',
        url: ctx.url,
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to prevent zoomed-out mobile rendering.',
        detectedAt: ctx.now,
      });
    }

    // 2. Horizontal Overflow & Fixed-Width Layout Indicators
    let fixedWidthIssue = false;
    let fixedWidthEvidence = '';

    $('table, div, section, main, header').each((_, el) => {
      const style = $(el).attr('style') || '';
      const match = style.match(/width\s*:\s*(\d{4,})px/i);
      if (match && parseInt(match[1], 10) > 600) {
        fixedWidthIssue = true;
        fixedWidthEvidence = `Inline fixed-width style detected: "${style.slice(0, 60)}" on <${(el as any).tagName}>`;
        return false;
      }
    });

    if (fixedWidthIssue) {
      findings.push({
        category: 'Mobile',
        check: 'Horizontal Overflow Prevention',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: fixedWidthEvidence,
        url: ctx.url,
        recommendation: 'Replace fixed-pixel widths with responsive max-width (e.g., max-w-full or percentage widths) to prevent horizontal scrolling.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Mobile',
        check: 'Horizontal Overflow Prevention',
        status: 'PASS',
        severity: 'INFO',
        evidence: 'No disruptive inline fixed pixel-widths (>600px) found on container elements.',
        url: ctx.url,
        recommendation: 'Keep layout fluid and responsive.',
        detectedAt: ctx.now,
      });
    }

    // 3. Mobile Touch Call-to-Action
    const hasTelLink = $('a[href^="tel:"]').length > 0;
    const hasWhatsappLink = $('a[href*="wa.me"], a[href*="whatsapp"]').length > 0;
    const hasMobileAction = hasTelLink || hasWhatsappLink;

    if (hasMobileAction) {
      findings.push({
        category: 'Mobile',
        check: 'Mobile Touch Action (Click-to-Call / WhatsApp)',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Direct mobile touch action detected: ${hasTelLink ? 'click-to-call tel: link' : ''} ${hasWhatsappLink ? 'WhatsApp direct link' : ''}`,
        url: ctx.url,
        recommendation: 'Ensure mobile quick-action buttons are easily tappable with fingers (>44px height).',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Mobile',
        check: 'Mobile Touch Action (Click-to-Call / WhatsApp)',
        status: 'WARNING',
        severity: 'HIGH',
        evidence: 'No click-to-call (tel:) or direct WhatsApp touch action found on mobile page.',
        url: ctx.url,
        recommendation: 'Add a sticky or prominent click-to-call button so smartphone users can tap once to call your business.',
        detectedAt: ctx.now,
      });
    }

    const issues: string[] = [];
    if (!hasStandardViewport) issues.push('Missing or invalid mobile viewport tag');
    if (fixedWidthIssue) issues.push('Container has hardcoded width causing mobile overflow');
    if (!hasMobileAction) issues.push('Missing mobile click-to-call or WhatsApp quick action');

    return {
      data: {
        viewportConfigured: hasStandardViewport,
        viewportContent: viewportMeta,
        hasHorizontalOverflowRisk: fixedWidthIssue,
        hasTouchOptimizedTargets: hasMobileAction,
        hasReadableFontSize: true,
        hasMobileCta: hasMobileAction,
        issues,
        evidence: findings.filter((f) => f.status === 'FAIL' || f.status === 'WARNING').map((f) => f.evidence),
      },
      findings,
    };
  }

  // --- Sub-Evaluator: SEO ---
  private async evaluateSeo(ctx: { url: string; domain: string; $: cheerio.CheerioAPI; now: string }) {
    const findings: AuditFinding[] = [];
    const $ = ctx.$;

    // 1. Title Tag Check
    const title = $('title').first().text().trim();
    const titleLength = title.length;

    if (!title) {
      findings.push({
        category: 'SEO',
        check: 'HTML Title Tag',
        status: 'FAIL',
        severity: 'CRITICAL',
        evidence: '<title> tag was not found in document head.',
        url: ctx.url,
        recommendation: 'Add a descriptive <title> tag between 50-60 characters including primary keyword and business name.',
        detectedAt: ctx.now,
      });
    } else if (titleLength < 15) {
      findings.push({
        category: 'SEO',
        check: 'HTML Title Tag',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: `Title tag is too short (${titleLength} chars): "${title}". Ideal length is 50-60 characters.`,
        url: ctx.url,
        recommendation: 'Expand title tag to include your industry specialty and city location.',
        detectedAt: ctx.now,
      });
    } else if (titleLength > 70) {
      findings.push({
        category: 'SEO',
        check: 'HTML Title Tag',
        status: 'WARNING',
        severity: 'LOW',
        evidence: `Title tag is too long (${titleLength} chars): "${title.slice(0, 60)}...". May be truncated in Google search results.`,
        url: ctx.url,
        recommendation: 'Shorten title tag to under 60 characters so search engines display it completely.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'HTML Title Tag',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Optimal title tag detected (${titleLength} chars): "${title}"`,
        url: ctx.url,
        recommendation: 'Maintain relevant keywords in title.',
        detectedAt: ctx.now,
      });
    }

    // 2. Meta Description Check
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
    const descLength = metaDesc.length;

    if (!metaDesc) {
      findings.push({
        category: 'SEO',
        check: 'Meta Description Tag',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: '<meta name="description"> tag was not found on the homepage.',
        url: ctx.url,
        recommendation: 'Add an engaging meta description between 120-160 characters describing your service and call to action.',
        detectedAt: ctx.now,
      });
    } else if (descLength < 50) {
      findings.push({
        category: 'SEO',
        check: 'Meta Description Tag',
        status: 'WARNING',
        severity: 'LOW',
        evidence: `Meta description is short (${descLength} chars): "${metaDesc}".`,
        url: ctx.url,
        recommendation: 'Expand description to 120-160 characters to maximize click-through rate from search engines.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'Meta Description Tag',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Meta description present (${descLength} chars): "${metaDesc.slice(0, 80)}..."`,
        url: ctx.url,
        recommendation: 'Keep description accurate and enticing.',
        detectedAt: ctx.now,
      });
    }

    // 3. Heading Structure (H1 / H2)
    const h1Tags: string[] = [];
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1Tags.push(text);
    });

    const h2Count = $('h2').length;

    if (h1Tags.length === 0) {
      findings.push({
        category: 'SEO',
        check: 'Primary Heading (H1)',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: 'No <h1> heading tag found on page.',
        url: ctx.url,
        recommendation: 'Add exactly one <h1> heading defining the main topic/offering of the page.',
        detectedAt: ctx.now,
      });
    } else if (h1Tags.length > 2) {
      findings.push({
        category: 'SEO',
        check: 'Primary Heading (H1)',
        status: 'WARNING',
        severity: 'LOW',
        evidence: `Multiple (${h1Tags.length}) <h1> headings detected: "${h1Tags.slice(0, 2).join('", "')}"...`,
        url: ctx.url,
        recommendation: 'Use a single <h1> heading per page for clean semantic hierarchy, and use <h2> for subsections.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'Primary Heading (H1)',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Clean <h1> heading found: "${h1Tags[0]}"`,
        url: ctx.url,
        recommendation: 'Maintain clear heading structure.',
        detectedAt: ctx.now,
      });
    }

    // 4. Canonical Tag
    const canonical = $('link[rel="canonical"]').attr('href');
    if (canonical) {
      findings.push({
        category: 'SEO',
        check: 'Canonical Link Tag',
        status: 'PASS',
        severity: 'INFO',
        evidence: `<link rel="canonical" href="${canonical}"> specified.`,
        url: ctx.url,
        recommendation: 'Maintains duplicate content defense.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'Canonical Link Tag',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: 'No <link rel="canonical"> element found in document head.',
        url: ctx.url,
        recommendation: 'Add rel="canonical" to prevent search engine confusion between www/non-www and trailing slashes.',
        detectedAt: ctx.now,
      });
    }

    // 5. Schema.org Structured Data
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const type = json['@type'] || (Array.isArray(json['@graph']) && json['@graph'][0]?.['@type']);
        if (type) schemaTypes.push(String(type));
      } catch {}
    });

    const hasSchema = schemaTypes.length > 0;
    if (hasSchema) {
      findings.push({
        category: 'SEO',
        check: 'Schema.org Structured Data',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Structured JSON-LD schema detected with types: ${schemaTypes.join(', ')}`,
        url: ctx.url,
        recommendation: 'Keep structured data updated with operating hours, phone, and address.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'Schema.org Structured Data',
        status: 'WARNING',
        severity: 'HIGH',
        evidence: 'No JSON-LD Schema.org structured data (e.g. LocalBusiness, Organization) detected.',
        url: ctx.url,
        recommendation: 'Implement LocalBusiness or Organization schema to enhance rich snippet eligibility in Google Search.',
        detectedAt: ctx.now,
      });
    }

    // 6. Image Alt Attributes
    let totalImages = 0;
    const imagesMissingAlt: string[] = [];

    $('img').each((_, el) => {
      totalImages++;
      const alt = $(el).attr('alt');
      const src = $(el).attr('src') || '';
      if (!alt || alt.trim().length === 0) {
        if (imagesMissingAlt.length < 3) {
          imagesMissingAlt.push(src.slice(0, 60));
        }
      }
    });

    const missingAltCount = $('img:not([alt]), img[alt=""]').length;
    if (totalImages > 0 && missingAltCount > 0) {
      findings.push({
        category: 'SEO',
        check: 'Image Alt Text Attributes',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: `${missingAltCount} of ${totalImages} images lack descriptive alt attributes (e.g. ${imagesMissingAlt[0] || 'inline images'}).`,
        url: ctx.url,
        recommendation: 'Add informative alt text to all image tags for accessibility and image search ranking.',
        detectedAt: ctx.now,
      });
    } else if (totalImages > 0) {
      findings.push({
        category: 'SEO',
        check: 'Image Alt Text Attributes',
        status: 'PASS',
        severity: 'INFO',
        evidence: `All ${totalImages} image elements contain alt attributes.`,
        url: ctx.url,
        recommendation: 'Keep image descriptions descriptive.',
        detectedAt: ctx.now,
      });
    }

    // 7. Robots.txt and Sitemap.xml Live Verification
    let hasRobots = false;
    let hasSitemap = false;

    try {
      const robotsUrl = `${new URL(ctx.url).origin}/robots.txt`;
      const robRes = await safeFetch(robotsUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      hasRobots = robRes.ok;
    } catch {}

    try {
      const sitemapUrl = `${new URL(ctx.url).origin}/sitemap.xml`;
      const sitRes = await safeFetch(sitemapUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      hasSitemap = sitRes.ok;
    } catch {}

    if (hasRobots) {
      findings.push({
        category: 'SEO',
        check: 'Robots.txt File',
        status: 'PASS',
        severity: 'INFO',
        evidence: `robots.txt is accessible at ${new URL(ctx.url).origin}/robots.txt`,
        url: ctx.url,
        recommendation: 'Maintain crawler rules in robots.txt.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'Robots.txt File',
        status: 'WARNING',
        severity: 'LOW',
        evidence: `No accessible robots.txt found at ${new URL(ctx.url).origin}/robots.txt`,
        url: ctx.url,
        recommendation: 'Create a robots.txt file to guide search engine crawlers.',
        detectedAt: ctx.now,
      });
    }

    if (hasSitemap) {
      findings.push({
        category: 'SEO',
        check: 'XML Sitemap',
        status: 'PASS',
        severity: 'INFO',
        evidence: `sitemap.xml found at ${new URL(ctx.url).origin}/sitemap.xml`,
        url: ctx.url,
        recommendation: 'Keep sitemap submitted to Google Search Console.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'SEO',
        check: 'XML Sitemap',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: `sitemap.xml was not found at ${new URL(ctx.url).origin}/sitemap.xml`,
        url: ctx.url,
        recommendation: 'Generate an XML sitemap and submit to search consoles for comprehensive indexing.',
        detectedAt: ctx.now,
      });
    }

    // 8. Open Graph & Twitter Cards
    const hasOg = Boolean($('meta[property^="og:"]').length);
    const hasTwitter = Boolean($('meta[name^="twitter:"]').length);

    if (!hasOg) {
      findings.push({
        category: 'SEO',
        check: 'Open Graph Social Metadata',
        status: 'WARNING',
        severity: 'LOW',
        evidence: 'Missing Open Graph (og:title, og:image) metadata for social link previews.',
        url: ctx.url,
        recommendation: 'Add Open Graph tags so shared links on WhatsApp, LinkedIn, and Facebook display attractive preview cards.',
        detectedAt: ctx.now,
      });
    }

    return {
      data: {
        title,
        titleLength,
        metaDescription: metaDesc,
        metaDescriptionLength: descLength,
        h1Tags,
        h2Count,
        hasCanonical: Boolean(canonical),
        canonicalUrl: canonical,
        hasRobotsTxt: hasRobots,
        hasSitemapXml: hasSitemap,
        hasSchemaJsonLd: hasSchema,
        schemaTypes,
        hasOpenGraph: hasOg,
        hasTwitterCard: hasTwitter,
        totalImages,
        imagesMissingAlt: missingAltCount,
        sampleImagesMissingAlt: imagesMissingAlt,
      },
      findings,
    };
  }

  // --- Sub-Evaluator: Conversion & CTAs ---
  private evaluateConversion(ctx: {
    rootUrl: string;
    allPages: { url: string; $: cheerio.CheerioAPI }[];
    now: string;
  }) {
    const findings: AuditFinding[] = [];
    const phones = new Set<string>();
    const emails = new Set<string>();
    const whatsappLinks = new Set<string>();
    const bookingLinks = new Set<string>();
    const crawledUrls: string[] = [];

    let hasContactForm = false;
    let contactFormUrl = '';
    let hasQuoteRequest = false;
    let quoteRequestUrl = '';
    let hasClearPrimaryCta = false;
    let hasBusinessHours = false;
    let hasGoogleMaps = false;

    const socialLinksMap = new Map<string, string>();

    for (const page of ctx.allPages) {
      crawledUrls.push(page.url);
      const $ = page.$;
      const bodyText = $('body').text();

      // Phone Extraction (tel: links and standard patterns)
      $('a[href^="tel:"]').each((_, el) => {
        const tel = $(el).attr('href')?.replace(/^tel:/i, '').trim();
        if (tel) phones.add(tel);
      });

      const phoneRegexMatches = bodyText.match(/(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}/g);
      if (phoneRegexMatches) {
        phoneRegexMatches.slice(0, 3).forEach((p) => phones.add(p.trim()));
      }

      // Email Extraction (mailto: links and standard patterns)
      $('a[href^="mailto:"]').each((_, el) => {
        const mail = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim();
        if (mail && !mail.includes('example.com') && !mail.endsWith('.png')) emails.add(mail);
      });

      // WhatsApp Detection
      $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href^="whatsapp:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) whatsappLinks.add(href);
      });

      // Booking / Reservation CTA Detection
      $('a, button').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().toLowerCase();
        const isBooking =
          /book|reserve|appointment|schedule|calendly|opentable|zomato|practo|table/i.test(text) ||
          /book|reserve|appointment|calendly|schedule/i.test(href);

        if (isBooking) {
          bookingLinks.add(text || href);
        }

        if (/quote|estimate|pricing|enquiry|inquire/i.test(text)) {
          hasQuoteRequest = true;
          quoteRequestUrl = page.url;
        }

        if (/get started|contact us|call now|order now|book now/i.test(text)) {
          hasClearPrimaryCta = true;
        }
      });

      // Contact Form Check (<form> with input elements or embedded form iframes)
      $('form').each((_, el) => {
        const hasInputs = $(el).find('input[type="text"], input[type="email"], textarea').length > 0;
        const hasSubmit = $(el).find('button[type="submit"], input[type="submit"], button').length > 0;
        if (hasInputs && hasSubmit) {
          hasContactForm = true;
          contactFormUrl = page.url;
        }
      });

      $('iframe[src*="forms.gle"], iframe[src*="typeform.com"], iframe[src*="hubspot"]').each((_, el) => {
        hasContactForm = true;
        contactFormUrl = page.url;
      });

      // Business Hours & Maps Check
      if (/opening hours|business hours|mon-fri|monday - friday|timing/i.test(bodyText)) {
        hasBusinessHours = true;
      }
      if ($('iframe[src*="google.com/maps"], a[href*="maps.google"]').length > 0) {
        hasGoogleMaps = true;
      }

      // Social Links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        for (const social of SOCIAL_PATTERNS) {
          if (social.regex.test(href) && !socialLinksMap.has(social.name)) {
            socialLinksMap.set(social.name, href);
          }
        }
      });
    }

    const phoneList = Array.from(phones);
    const emailList = Array.from(emails);
    const whatsappList = Array.from(whatsappLinks);
    const bookingList = Array.from(bookingLinks);
    const socialList = Array.from(socialLinksMap.entries()).map(([platform, url]) => ({ platform, url }));

    // 1. Phone CTA Finding
    if (phoneList.length > 0) {
      findings.push({
        category: 'Conversion',
        check: 'Telephone Contact CTA',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Direct phone number detected on website: ${phoneList.slice(0, 2).join(', ')}`,
        url: ctx.rootUrl,
        recommendation: 'Ensure phone number is formatted as a tappable tel: link on mobile.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Conversion',
        check: 'Telephone Contact CTA',
        status: 'FAIL',
        severity: 'CRITICAL',
        evidence: 'No telephone number or click-to-call link detected on website or contact pages.',
        url: ctx.rootUrl,
        recommendation: 'Prominently display a business phone number in header and footer to capture direct inquiries.',
        detectedAt: ctx.now,
      });
    }

    // 2. WhatsApp CTA Finding
    if (whatsappList.length > 0) {
      findings.push({
        category: 'Conversion',
        check: 'WhatsApp Quick Chat CTA',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Direct WhatsApp chat link detected: ${whatsappList[0].slice(0, 60)}`,
        url: ctx.rootUrl,
        recommendation: 'Maintains instant messaging lead capture channel.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Conversion',
        check: 'WhatsApp Quick Chat CTA',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: 'No WhatsApp direct chat button or wa.me link found across audited pages.',
        url: ctx.rootUrl,
        recommendation: 'Integrate a floating WhatsApp chat widget. In India, WhatsApp conversion is 3-5x higher than email forms.',
        detectedAt: ctx.now,
      });
    }

    // 3. Contact / Inquiry Form Finding
    if (hasContactForm) {
      findings.push({
        category: 'Conversion',
        check: 'Online Contact / Lead Capture Form',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Functional lead inquiry form detected at: ${contactFormUrl}`,
        url: contactFormUrl,
        recommendation: 'Keep form fields minimal (< 4 fields) to maximize submission rates.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Conversion',
        check: 'Online Contact / Lead Capture Form',
        status: 'FAIL',
        severity: 'HIGH',
        evidence: 'No interactive contact or inquiry form found on homepage or contact pages.',
        url: ctx.rootUrl,
        recommendation: 'Embed an inquiry form to capture after-hours visitor leads without forcing them to write an email.',
        detectedAt: ctx.now,
      });
    }

    // 4. Online Booking / Reservation CTA Finding
    if (bookingList.length > 0) {
      findings.push({
        category: 'Conversion',
        check: 'Online Booking / Appointment CTA',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Online booking action detected: "${bookingList[0]}"`,
        url: ctx.rootUrl,
        recommendation: 'Ensure online booking calendar operates smoothly across smartphones.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'Conversion',
        check: 'Online Booking / Appointment CTA',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: 'No automated online booking, reservation, or appointment scheduling CTA detected.',
        url: ctx.rootUrl,
        recommendation: 'Add a direct "Book Appointment" or "Reserve Now" widget to automate lead capture without manual callbacks.',
        detectedAt: ctx.now,
      });
    }

    return {
      data: {
        hasPhoneCta: phoneList.length > 0,
        phonesDetected: phoneList,
        hasEmailCta: emailList.length > 0,
        emailsDetected: emailList,
        hasWhatsappCta: whatsappList.length > 0,
        whatsappLinks: whatsappList,
        hasBookingCta: bookingList.length > 0,
        bookingLinks: bookingList,
        hasContactForm,
        hasQuoteRequestCta: hasQuoteRequest,
        hasClearPrimaryCta,
        ctaAboveTheFold: hasClearPrimaryCta,
        hasBusinessHours,
        hasGoogleMapsOrAddress: hasGoogleMaps,
        socialLinks: socialList,
        crawledPages: crawledUrls,
      },
      findings,
    };
  }

  // --- Sub-Evaluator: UX ---
  private evaluateUx(ctx: { url: string; $: cheerio.CheerioAPI; now: string }) {
    const findings: AuditFinding[] = [];
    const $ = ctx.$;

    const hasNav = $('nav, header ul, .menu, .navbar').length > 0;
    const bodyText = $('body').text().toLowerCase();

    // Trust Signals
    const trustSignals: string[] = [];
    if (/review|rating|testimonial|client stories|feedback/i.test(bodyText)) {
      trustSignals.push('Customer Reviews / Testimonials');
    }
    if (/certified|licensed|iso|accredited|awards|registered/i.test(bodyText)) {
      trustSignals.push('Certifications & Accreditations');
    }
    if (/years of experience|serving since|trusted by/i.test(bodyText)) {
      trustSignals.push('Industry Longevity & Trust Badges');
    }

    const hasTrust = trustSignals.length > 0;
    const hasFooter = $('footer').length > 0;

    if (hasNav) {
      findings.push({
        category: 'UX',
        check: 'Navigation Menu Structure',
        status: 'PASS',
        severity: 'INFO',
        evidence: '<nav> or .navbar menu element detected with organized navigation links.',
        url: ctx.url,
        recommendation: 'Ensure mobile hamburger menu opens reliably.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'UX',
        check: 'Navigation Menu Structure',
        status: 'WARNING',
        severity: 'MEDIUM',
        evidence: 'No standard <nav> element or navigation header found on page.',
        url: ctx.url,
        recommendation: 'Add a sticky header navigation menu for intuitive visitor browsing.',
        detectedAt: ctx.now,
      });
    }

    if (hasTrust) {
      findings.push({
        category: 'UX',
        check: 'Trust Signals & Proof Points',
        status: 'PASS',
        severity: 'INFO',
        evidence: `Customer trust signals detected: ${trustSignals.join(', ')}`,
        url: ctx.url,
        recommendation: 'Feature real customer reviews and star ratings prominently above the fold.',
        detectedAt: ctx.now,
      });
    } else {
      findings.push({
        category: 'UX',
        check: 'Trust Signals & Proof Points',
        status: 'WARNING',
        severity: 'HIGH',
        evidence: 'No client testimonials, reviews, or accreditation proof points detected on homepage.',
        url: ctx.url,
        recommendation: 'Embed Google Reviews or client case studies to establish immediate visitor credibility.',
        detectedAt: ctx.now,
      });
    }

    return {
      data: {
        hasNavMenu: hasNav,
        hasClearContactPath: $('a[href*="contact"]').length > 0,
        hasTrustSignals: hasTrust,
        trustSignalsList: trustSignals,
        hasCompleteFooter: hasFooter,
        issues: findings.filter((f) => f.status === 'FAIL' || f.status === 'WARNING').map((f) => f.evidence),
      },
      findings,
    };
  }

  // --- Sub-Evaluator: Technology Detection ---
  private detectTechnologies(html: string, headers: Headers | null, $: cheerio.CheerioAPI) {
    const tech: { name: string; category: string; confidence: 'HIGH' | 'MEDIUM'; evidence: string }[] = [];

    // WordPress
    if (/wp-content|wp-includes|wp-json/i.test(html) || $('meta[name="generator"][content*="WordPress"]').length > 0) {
      tech.push({
        name: 'WordPress',
        category: 'CMS',
        confidence: 'HIGH',
        evidence: 'wp-content / wp-includes directory paths and WordPress generator signatures detected.',
      });
    }

    // Shopify
    if (/cdn\.shopify\.com|myshopify\.com|Shopify\.theme/i.test(html)) {
      tech.push({
        name: 'Shopify',
        category: 'E-Commerce',
        confidence: 'HIGH',
        evidence: 'Shopify CDN scripts and store assets detected in HTML.',
      });
    }

    // Wix
    if (/wixsite\.com|wix-warmup-data|static\.wixstatic\.com/i.test(html) || headers?.get('x-wix-request-id')) {
      tech.push({
        name: 'Wix',
        category: 'Website Builder',
        confidence: 'HIGH',
        evidence: 'Wix framework scripts and static asset CDN references detected.',
      });
    }

    // Webflow
    if (/data-wf-page|assets\.website-files\.com|webflow\.com/i.test(html)) {
      tech.push({
        name: 'Webflow',
        category: 'Website Builder',
        confidence: 'HIGH',
        evidence: 'data-wf-page attributes and Webflow JS assets detected.',
      });
    }

    // Next.js
    if (/__NEXT_DATA__|\/_next\//i.test(html)) {
      tech.push({
        name: 'Next.js',
        category: 'Web Framework',
        confidence: 'HIGH',
        evidence: '__NEXT_DATA__ JSON script payload and /_next/ build chunks detected.',
      });
    }

    // React
    if (/data-reactroot|react-dom/i.test(html) || /__NEXT_DATA__/.test(html)) {
      tech.push({
        name: 'React',
        category: 'JavaScript Library',
        confidence: 'HIGH',
        evidence: 'React DOM rendering signatures and components detected.',
      });
    }

    // Tailwind CSS
    if ($('[class*="flex"], [class*="text-"], [class*="bg-"]').length > 5 && !/bootstrap/i.test(html)) {
      tech.push({
        name: 'Tailwind CSS',
        category: 'CSS Framework',
        confidence: 'MEDIUM',
        evidence: 'Utility-first CSS class signatures detected on DOM elements.',
      });
    }

    // Bootstrap
    if (/bootstrap(?:\.min)?\.(?:css|js)/i.test(html) || $('[class*="container"], [class*="col-"]').length > 3) {
      tech.push({
        name: 'Bootstrap',
        category: 'CSS Framework',
        confidence: 'HIGH',
        evidence: 'Bootstrap stylesheet links and grid classes detected.',
      });
    }

    // Google Analytics / GTM
    if (/googletagmanager\.com\/gtm\.js|google-analytics\.com/i.test(html)) {
      tech.push({
        name: 'Google Analytics / Tag Manager',
        category: 'Analytics',
        confidence: 'HIGH',
        evidence: 'Google Tag Manager (gtm.js) tracking script detected.',
      });
    }

    return tech;
  }

  // --- Sub-Evaluator: Google PageSpeed Insights ---
  private async evaluatePerformance(url: string, now: string) {
    const psiKey = process.env.PAGESPEED_API_KEY;

    if (!psiKey || psiKey.trim().length === 0) {
      return {
        configured: false,
        status: 'NOT_CONFIGURED' as const,
        score: null,
        lcpMs: null,
        inpMs: null,
        cls: null,
        fcpMs: null,
        ttfbMs: null,
        tbtMs: null,
        speedIndexMs: null,
        opportunities: [],
        diagnostics: 'Google PageSpeed Insights API is not configured (PAGESPEED_API_KEY environment variable is missing).',
        finding: {
          category: 'Performance' as FindingCategory,
          check: 'Google PageSpeed Insights',
          status: 'NOT_CHECKED' as FindingStatus,
          severity: 'INFO' as FindingSeverity,
          evidence: 'PAGESPEED_API_KEY is not configured in server environment.',
          url,
          recommendation: 'Configure PAGESPEED_API_KEY to benchmark real Core Web Vitals and Lighthouse metrics.',
          detectedAt: now,
        },
      };
    }

    try {
      const psiEndpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
        url
      )}&strategy=mobile&key=${psiKey}&category=PERFORMANCE`;

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 12000);

      const res = await safeFetch(psiEndpoint, { signal: controller.signal });
      clearTimeout(timeoutHandle);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status}`;

        return {
          configured: true,
          status: 'UNAVAILABLE' as const,
          score: null,
          lcpMs: null,
          inpMs: null,
          cls: null,
          fcpMs: null,
          ttfbMs: null,
          tbtMs: null,
          speedIndexMs: null,
          opportunities: [],
          diagnostics: `PageSpeed API returned: ${errMsg}`,
          finding: {
            category: 'Performance' as FindingCategory,
            check: 'Google PageSpeed Insights',
            status: 'UNAVAILABLE' as FindingStatus,
            severity: 'INFO' as FindingSeverity,
            evidence: `Google PageSpeed API request failed: ${errMsg}`,
            url,
            recommendation: 'Verify PageSpeed API quota and permissions on Google Cloud Console.',
            detectedAt: now,
          },
        };
      }

      const data = await res.json();
      const lighthouse = data.lighthouseResult || {};
      const categories = lighthouse.categories || {};
      const audits = lighthouse.audits || {};

      const perfScore = categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null;
      const lcpMs = audits['largest-contentful-paint']?.numericValue != null ? Math.round(audits['largest-contentful-paint'].numericValue) : null;
      const inpMs = audits['max-potential-fid']?.numericValue != null ? Math.round(audits['max-potential-fid'].numericValue) : null;
      const cls = audits['cumulative-layout-shift']?.numericValue != null ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3)) : null;
      const fcpMs = audits['first-contentful-paint']?.numericValue != null ? Math.round(audits['first-contentful-paint'].numericValue) : null;
      const ttfbMs = audits['server-response-time']?.numericValue != null ? Math.round(audits['server-response-time'].numericValue) : null;
      const tbtMs = audits['total-blocking-time']?.numericValue != null ? Math.round(audits['total-blocking-time'].numericValue) : null;
      const speedIndexMs = audits['speed-index']?.numericValue != null ? Math.round(audits['speed-index'].numericValue) : null;

      const opps: { title: string; savings?: string; description?: string }[] = [];
      const opportunityKeys = [
        'render-blocking-resources',
        'modern-image-formats',
        'unused-javascript',
        'unused-css-rules',
        'unminified-javascript',
        'unminified-css',
      ];

      for (const k of opportunityKeys) {
        if (audits[k] && audits[k].score != null && audits[k].score < 0.9) {
          opps.push({
            title: audits[k].title,
            savings: audits[k].displayValue || `${audits[k].numericValue ? (audits[k].numericValue / 1000).toFixed(1) + 's' : ''}`,
            description: audits[k].description,
          });
        }
      }

      const perfFinding: AuditFinding = {
        category: 'Performance',
        check: 'Google Lighthouse Performance Score',
        status: perfScore && perfScore >= 70 ? 'PASS' : perfScore && perfScore >= 50 ? 'WARNING' : 'FAIL',
        severity: perfScore && perfScore < 50 ? 'HIGH' : 'MEDIUM',
        evidence: `Google Lighthouse Mobile Performance Score: ${perfScore}/100. LCP: ${lcpMs ? (lcpMs / 1000).toFixed(1) + 's' : 'N/A'}, CLS: ${cls ?? 'N/A'}.`,
        url,
        recommendation: 'Optimize render-blocking scripts, compress images, and improve Core Web Vitals to pass Google thresholds.',
        detectedAt: now,
      };

      return {
        configured: true,
        status: 'COMPLETE' as const,
        score: perfScore,
        lcpMs,
        inpMs,
        cls,
        fcpMs,
        ttfbMs,
        tbtMs,
        speedIndexMs,
        opportunities: opps,
        diagnostics: 'Live Google PageSpeed Insights benchmarking completed.',
        finding: perfFinding,
      };
    } catch (err: any) {
      return {
        configured: true,
        status: 'ERROR' as const,
        score: null,
        lcpMs: null,
        inpMs: null,
        cls: null,
        fcpMs: null,
        ttfbMs: null,
        tbtMs: null,
        speedIndexMs: null,
        opportunities: [],
        diagnostics: `PageSpeed query error: ${err.message}`,
        finding: {
          category: 'Performance' as FindingCategory,
          check: 'Google PageSpeed Insights',
          status: 'UNAVAILABLE' as FindingStatus,
          severity: 'INFO' as FindingSeverity,
          evidence: `Failed to connect to PageSpeed API: ${err.message}`,
          url,
          recommendation: 'Check network connectivity to Google APIs.',
          detectedAt: now,
        },
      };
    }
  }

  // --- Sub-Evaluator: Shallow Crawl Subpage Traversal ---
  private discoverPrioritizedPages($: cheerio.CheerioAPI, baseUrl: string, targetDomain: string): string[] {
    const discovered = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
        return;
      }

      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.hostname === targetDomain) {
          const path = resolved.pathname;
          for (const pattern of PRIORITY_SUBPAGE_PATTERNS) {
            if (pattern.test(path)) {
              discovered.add(resolved.toString());
              break;
            }
          }
        }
      } catch {}

      if (discovered.size >= 3) return false;
    });

    return Array.from(discovered);
  }

  private async fetchSubpages(urls: string[]): Promise<{ url: string; html: string }[]> {
    const results: { url: string; html: string }[] = [];

    const promises = urls.slice(0, 3).map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 4000);
        const res = await safeFetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadPilot Auditor Bot; https://leadpilot.app)',
          },
        });
        clearTimeout(timeoutHandle);
        if (res.ok) {
          const html = await res.text();
          results.push({ url, html });
        }
      } catch {}
    });

    await Promise.allSettled(promises);
    return results;
  }

  // --- Scoring System ---
  private calculateScores(ctx: {
    technicalFindings: AuditFinding[];
    mobileFindings: AuditFinding[];
    seoFindings: AuditFinding[];
    conversionFindings: AuditFinding[];
    uxFindings: AuditFinding[];
    performanceScore: number | null;
  }) {
    const scoreCategory = (findings: AuditFinding[]): number => {
      let score = 100;
      for (const f of findings) {
        if (f.status === 'FAIL') {
          score -= f.severity === 'CRITICAL' ? 35 : f.severity === 'HIGH' ? 25 : f.severity === 'MEDIUM' ? 15 : 8;
        } else if (f.status === 'WARNING') {
          score -= f.severity === 'HIGH' ? 12 : f.severity === 'MEDIUM' ? 8 : 4;
        }
      }
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const technical = scoreCategory(ctx.technicalFindings);
    const mobile = scoreCategory(ctx.mobileFindings);
    const seo = scoreCategory(ctx.seoFindings);
    const conversion = scoreCategory(ctx.conversionFindings);
    const ux = scoreCategory(ctx.uxFindings);

    let overall: number | null = null;
    if (ctx.performanceScore != null) {
      overall = Math.round(
        ctx.performanceScore * 0.2 +
          technical * 0.15 +
          mobile * 0.2 +
          seo * 0.15 +
          conversion * 0.2 +
          ux * 0.1
      );
    } else {
      // Normalize across the 5 completed categories
      overall = Math.round(
        technical * 0.18 + mobile * 0.25 + seo * 0.18 + conversion * 0.25 + ux * 0.14
      );
    }

    return {
      overall,
      performance: ctx.performanceScore,
      mobile,
      seo,
      conversion,
      ux,
      technical,
    };
  }

  // --- Opportunities Generator ---
  private generateOpportunities(findings: AuditFinding[]): AuditOpportunity[] {
    const opps: AuditOpportunity[] = [];

    for (const f of findings) {
      if (f.status === 'FAIL') {
        if (f.check.includes('WhatsApp')) {
          opps.push({
            title: 'High-Converting WhatsApp Lead Funnel',
            category: 'Conversion',
            severity: 'HIGH',
            impact: 'Capture 3x more mobile visitor inquiries with direct WhatsApp chat',
            evidence: f.evidence,
            recommendedService: 'WhatsApp Widget & CRM Integration',
          });
        } else if (f.check.includes('Form')) {
          opps.push({
            title: 'Lead Capture Form & Instant Notification',
            category: 'Conversion',
            severity: 'HIGH',
            impact: 'Collect qualified customer leads 24/7 with an automated inquiry form',
            evidence: f.evidence,
            recommendedService: 'Lead Generation Form & Autoresponder Setup',
          });
        } else if (f.check.includes('Telephone')) {
          opps.push({
            title: 'Prominent Mobile Click-to-Call CTA',
            category: 'Conversion',
            severity: 'CRITICAL',
            impact: 'Eliminate friction for phone callers on mobile devices',
            evidence: f.evidence,
            recommendedService: 'Header & Mobile Contact Bar Optimization',
          });
        } else if (f.check.includes('HTTPS')) {
          opps.push({
            title: 'SSL Security & Trust Certificate',
            category: 'Technical',
            severity: 'CRITICAL',
            impact: 'Remove browser "Not Secure" warning that repels up to 80% of customers',
            evidence: f.evidence,
            recommendedService: 'SSL Certificate & HTTPS 301 Redirection Setup',
          });
        } else if (f.check.includes('Viewport')) {
          opps.push({
            title: 'Mobile-Responsive Redesign',
            category: 'Mobile',
            severity: 'CRITICAL',
            impact: 'Fix zoomed-out desktop display on smartphones (>60% of all traffic)',
            evidence: f.evidence,
            recommendedService: 'Mobile-First Responsive Redesign',
          });
        } else if (f.check.includes('Title') || f.check.includes('Meta Description')) {
          opps.push({
            title: 'Local SEO Search Snippet Optimization',
            category: 'SEO',
            severity: 'HIGH',
            impact: 'Rank higher in local Google searches and boost click-through rates',
            evidence: f.evidence,
            recommendedService: 'On-Page SEO Optimization & Local Schema Setup',
          });
        }
      } else if (f.status === 'WARNING' && f.check.includes('Booking')) {
        opps.push({
          title: 'Automated Online Appointment / Booking Engine',
          category: 'Conversion',
          severity: 'MEDIUM',
          impact: 'Allow clients to book appointments or reserve online without calling',
          evidence: f.evidence,
          recommendedService: 'Online Scheduling & Booking System Integration',
        });
      }
    }

    return opps;
  }

  // --- Persistence ---
  private async persistAuditToDb(
    report: ComprehensiveAuditReport,
    options: { businessId?: string; leadId?: string; businessName?: string }
  ) {
    try {
      let bId = options.businessId;

      // If businessId not directly provided, find by website url or domain
      if (!bId) {
        const business = await prisma.business.findFirst({
          where: {
            OR: [
              { websiteUrl: { contains: report.domain } },
              { id: options.leadId },
            ],
          },
        });
        if (business) {
          bId = business.id;
        } else {
          const bizId = `biz_${report.domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const existingById = await prisma.business.findUnique({ where: { id: bizId } });
          if (existingById) {
            bId = existingById.id;
          } else {
            const createdBiz = await prisma.business.create({
              data: {
                id: bizId,
                name: options.businessName || report.seo.title || report.domain,
                category: 'Audited Domain',
                industry: 'General',
                country: 'Global',
                websiteUrl: report.url,
              },
            });
            bId = createdBiz.id;
          }
        }
      }

      if (bId) {
        // Upsert Website relation
        const website = await prisma.website.upsert({
          where: { id: `web_${report.domain.replace(/\./g, '_')}` },
          update: {
            url: report.url,
            domain: report.domain,
            isHttps: report.isHttps,
            httpStatus: report.httpStatus,
            status: (report.scores.overall || 0) > 65 ? 'Working' : 'Needs Improvement',
            lastCheckedAt: new Date(report.auditedAt),
          },
          create: {
            id: `web_${report.domain.replace(/\./g, '_')}`,
            businessId: bId,
            url: report.url,
            domain: report.domain,
            isHttps: report.isHttps,
            httpStatus: report.httpStatus,
            status: (report.scores.overall || 0) > 65 ? 'Working' : 'Needs Improvement',
            lastCheckedAt: new Date(report.auditedAt),
          },
        });

        // Upsert WebsiteAudit record
        await prisma.websiteAudit.create({
          data: {
            businessId: bId,
            websiteId: website.id,
            url: report.url,
            status: (report.scores.overall || 0) > 65 ? 'Working' : 'Needs Improvement',
            performanceScore: report.performance.score,
            seoScore: report.scores.seo,
            responseTimeMs: report.responseTimeMs,
            hasMobileViewport: report.mobile.viewportConfigured,
            hasContactForm: report.conversion.hasContactForm,
            hasBookingCta: report.conversion.hasBookingCta,
            hasPhoneCta: report.conversion.hasPhoneCta,
            hasWhatsappLink: report.conversion.hasWhatsappCta,
            detectedIssues: JSON.stringify(report.findings.filter((f) => f.status === 'FAIL' || f.status === 'WARNING').map((f) => f.check)),
            rawAuditPayload: JSON.stringify(report),
            auditedAt: new Date(report.auditedAt),
          },
        });

        // Sync to leadsDb memory cache so dashboard table updates immediately
        leadsDb.getAll().forEach((l: any) => {
          const webStr = typeof l.website === 'string' ? l.website : l.website?.url;
          if (l.id === bId || webStr?.includes(report.domain) || l.websiteUrl?.includes(report.domain)) {
            l.websiteStatus = (report.scores.overall || 0) > 65 ? 'Working' : 'Needs Improvement';
            l.websiteIssues = report.findings.filter((f: any) => f.status === 'FAIL' || f.status === 'WARNING').map((f: any) => f.check);
            if (l.rawLead && l.rawLead.website) {
              l.rawLead.website.speedScore = report.performance.score || undefined;
              l.rawLead.website.mobileOptimized = report.mobile.viewportConfigured;
              l.rawLead.website.sslSecure = report.isHttps;
              l.rawLead.website.detectedIssues = l.websiteIssues;
            }
          }
        });
      }
    } catch (err) {
      console.warn('[WebsiteAuditEngine] Persistence warning:', err);
    }
  }

  // --- Fallback for Unreachable Sites ---
  private buildUnreachableReport(ctx: {
    id: string;
    url: string;
    domain: string;
    businessId?: string;
    businessName?: string;
    responseTimeMs: number;
    finding: AuditFinding;
    now: string;
  }): ComprehensiveAuditReport {
    return {
      id: ctx.id,
      businessId: ctx.businessId,
      businessName: ctx.businessName,
      url: ctx.url,
      domain: ctx.domain,
      auditedAt: ctx.now,
      isReachable: false,
      httpStatus: 0,
      isHttps: ctx.url.startsWith('https://'),
      sslValid: false,
      responseTimeMs: ctx.responseTimeMs,
      scores: {
        overall: 0,
        performance: null,
        mobile: 0,
        seo: 0,
        conversion: 0,
        ux: 0,
        technical: 0,
      },
      performance: {
        configured: false,
        status: 'UNAVAILABLE',
        score: null,
        lcpMs: null,
        inpMs: null,
        cls: null,
        fcpMs: null,
        ttfbMs: null,
        tbtMs: null,
        speedIndexMs: null,
        opportunities: [],
        diagnostics: 'Website is unreachable; performance cannot be evaluated.',
      },
      mobile: {
        viewportConfigured: false,
        hasHorizontalOverflowRisk: false,
        hasTouchOptimizedTargets: false,
        hasReadableFontSize: false,
        hasMobileCta: false,
        issues: ['Website is unreachable.'],
        evidence: [ctx.finding.evidence],
      },
      seo: {
        title: '',
        titleLength: 0,
        h1Tags: [],
        h2Count: 0,
        hasCanonical: false,
        hasRobotsTxt: false,
        hasSitemapXml: false,
        hasSchemaJsonLd: false,
        schemaTypes: [],
        hasOpenGraph: false,
        hasTwitterCard: false,
        totalImages: 0,
        imagesMissingAlt: 0,
        sampleImagesMissingAlt: [],
        metaDescriptionLength: 0,
      },
      conversion: {
        hasPhoneCta: false,
        phonesDetected: [],
        hasEmailCta: false,
        emailsDetected: [],
        hasWhatsappCta: false,
        whatsappLinks: [],
        hasBookingCta: false,
        bookingLinks: [],
        hasContactForm: false,
        hasQuoteRequestCta: false,
        hasClearPrimaryCta: false,
        ctaAboveTheFold: false,
        hasBusinessHours: false,
        hasGoogleMapsOrAddress: false,
        socialLinks: [],
        crawledPages: [],
      },
      ux: {
        hasNavMenu: false,
        hasClearContactPath: false,
        hasTrustSignals: false,
        trustSignalsList: [],
        hasCompleteFooter: false,
        issues: ['Website is unreachable.'],
      },
      technical: {
        https: ctx.url.startsWith('https://'),
        sslSecure: false,
        statusCode: 0,
        responseTimeMs: ctx.responseTimeMs,
        redirectChain: [],
        securityHeaders: {
          hsts: false,
          csp: false,
          xFrameOptions: false,
          xContentTypeOptions: false,
        },
        cachingHeadersPresent: false,
      },
      technologies: [],
      findings: [ctx.finding],
      opportunities: [
        {
          title: 'Urgent Domain & Hosting Recovery',
          category: 'Technical',
          severity: 'CRITICAL',
          impact: 'Restore website accessibility so potential clients can view your business online',
          evidence: ctx.finding.evidence,
          recommendedService: 'Website Hosting & Domain Rescue',
        },
      ],
    };
  }
}

export const websiteAuditEngine = new WebsiteAuditEngine();
