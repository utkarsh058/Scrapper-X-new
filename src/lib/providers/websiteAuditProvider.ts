import { safeFetch } from '../security/ssrfProtection';
import { websiteCrawler } from './websiteCrawlerProvider';
import { WebsiteAuditProvider, WebsiteAuditResult } from './types';

export class HybridWebsiteAuditProvider implements WebsiteAuditProvider {
  readonly name = 'hybrid_website_audit';

  async auditWebsite(rawUrl: string): Promise<WebsiteAuditResult> {
    const now = new Date().toISOString();

    // 1. Run deep crawler check
    const crawl = await websiteCrawler.crawl(rawUrl, 3);
    if (!crawl.isReachable) {
      return {
        url: rawUrl,
        isReachable: false,
        isPageSpeedAvailable: false,
        technicalIssues: crawl.detectedIssues,
        mobileIssues: ['Website is unreachable; mobile experience cannot be evaluated'],
        seoIssues: ['Website returned server error or DNS failure'],
        conversionIssues: ['No customer conversion possible on unreachable domain'],
        auditedAt: now,
      };
    }

    const technicalIssues: string[] = [];
    const mobileIssues: string[] = [];
    const seoIssues: string[] = [];
    const conversionIssues: string[] = [];

    // Technical evaluation
    if (!crawl.isHttps) {
      technicalIssues.push('Not using secure HTTPS encryption (browsers flag site as Not Secure)');
    }
    if (crawl.responseTimeMs && crawl.responseTimeMs > 3000) {
      technicalIssues.push(`High server response latency (${(crawl.responseTimeMs / 1000).toFixed(1)}s initial TTFB)`);
    }

    // Mobile evaluation
    if (!crawl.hasMobileViewport) {
      mobileIssues.push('Missing viewport meta tag (Site will display zoomed-out on mobile devices)');
    }

    // SEO evaluation
    const rootPage = crawl.pagesCrawled[0];
    if (rootPage) {
      if (!rootPage.title) {
        seoIssues.push('Missing HTML <title> tag on homepage');
      } else if (rootPage.title.length < 15) {
        seoIssues.push(`Very short page title ("${rootPage.title}") lacks target keywords`);
      }

      if (!rootPage.metaDescription) {
        seoIssues.push('Missing SEO meta description tag');
      }

      if (!rootPage.h1) {
        seoIssues.push('Missing <h1> primary heading on homepage');
      }
    }

    // Conversion evaluation
    if (!crawl.hasContactForm) {
      conversionIssues.push('Missing online contact or inquiry lead capture form');
    }
    if (!crawl.hasBookingCta) {
      conversionIssues.push('Missing direct appointment scheduling or online booking CTA');
    }
    if (!crawl.hasPhoneCta) {
      conversionIssues.push('No prominent click-to-call telephone CTA detected');
    }

    // 2. Real Google PageSpeed Insights Check (if API Key provided)
    const psiKey = process.env.PAGESPEED_API_KEY;
    if (psiKey && psiKey.trim().length > 0) {
      try {
        const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          crawl.rootUrl
        )}&strategy=mobile&key=${psiKey}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;

        const res = await safeFetch(psiUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data = await res.json();
          const cats = data.lighthouseResult?.categories || {};
          const audits = data.lighthouseResult?.audits || {};

          const performanceScore = cats.performance?.score != null ? Math.round(cats.performance.score * 100) : undefined;
          const accessibilityScore = cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : undefined;
          const bestPracticesScore = cats['best-practices']?.score != null ? Math.round(cats['best-practices'].score * 100) : undefined;
          const seoScore = cats.seo?.score != null ? Math.round(cats.seo.score * 100) : undefined;

          const lcpMs = audits['largest-contentful-paint']?.numericValue;
          const cls = audits['cumulative-layout-shift']?.numericValue;
          const fidMs = audits['max-potential-fid']?.numericValue;

          if (performanceScore != null && performanceScore < 50) {
            technicalIssues.push(`Fails Google PageSpeed threshold (Mobile Performance Score: ${performanceScore}/100)`);
          }

          return {
            url: crawl.rootUrl,
            isReachable: true,
            isPageSpeedAvailable: true,
            performanceScore,
            accessibilityScore,
            bestPracticesScore,
            seoScore,
            coreWebVitals: {
              lcpMs: lcpMs ? Math.round(lcpMs) : undefined,
              cls: cls ? parseFloat(cls.toFixed(3)) : undefined,
              fidMs: fidMs ? Math.round(fidMs) : undefined,
            },
            technicalIssues,
            mobileIssues,
            seoIssues,
            conversionIssues,
            auditedAt: now,
          };
        }
      } catch (err: any) {
        console.warn('[WebsiteAuditProvider] PageSpeed API call failed:', err.message);
      }
    }

    // When PageSpeed is not configured, DO NOT FABRICATE SCORE
    return {
      url: crawl.rootUrl,
      isReachable: true,
      isPageSpeedAvailable: false,
      technicalIssues,
      mobileIssues,
      seoIssues,
      conversionIssues,
      auditedAt: now,
    };
  }
}

export const websiteAuditor = new HybridWebsiteAuditProvider();
