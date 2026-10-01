import { WebsiteCrawlerProvider, CrawlResult, CrawledPage } from './WebsiteCrawlerProvider';
import { extractEmailsFromText } from '@/utils/emailUtils';
import { extractPhonesFromText } from '@/utils/phoneUtils';
import { canonicalizeUrl } from '@/utils/urlUtils';

export class InternalCrawlerProvider implements WebsiteCrawlerProvider {
  readonly providerId = 'internal_crawler';
  readonly name = 'LeadPilot High-Speed Web Crawler';

  public async crawlWebsite(targetUrl: string, maxPages: number = 2): Promise<CrawlResult> {
    const startTime = Date.now();
    const canonical = canonicalizeUrl(targetUrl) || targetUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(canonical, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LeadPilotBot/2.0; +https://leadpilot.io/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      const finalUrl = response.url || canonical;
      const isHttps = finalUrl.startsWith('https://');
      const html = await response.text();
      const pageSizeBytes = Buffer.byteLength(html, 'utf8');

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

      // Extract description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      const description = descMatch ? descMatch[1].trim() : undefined;

      // Extract viewport
      const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
      const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
      const hasSchema = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);
      const hasRobotsMeta = /<meta[^>]*name=["']robots["']/i.test(html);

      // Extract Headings
      const headings: string[] = [];
      const hRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
      let hMatch;
      while ((hMatch = hRegex.exec(html)) !== null && headings.length < 10) {
        const cleanH = hMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        if (cleanH.length > 2) headings.push(cleanH);
      }

      // Extract Links
      const links: string[] = [];
      const aRegex = /<a[^>]*href=["']([^"']+)["']/gi;
      let aMatch;
      while ((aMatch = aRegex.exec(html)) !== null && links.length < 50) {
        links.push(aMatch[1]);
      }

      // Text body representation
      const bodyText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

      // Contacts
      const extractedEmails = extractEmailsFromText(html + ' ' + bodyText);
      const extractedPhones = extractPhonesFromText(html + ' ' + bodyText);

      // CTAs
      const hasPhoneCTA = /tel:|call now|phone/i.test(html);
      const hasEmailCTA = /mailto:/i.test(html);
      const hasWhatsAppCTA = /wa\.me|whatsapp|api\.whatsapp\.com/i.test(html);
      const hasBookingCTA = /book|appointment|reservation|schedule/i.test(html);
      const hasContactForm = /<form/i.test(html);

      // Social Links
      const socialLinks: any = {};
      const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
      if (fbMatch) socialLinks.facebook = fbMatch[0];
      const instaMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/i);
      if (instaMatch) socialLinks.instagram = instaMatch[0];
      const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/i);
      if (liMatch) socialLinks.linkedin = liMatch[0];
      const twMatch = html.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9._-]+/i);
      if (twMatch) socialLinks.twitter = twMatch[0];

      const page: CrawledPage = {
        url: finalUrl,
        title,
        statusCode: response.status,
        textSnippet: bodyText.slice(0, 500),
        headings,
        links: links.slice(0, 20),
      };

      return {
        providerName: this.name,
        originalUrl: targetUrl,
        finalUrl,
        statusCode: response.status,
        isHttps,
        loadTimeMs: durationMs,
        pageSizeBytes,
        pages: [page],
        extractedEmails,
        extractedPhones,
        socialLinks,
        extractedServices: headings.slice(0, 5),
        ctas: {
          hasPhoneCTA,
          hasEmailCTA,
          hasWhatsAppCTA,
          hasBookingCTA,
          hasContactForm,
        },
        meta: {
          title,
          description,
          hasViewport,
          hasCanonical,
          hasSchema,
          hasRobotsMeta,
        },
        crawledAt: new Date().toISOString(),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        providerName: this.name,
        originalUrl: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        isHttps: targetUrl.startsWith('https://'),
        loadTimeMs: Date.now() - startTime,
        pageSizeBytes: 0,
        pages: [],
        extractedEmails: [],
        extractedPhones: [],
        socialLinks: {},
        extractedServices: [],
        ctas: {
          hasPhoneCTA: false,
          hasEmailCTA: false,
          hasWhatsAppCTA: false,
          hasBookingCTA: false,
          hasContactForm: false,
        },
        meta: {
          hasViewport: false,
          hasCanonical: false,
          hasSchema: false,
          hasRobotsMeta: false,
        },
        crawledAt: new Date().toISOString(),
      };
    }
  }
}

export const internalCrawlerProvider = new InternalCrawlerProvider();
