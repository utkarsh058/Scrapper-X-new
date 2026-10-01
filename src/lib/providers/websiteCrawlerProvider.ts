import * as cheerio from 'cheerio';
import { safeFetch, validateUrlForSsrf } from '../security/ssrfProtection';
import { WebsiteCrawlerProvider, WebsiteCrawlSummary, CrawlPageResult } from './types';

const PRIORITY_PAGE_PATTERNS = [
  /contact/i,
  /about/i,
  /services?/i,
  /book(ing)?/i,
  /team/i,
  /menu/i,
  /pricing/i,
];

const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
];

export class RobustWebsiteCrawlerProvider implements WebsiteCrawlerProvider {
  readonly name = 'leadpilot_crawler';

  async crawl(rawUrl: string, pageLimit: number = 4): Promise<WebsiteCrawlSummary> {
    const ssrfCheck = await validateUrlForSsrf(rawUrl);
    if (!ssrfCheck.valid || !ssrfCheck.sanitizedUrl) {
      return {
        domain: rawUrl,
        rootUrl: rawUrl,
        isReachable: false,
        isHttps: false,
        hasMobileViewport: false,
        pagesCrawled: [],
        emails: [],
        phones: [],
        whatsappLinks: [],
        bookingLinks: [],
        socialLinks: [],
        hasContactForm: false,
        hasBookingCta: false,
        hasPhoneCta: false,
        detectedIssues: [`Target URL failed security validation: ${ssrfCheck.reason}`],
      };
    }

    const targetUrl = ssrfCheck.sanitizedUrl;
    const parsedOrigin = new URL(targetUrl);
    const domain = parsedOrigin.hostname;
    const isHttps = parsedOrigin.protocol === 'https:';

    const emails = new Set<string>();
    const phones = new Set<string>();
    const whatsappLinks = new Set<string>();
    const bookingLinks = new Set<string>();
    const socialLinks = new Set<string>();
    const detectedIssues: string[] = [];
    const pagesCrawled: CrawlPageResult[] = [];

    if (!isHttps) {
      detectedIssues.push('Website does not enforce HTTPS encryption');
    }

    // 1. Fetch Root Page with latency measurement
    const startTime = Date.now();
    let rootHtml = '';
    let responseTimeMs = 0;
    let httpStatus = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await safeFetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadPilot Quality Bot; https://leadpilot.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);
      responseTimeMs = Date.now() - startTime;
      httpStatus = res.status;

      if (!res.ok) {
        detectedIssues.push(`Server returned HTTP status ${res.status}`);
        return {
          domain,
          rootUrl: targetUrl,
          isReachable: false,
          isHttps,
          httpStatus,
          responseTimeMs,
          hasMobileViewport: false,
          pagesCrawled: [],
          emails: [],
          phones: [],
          whatsappLinks: [],
          bookingLinks: [],
          socialLinks: [],
          hasContactForm: false,
          hasBookingCta: false,
          hasPhoneCta: false,
          detectedIssues,
        };
      }

      rootHtml = await res.text();
    } catch (err: any) {
      detectedIssues.push(err.name === 'AbortError' ? 'Connection timed out (>6s)' : err.message || 'DNS / SSL connection failed');
      return {
        domain,
        rootUrl: targetUrl,
        isReachable: false,
        isHttps,
        httpStatus: 0,
        responseTimeMs: Date.now() - startTime,
        hasMobileViewport: false,
        pagesCrawled: [],
        emails: [],
        phones: [],
        whatsappLinks: [],
        bookingLinks: [],
        socialLinks: [],
        hasContactForm: false,
        hasBookingCta: false,
        hasPhoneCta: false,
        detectedIssues,
      };
    }

    if (responseTimeMs > 3500) {
      detectedIssues.push(`Slow server initial response time (${(responseTimeMs / 1000).toFixed(1)}s)`);
    }

    // 2. Parse Root Page with Cheerio
    const rootPageResult = this.parsePageContent(targetUrl, rootHtml, httpStatus);
    pagesCrawled.push(rootPageResult);

    rootPageResult.emails.forEach((e) => emails.add(e));
    rootPageResult.phones.forEach((p) => phones.add(p));
    rootPageResult.whatsappLinks.forEach((w) => whatsappLinks.add(w));
    rootPageResult.socialLinks.forEach((s) => socialLinks.add(s));

    const hasMobileViewport =
      rootHtml.toLowerCase().includes('name="viewport"') ||
      rootHtml.toLowerCase().includes("name='viewport'");

    if (!hasMobileViewport) {
      detectedIssues.push('Missing mobile viewport meta configuration (Not optimized for smartphones)');
    }

    // 3. Find and Crawl Priority Subpages (Contact, About, Services, Booking)
    const queue = rootPageResult.internalLinks
      .filter((link) => {
        try {
          const lUrl = new URL(link, targetUrl);
          // Only crawl same domain and priority paths
          return lUrl.hostname === domain && PRIORITY_PAGE_PATTERNS.some((p) => p.test(lUrl.pathname));
        } catch {
          return false;
        }
      })
      .slice(0, pageLimit - 1);

    const visitedUrls = new Set<string>([targetUrl]);

    for (const subUrl of queue) {
      if (visitedUrls.has(subUrl)) continue;
      visitedUrls.add(subUrl);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const subRes = await safeFetch(subUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadPilot Quality Bot; https://leadpilot.app)',
          },
        });

        clearTimeout(timeoutId);
        if (subRes.ok) {
          const subHtml = await subRes.text();
          const subPageResult = this.parsePageContent(subUrl, subHtml, subRes.status);
          pagesCrawled.push(subPageResult);

          subPageResult.emails.forEach((e) => emails.add(e));
          subPageResult.phones.forEach((p) => phones.add(p));
          subPageResult.whatsappLinks.forEach((w) => whatsappLinks.add(w));
          subPageResult.socialLinks.forEach((s) => socialLinks.add(s));
        }
      } catch {
        // Silently skip unreachable subpages
      }
    }

    // 4. Evaluate Aggregate Conversion Signals
    const hasContactForm = pagesCrawled.some((p) => p.hasContactForm);
    const hasBookingCta = pagesCrawled.some((p) => p.hasBookingCta);
    const hasPhoneCta = phones.size > 0 || pagesCrawled.some((p) => p.phones.length > 0);

    if (!hasContactForm) {
      detectedIssues.push('No lead capture form or contact form detected across crawled pages');
    }

    if (!hasBookingCta && whatsappLinks.size === 0) {
      detectedIssues.push('No direct online appointment or booking call-to-action detected');
    }

    return {
      domain,
      rootUrl: targetUrl,
      isReachable: true,
      isHttps,
      httpStatus,
      responseTimeMs,
      hasMobileViewport,
      pagesCrawled,
      emails: Array.from(emails),
      phones: Array.from(phones),
      whatsappLinks: Array.from(whatsappLinks),
      bookingLinks: Array.from(bookingLinks),
      socialLinks: Array.from(socialLinks),
      hasContactForm,
      hasBookingCta: hasBookingCta || whatsappLinks.size > 0,
      hasPhoneCta,
      detectedIssues,
    };
  }

  private parsePageContent(pageUrl: string, html: string, statusCode: number): CrawlPageResult {
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || undefined;
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || undefined;
    const h1 = $('h1').first().text().trim() || undefined;

    const emails = new Set<string>();
    const phones = new Set<string>();
    const whatsappLinks = new Set<string>();
    const socialLinks = new Set<string>();
    const internalLinks = new Set<string>();

    // 1. Mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      if (email && !email.includes('example.com') && !email.includes('wixpress') && !email.endsWith('.png')) {
        emails.add(email);
      }
    });

    // 2. Tel links
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const phone = href.replace(/^tel:/i, '').trim();
      if (phone && phone.length >= 7) {
        phones.add(phone);
      }
    });

    // 3. Scan all anchor links for WhatsApp, socials, and internal navigation
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const lower = href.toLowerCase();

      if (lower.includes('wa.me') || lower.includes('api.whatsapp.com') || lower.includes('whatsapp:')) {
        whatsappLinks.add(href);
      }

      for (const socialDomain of SOCIAL_DOMAINS) {
        if (lower.includes(socialDomain)) {
          socialLinks.add(href);
        }
      }

      // Collect internal links
      if (href.startsWith('/') || href.startsWith(pageUrl)) {
        try {
          const resolved = new URL(href, pageUrl).toString();
          internalLinks.add(resolved);
        } catch {
          // ignore
        }
      }
    });

    // 4. Regex scan body text for plain text emails if none found in mailto
    if (emails.size === 0) {
      const text = $('body').text() || '';
      const matches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g);
      if (matches) {
        for (const match of matches) {
          const clean = match.trim().toLowerCase();
          if (!clean.includes('example.com') && !clean.includes('wixpress') && !clean.endsWith('.png')) {
            emails.add(clean);
          }
        }
      }
    }

    // 5. Detect interactive forms and CTA keywords
    const hasContactForm =
      $('form').length > 0 ||
      $('input[type="email"]').length > 0 ||
      html.includes('contact-form') ||
      html.includes('wpcf7');

    const lowerHtml = html.toLowerCase();
    const hasBookingCta =
      lowerHtml.includes('book an appointment') ||
      lowerHtml.includes('schedule a visit') ||
      lowerHtml.includes('book online') ||
      lowerHtml.includes('reserve a table') ||
      lowerHtml.includes('calendly.com') ||
      lowerHtml.includes('practo.com');

    return {
      url: pageUrl,
      title,
      metaDescription,
      h1,
      statusCode,
      emails: Array.from(emails),
      phones: Array.from(phones),
      whatsappLinks: Array.from(whatsappLinks),
      socialLinks: Array.from(socialLinks),
      hasContactForm,
      hasBookingCta,
      internalLinks: Array.from(internalLinks),
      crawledAt: new Date().toISOString(),
    };
  }
}

export const websiteCrawler = new RobustWebsiteCrawlerProvider();
