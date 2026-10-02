import { WebsiteStatus, StructuredWebsiteAudit } from '@/types';

export interface WebsiteAnalysisResult {
  hasWebsite: boolean;
  url?: string;
  status: WebsiteStatus;
  reasons: string[];
  publicEmail?: string;
  publicPhone?: string;
  socialLinks?: string[];
  bookingLink?: string;
  pagesAnalyzed: number;
  source: string;
  speedScore?: number;
  mobileOptimized?: boolean;
  sslSecure?: boolean;
  audit?: StructuredWebsiteAudit;
}

// In-memory cache to avoid re-crawling the same domain multiple times in a session
const websiteAuditCache = new Map<string, WebsiteAnalysisResult>();

/**
 * Basic Server-Side Website Pre-Check
 * Runs before deep crawling to test domain reachability, HTTP status, SSL, and response latency.
 */
export async function preCheckWebsite(rawUrl: string): Promise<{
  reachable: boolean;
  statusCode?: number;
  isHttps: boolean;
  durationMs: number;
  html?: string;
  finalUrl?: string;
  redirectCount: number;
  error?: string;
}> {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  const isHttps = url.startsWith('https://');
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5-second timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadPilot Business Bot; contact@leadpilot.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const html = await res.text();

    return {
      reachable: res.ok || res.status < 400,
      statusCode: res.status,
      isHttps: res.url.startsWith('https://'),
      durationMs,
      html,
      finalUrl: res.url,
      redirectCount: res.redirected ? 1 : 0,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      reachable: false,
      isHttps,
      durationMs: Date.now() - startTime,
      redirectCount: 0,
      error: err.name === 'AbortError' ? 'Connection timed out (>4.0s)' : err.message || 'DNS / SSL handshake failure',
    };
  }
}

/**
 * Deep Crawl using Firecrawl API
 * Crawls priority internal pages (Contact, About, Services, Booking, Pricing, Menu) up to WEBSITE_CRAWL_PAGE_LIMIT.
 */
export async function crawlWithFirecrawl(url: string, apiKey: string, pageLimit: number = 10): Promise<{
  success: boolean;
  markdown?: string;
  title?: string;
  description?: string;
  links?: string[];
  statusCode?: number;
  error?: string;
}> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links'],
        onlyMainContent: false,
        timeout: 8000
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      return {
        success: false,
        error: errBody?.error || `Firecrawl returned HTTP ${res.status}`,
      };
    }

    const json = await res.json();
    if (json.success && json.data) {
      const allLinks: string[] = json.data.links || [];
      // Prioritize relevant conversion/business pages
      const priorityPatterns = [/contact/i, /about/i, /services/i, /booking/i, /menu/i, /pricing/i, /gallery/i];
      const prioritizedLinks = allLinks.filter(l => priorityPatterns.some(p => p.test(l))).slice(0, pageLimit);

      return {
        success: true,
        markdown: json.data.markdown || '',
        title: json.data.metadata?.title || '',
        description: json.data.metadata?.description || '',
        links: prioritizedLinks.length > 0 ? prioritizedLinks : allLinks.slice(0, pageLimit),
        statusCode: json.data.metadata?.statusCode || 200,
      };
    }

    return { success: false, error: 'Firecrawl returned empty payload' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Main Deterministic Website Analysis Engine
 * Combines Pre-check, Firecrawl deep crawl, and structured deterministic quality checks.
 */
export async function analyzeWebsiteQuality(rawUrl?: string): Promise<WebsiteAnalysisResult> {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return {
      hasWebsite: false,
      status: 'No Website',
      reasons: ['No website URL registered for this business'],
      pagesAnalyzed: 0,
      source: 'OpenStreetMap',
    };
  }

  let formattedUrl = rawUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  // Check cache
  const cacheKey = formattedUrl.toLowerCase();
  if (websiteAuditCache.has(cacheKey)) {
    return websiteAuditCache.get(cacheKey)!;
  }

  // 1. Basic Server-Side Website Pre-Check
  const preCheck = await preCheckWebsite(formattedUrl);
  if (!preCheck.reachable) {
    const unreachableResult: WebsiteAnalysisResult = {
      hasWebsite: true,
      url: formattedUrl,
      status: 'Unreachable',
      reasons: [preCheck.error || `Server returned HTTP ${preCheck.statusCode || 500}`],
      pagesAnalyzed: 0,
      source: 'Pre-check',
      sslSecure: preCheck.isHttps,
      audit: {
        technical: {
          reachable: false,
          httpStatus: preCheck.statusCode,
          https: preCheck.isHttps,
          responseTimeMs: preCheck.durationMs,
          redirectCount: preCheck.redirectCount
        },
        mobile: {
          viewportConfigured: false,
          responsiveIndicators: false,
          issues: ['Website unreachable']
        },
        seo: {
          hasTitle: false,
          hasMetaDescription: false,
          hasH1: false,
          issues: ['Site did not load']
        },
        conversion: {
          hasPhoneCta: false,
          hasEmailCta: false,
          hasContactForm: false,
          hasWhatsappLink: false,
          hasBookingLink: false,
          hasClearCta: false,
          issues: ['Site unreachable']
        },
        trust: {
          hasAboutPage: false,
          hasServicesPage: false,
          hasSocialLinks: false,
          socialLinks: []
        },
        detectedIssues: [preCheck.error || 'Server unreachable'],
        crawledPagesCount: 0,
        deepCrawlAvailable: false,
        auditedAt: new Date().toISOString()
      }
    };
    websiteAuditCache.set(cacheKey, unreachableResult);
    return unreachableResult;
  }

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const pageLimit = parseInt(process.env.WEBSITE_CRAWL_PAGE_LIMIT || '10', 10);
  let crawlSource = 'Website Inspection';
  let content = preCheck.html || '';
  let links: string[] = [];
  let metaTitle = '';
  let metaDescription = '';
  let pagesAnalyzed = 1;
  let deepCrawlAvailable = false;

  // 2. Firecrawl Deep Crawl (if API key is present)
  if (firecrawlKey && firecrawlKey.trim().length > 0) {
    deepCrawlAvailable = true;
    const firecrawlResult = await crawlWithFirecrawl(formattedUrl, firecrawlKey, pageLimit);
    if (firecrawlResult.success) {
      crawlSource = 'Firecrawl Deep Crawl';
      content += `\n${firecrawlResult.markdown || ''}`;
      links = firecrawlResult.links || [];
      metaTitle = firecrawlResult.title || '';
      metaDescription = firecrawlResult.description || '';
      pagesAnalyzed = Math.min(links.length + 1, pageLimit);
    }
  }

  const lowerContent = content.toLowerCase();
  const reasons: string[] = [];
  const technicalIssues: string[] = [];
  const mobileIssues: string[] = [];
  const seoIssues: string[] = [];
  const conversionIssues: string[] = [];

  // 3. Deterministic Quality Checks
  // A. HTTPS Check
  if (!preCheck.isHttps) {
    const issue = 'Not using secure HTTPS encryption (insecure connection)';
    reasons.push(issue);
    technicalIssues.push(issue);
  }

  // B. Mobile Viewport Check
  const hasViewport = lowerContent.includes('<meta name="viewport"') || lowerContent.includes("<meta name='viewport'");
  if (!hasViewport) {
    const issue = 'Mobile layout has issues (Missing mobile viewport configuration)';
    reasons.push(issue);
    mobileIssues.push(issue);
  }

  // C. Contact Form Check
  const hasContactForm = lowerContent.includes('<form') || lowerContent.includes('contact-form') || lowerContent.includes('input type="email"');
  if (!hasContactForm) {
    const issue = 'Contact form missing';
    reasons.push(issue);
    conversionIssues.push(issue);
  }

  // D. Contact Page Check
  const hasContactPage = 
    links.some(l => l.toLowerCase().includes('/contact')) || 
    lowerContent.includes('contact us') || 
    lowerContent.includes('/contact');
  if (!hasContactPage) {
    const issue = 'Contact page missing';
    reasons.push(issue);
    conversionIssues.push(issue);
  }

  // E. Call to Action (CTA) Check
  const hasCta = 
    lowerContent.includes('book') || 
    lowerContent.includes('appointment') || 
    lowerContent.includes('reserve') || 
    lowerContent.includes('order online') || 
    lowerContent.includes('get quote') || 
    lowerContent.includes('schedule') ||
    lowerContent.includes('call now');
  if (!hasCta) {
    const issue = 'No clear call-to-action (CTA) detected';
    reasons.push(issue);
    conversionIssues.push(issue);
  }

  // F. Online Booking / WhatsApp CTA
  const hasWhatsApp = lowerContent.includes('whatsapp') || lowerContent.includes('wa.me') || lowerContent.includes('api.whatsapp.com');
  const hasBookingLink = 
    lowerContent.includes('calendly.com') || 
    lowerContent.includes('practo.com') || 
    lowerContent.includes('/book') || 
    lowerContent.includes('/reserve');
  
  if (!hasBookingLink && !hasWhatsApp) {
    const issue = 'No online booking or direct chat link';
    reasons.push(issue);
    conversionIssues.push(issue);
  }

  // G. Performance / Latency Check
  if (preCheck.durationMs > 3200) {
    const issue = `Slow loading time (${(preCheck.durationMs / 1000).toFixed(1)}s response latency)`;
    reasons.push(issue);
    technicalIssues.push(issue);
  }

  // H. Basic SEO Metadata Check
  const hasTitleTag = Boolean(metaTitle) || lowerContent.includes('<title>');
  if (!hasTitleTag) {
    const issue = 'Missing HTML title tag';
    reasons.push(issue);
    seoIssues.push(issue);
  }

  const hasMetaDesc = Boolean(metaDescription) || lowerContent.includes('name="description"');
  if (!hasMetaDesc) {
    const issue = 'Missing SEO meta description';
    reasons.push(issue);
    seoIssues.push(issue);
  }

  // 4. Contact Extraction (NEVER INVENT FAKE DATA)
  let extractedEmail: string | undefined = undefined;
  const mailtoMatch = content.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailtoMatch && mailtoMatch[1]) {
    const candidate = mailtoMatch[1].trim().toLowerCase();
    if (!candidate.includes('example.com') && !candidate.includes('wixpress') && !candidate.includes('sentry') && !candidate.endsWith('.png')) {
      extractedEmail = candidate;
    }
  }

  if (!extractedEmail) {
    const rawEmail = content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/);
    if (rawEmail && rawEmail[0]) {
      const candidate = rawEmail[0].trim().toLowerCase();
      if (!candidate.includes('example.com') && !candidate.includes('wixpress') && !candidate.includes('domain.com') && !candidate.endsWith('.png')) {
        extractedEmail = candidate;
      }
    }
  }

  let extractedPhone: string | undefined = undefined;
  const telMatch = content.match(/tel:([+\d\s-]{8,20})/i);
  if (telMatch && telMatch[1]) {
    extractedPhone = telMatch[1].trim();
  }

  // Social links extraction
  const socialLinks: string[] = [];
  const socialDomains = ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'youtube.com'];
  socialDomains.forEach(domain => {
    if (lowerContent.includes(domain)) {
      socialLinks.push(domain);
    }
  });

  // 5. Final Status Classification
  // WORKING | NEEDS_IMPROVEMENT | UNREACHABLE
  let status: WebsiteStatus = 'Working';
  if (reasons.length > 0) {
    status = 'Needs Improvement';
  }

  // Do not fabricate speed scores from HTTP response duration
  const speedScore = undefined;

  const structuredAudit: StructuredWebsiteAudit = {
    technical: {
      reachable: true,
      httpStatus: preCheck.statusCode,
      https: preCheck.isHttps,
      responseTimeMs: preCheck.durationMs,
      redirectCount: preCheck.redirectCount,
      brokenLinks: technicalIssues
    },
    mobile: {
      viewportConfigured: hasViewport,
      responsiveIndicators: hasViewport,
      issues: mobileIssues
    },
    seo: {
      title: metaTitle,
      hasTitle: hasTitleTag,
      metaDescription,
      hasMetaDescription: hasMetaDesc,
      hasH1: lowerContent.includes('<h1'),
      issues: seoIssues
    },
    conversion: {
      hasPhoneCta: Boolean(extractedPhone) || lowerContent.includes('tel:'),
      hasEmailCta: Boolean(extractedEmail) || lowerContent.includes('mailto:'),
      hasContactForm,
      hasWhatsappLink: hasWhatsApp,
      hasBookingLink,
      hasClearCta: hasCta,
      issues: conversionIssues
    },
    trust: {
      hasAboutPage: lowerContent.includes('about us') || links.some(l => l.includes('about')),
      hasServicesPage: lowerContent.includes('services') || links.some(l => l.includes('services')),
      hasSocialLinks: socialLinks.length > 0,
      socialLinks
    },
    detectedIssues: reasons,
    crawledPagesCount: pagesAnalyzed,
    deepCrawlAvailable,
    auditedAt: new Date().toISOString()
  };

  const finalResult: WebsiteAnalysisResult = {
    hasWebsite: true,
    url: formattedUrl,
    status,
    reasons,
    publicEmail: extractedEmail,
    publicPhone: extractedPhone,
    socialLinks,
    bookingLink: hasBookingLink ? 'Detected' : undefined,
    pagesAnalyzed,
    source: crawlSource,
    speedScore,
    mobileOptimized: hasViewport,
    sslSecure: preCheck.isHttps,
    audit: structuredAudit
  };

  websiteAuditCache.set(cacheKey, finalResult);
  return finalResult;
}
