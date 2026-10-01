import { WebsiteCrawlerProvider, CrawlResult, CrawledPage } from './WebsiteCrawlerProvider';
import { internalCrawlerProvider } from './InternalCrawlerProvider';
import { canonicalizeUrl } from '@/utils/urlUtils';
import { extractEmailsFromText } from '@/utils/emailUtils';
import { extractPhonesFromText } from '@/utils/phoneUtils';

export class PlaywrightCrawlerProvider implements WebsiteCrawlerProvider {
  readonly providerId = 'playwright_crawler';
  readonly name = 'Playwright Headless Browser Crawler';

  /**
   * Crawls a website using Playwright if available, or gracefully falls back to internal crawler.
   */
  public async crawlWebsite(targetUrl: string, maxPages: number = 2): Promise<CrawlResult> {
    const canonical = canonicalizeUrl(targetUrl) || targetUrl;
    const startTime = Date.now();

    // Check if Playwright is available in runtime
    let playwright: any = null;
    try {
      // Dynamic import to prevent bundler failure if playwright is not installed
      // @ts-ignore
      playwright = await import('playwright');
    } catch {
      // Playwright not installed in environment, use fast internal crawler
      return internalCrawlerProvider.crawlWebsite(canonical, maxPages);
    }

    if (!playwright || !playwright.chromium) {
      return internalCrawlerProvider.crawlWebsite(canonical, maxPages);
    }

    let browser: any = null;
    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadPilotVerifier/1.0',
      });

      const response = await page.goto(canonical, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      const statusCode = response ? response.status() : 200;
      const finalUrl = page.url() || canonical;
      const isHttps = finalUrl.startsWith('https://');

      // Wait briefly for client-side hydrate
      await page.waitForTimeout(1000);

      const html = await page.content();
      const title = await page.title();
      const durationMs = Date.now() - startTime;
      const pageSizeBytes = Buffer.byteLength(html, 'utf8');

      // Extract text body
      const bodyText = await page.evaluate(() => document.body?.innerText || '');

      // Headings
      const headings = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('h1, h2, h3'))
          .map((h) => (h as HTMLElement).innerText?.trim())
          .filter((t) => Boolean(t && t.length > 2))
          .slice(0, 10);
      });

      // Links
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href.startsWith('http'))
          .slice(0, 20);
      });

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

      const crawledPage: CrawledPage = {
        url: finalUrl,
        title,
        statusCode,
        textSnippet: bodyText.slice(0, 500),
        headings,
        links,
      };

      return {
        providerName: this.name,
        originalUrl: targetUrl,
        finalUrl,
        statusCode,
        isHttps,
        loadTimeMs: durationMs,
        pageSizeBytes,
        pages: [crawledPage],
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
          hasViewport: /<meta[^>]*name=["']viewport["']/i.test(html),
          hasCanonical: /<link[^>]*rel=["']canonical["']/i.test(html),
          hasSchema: /application\/ld\+json/i.test(html),
          hasRobotsMeta: /<meta[^>]*name=["']robots["']/i.test(html),
        },
        crawledAt: new Date().toISOString(),
      };
    } catch {
      // On any browser error, fallback to internal crawler
      return internalCrawlerProvider.crawlWebsite(canonical, maxPages);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }
}

export const playwrightCrawlerProvider = new PlaywrightCrawlerProvider();
