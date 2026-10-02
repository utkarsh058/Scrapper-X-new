import { WebsiteCrawlerProvider, CrawlResult, CrawledPage } from './WebsiteCrawlerProvider';
import { extractEmailsFromText } from '@/utils/emailUtils';
import { extractPhonesFromText } from '@/utils/phoneUtils';
import { canonicalizeUrl } from '@/utils/urlUtils';
import { validateUrlForSsrf } from '@/lib/security/ssrfProtection';
import { SocialLinks } from '@/models/Lead';
import * as cheerio from 'cheerio';
import { isLikelyClientSideSpa, renderPageWithHeadlessBrowser } from '@/lib/browser/headlessRenderer';

interface ParsedPageData {
  title: string;
  description?: string;
  hasViewport: boolean;
  hasCanonical: boolean;
  hasSchema: boolean;
  hasRobotsMeta: boolean;
  headings: string[];
  rawLinks: string[];
  bodyText: string;
  emails: string[];
  phones: string[];
  ctas: {
    hasPhoneCTA: boolean;
    hasEmailCTA: boolean;
    hasWhatsAppCTA: boolean;
    hasBookingCTA: boolean;
    hasContactForm: boolean;
  };
  socialLinks: SocialLinks;
}

interface InternalLinkCandidate {
  url: string;
  pathname: string;
  score: number;
}

const NON_HTML_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|zip|tar|gz|mp3|mp4|avi|mov|woff|woff2|ttf|eot)$/i;

function parsePageData(html: string): ParsedPageData {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : undefined;

  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
  const hasSchema = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);
  const hasRobotsMeta = /<meta[^>]*name=["']robots["']/i.test(html);

  const headings: string[] = [];
  const hRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hMatch;
  while ((hMatch = hRegex.exec(html)) !== null && headings.length < 10) {
    const cleanH = hMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (cleanH.length > 2) headings.push(cleanH);
  }

  const rawLinks: string[] = [];
  const aRegex = /<a[^>]*href=["']([^"']+)["']/gi;
  let aMatch;
  while ((aMatch = aRegex.exec(html)) !== null && rawLinks.length < 100) {
    rawLinks.push(aMatch[1]);
  }

  const bodyText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const emails = extractEmailsFromText(html + ' ' + bodyText);
  const phones = extractPhonesFromText(html + ' ' + bodyText);

  const hasPhoneCTA = /tel:|call now|phone/i.test(html);
  const hasEmailCTA = /mailto:/i.test(html);
  const hasWhatsAppCTA = /wa\.me|whatsapp|api\.whatsapp\.com/i.test(html);
  const hasBookingCTA = /book|appointment|reservation|schedule/i.test(html);
  const hasContactForm = /<form/i.test(html);

  const socialLinks: SocialLinks = {};
  const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
  if (fbMatch) socialLinks.facebook = fbMatch[0];
  const instaMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/i);
  if (instaMatch) socialLinks.instagram = instaMatch[0];
  const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/i);
  if (liMatch) socialLinks.linkedin = liMatch[0];
  const twMatch = html.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9._-]+/i);
  if (twMatch) socialLinks.twitter = twMatch[0];

  return {
    title,
    description,
    hasViewport,
    hasCanonical,
    hasSchema,
    hasRobotsMeta,
    headings,
    rawLinks,
    bodyText,
    emails,
    phones,
    ctas: {
      hasPhoneCTA,
      hasEmailCTA,
      hasWhatsAppCTA,
      hasBookingCTA,
      hasContactForm,
    },
    socialLinks,
  };
}

function getInternalLinkScore(pathname: string): number {
  const p = pathname.toLowerCase();
  if (/(?:^|\/)(?:contact-us|contact)(?:\/|\.html|\.php|$)/.test(p)) return 100;
  if (p.includes('contact')) return 85;
  if (/(?:^|\/)(?:reach-us|get-in-touch)(?:\/|\.html|\.php|$)/.test(p)) return 80;
  if (p.includes('reach-us') || p.includes('get-in-touch')) return 75;
  if (/(?:^|\/)(?:about-us|about)(?:\/|\.html|\.php|$)/.test(p)) return 60;
  if (p.includes('about')) return 50;
  if (/(?:^|\/)(?:team|our-team)(?:\/|\.html|\.php|$)/.test(p)) return 40;
  if (p.includes('team')) return 30;
  return 0;
}

function extractPrioritizedInternalLinks(
  rawLinks: string[],
  basePageUrl: string
): InternalLinkCandidate[] {
  let baseObj: URL;
  try {
    baseObj = new URL(basePageUrl);
  } catch {
    return [];
  }

  const baseHost = baseObj.hostname.toLowerCase();
  const baseDomain = baseHost.replace(/^www\./, '');
  const cleanBaseHost = baseObj.host;
  const cleanBasePath = baseObj.pathname.replace(/\/+$/, '') || '/';
  const baseNormalized = `${baseObj.protocol}//${cleanBaseHost}${cleanBasePath}`;

  const seen = new Set<string>();
  seen.add(baseNormalized);
  seen.add(baseNormalized + '/');
  seen.add(basePageUrl.replace(/\/+$/, ''));
  seen.add(basePageUrl.replace(/\/+$/, '') + '/');

  const candidates: InternalLinkCandidate[] = [];

  for (const rawHref of rawLinks) {
    if (!rawHref || typeof rawHref !== 'string') continue;
    const trimmed = rawHref.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('data:')) {
      continue;
    }

    try {
      const resolved = new URL(trimmed, basePageUrl);

      // Only http: and https: protocols
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        continue;
      }

      // Same-origin / same-domain check
      const linkHost = resolved.hostname.toLowerCase();
      const linkDomain = linkHost.replace(/^www\./, '');
      if (linkDomain !== baseDomain) {
        continue; // External domain, skip!
      }

      // Remove fragment
      resolved.hash = '';

      // Skip non-HTML asset files
      if (NON_HTML_EXTENSIONS.test(resolved.pathname)) {
        continue;
      }

      const cleanPath = resolved.pathname.replace(/\/+$/, '') || '/';
      const normalizedUrl = `${resolved.protocol}//${resolved.host}${cleanPath}${resolved.search}`;

      if (seen.has(normalizedUrl) || seen.has(normalizedUrl.replace(/\/+$/, ''))) {
        continue;
      }
      seen.add(normalizedUrl);
      seen.add(normalizedUrl.replace(/\/+$/, ''));

      const score = getInternalLinkScore(resolved.pathname);
      if (score > 0) {
        candidates.push({
          url: normalizedUrl,
          pathname: resolved.pathname,
          score,
        });
      }
    } catch {
      // Ignore malformed URL
    }
  }

  // Sort candidates by score descending, then pathname length ascending
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.pathname.length - b.pathname.length;
  });

  return candidates;
}

function createEmptyCrawlResult(targetUrl: string, loadTimeMs: number): CrawlResult {
  return {
    providerName: 'LeadPilot High-Speed Web Crawler',
    originalUrl: targetUrl,
    finalUrl: targetUrl,
    statusCode: 0,
    isHttps: targetUrl.startsWith('https://'),
    loadTimeMs,
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

export class InternalCrawlerProvider implements WebsiteCrawlerProvider {
  readonly providerId = 'internal_crawler';
  readonly name = 'LeadPilot High-Speed Web Crawler';

  public async crawlWebsite(targetUrl: string, maxPages: number = 2): Promise<CrawlResult> {
    const startTime = Date.now();
    const canonical = canonicalizeUrl(targetUrl) || targetUrl;

    // Strict SSRF check on initial target URL
    const ssrfCheck = await validateUrlForSsrf(canonical);
    if (!ssrfCheck.valid || !ssrfCheck.sanitizedUrl) {
      return createEmptyCrawlResult(targetUrl, Date.now() - startTime);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(ssrfCheck.sanitizedUrl, {
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
      let html = await response.text();
      let pageSizeBytes = Buffer.byteLength(html, 'utf8');

      let parsedHome = parsePageData(html);
      let renderMode = 'HTTP_ONLY';

      // BUG-005 JS Fallback: Check if initial homepage HTML strongly indicates a client-side SPA
      const $initial = cheerio.load(html);
      if (isLikelyClientSideSpa(html, $initial)) {
        renderMode = 'JS_FALLBACK_TRIGGERED';
        try {
          const renderResult = await renderPageWithHeadlessBrowser(finalUrl, { timeoutMs: 4000 });
          if (renderResult.success && renderResult.html) {
            html = renderResult.html;
            pageSizeBytes = Buffer.byteLength(html, 'utf8');
            parsedHome = parsePageData(html);
            renderMode = 'JS_RENDER_SUCCESS';
          } else {
            renderMode = renderResult.status === 'JS_RENDER_TIMEOUT' ? 'JS_RENDER_TIMEOUT' : 'JS_RENDER_FAILED';
          }
        } catch {
          renderMode = 'JS_RENDER_FAILED';
        }
      }

      const homepage: CrawledPage = {
        url: finalUrl,
        title: parsedHome.title,
        statusCode: response.status,
        textSnippet: parsedHome.bodyText.slice(0, 500),
        headings: parsedHome.headings,
        links: parsedHome.rawLinks.slice(0, 20),
      };

      const pages: CrawledPage[] = [homepage];
      const extractedEmails = [...parsedHome.emails];
      const extractedPhones = [...parsedHome.phones];
      const socialLinks: SocialLinks = { ...parsedHome.socialLinks };
      const ctas = { ...parsedHome.ctas };
      let totalPageSizeBytes = pageSizeBytes;

      // Secondary Pages Crawling (if maxPages > 1)
      if (maxPages > 1) {
        const internalCandidates = extractPrioritizedInternalLinks(parsedHome.rawLinks, finalUrl);
        const pagesToCrawl = internalCandidates.slice(0, maxPages - 1);

        for (const candidate of pagesToCrawl) {
          // SSRF check for secondary URL
          const subSsrf = await validateUrlForSsrf(candidate.url);
          if (!subSsrf.valid || !subSsrf.sanitizedUrl) {
            continue;
          }

          const elapsed = Date.now() - startTime;
          const remainingTimeout = Math.max(1000, Math.min(3000, 6000 - elapsed));
          if (remainingTimeout < 500) break; // Time budget expired

          const subController = new AbortController();
          const subTimeoutId = setTimeout(() => subController.abort(), remainingTimeout);

          try {
            const subResponse = await fetch(subSsrf.sanitizedUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LeadPilotBot/2.0; +https://leadpilot.io/bot)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              signal: subController.signal,
              redirect: 'follow',
            });
            clearTimeout(subTimeoutId);

            if (subResponse.ok) {
              const subHtml = await subResponse.text();
              const subFinalUrl = subResponse.url || candidate.url;
              totalPageSizeBytes += Buffer.byteLength(subHtml, 'utf8');

              const parsedSub = parsePageData(subHtml);

              const subPage: CrawledPage = {
                url: subFinalUrl,
                title: parsedSub.title,
                statusCode: subResponse.status,
                textSnippet: parsedSub.bodyText.slice(0, 500),
                headings: parsedSub.headings,
                links: parsedSub.rawLinks.slice(0, 20),
              };
              pages.push(subPage);

              // Merge discovered emails
              for (const em of parsedSub.emails) {
                if (!extractedEmails.includes(em)) {
                  extractedEmails.push(em);
                }
              }

              // Merge discovered phones
              for (const ph of parsedSub.phones) {
                if (!extractedPhones.includes(ph)) {
                  extractedPhones.push(ph);
                }
              }

              // Merge CTAs
              ctas.hasPhoneCTA = ctas.hasPhoneCTA || parsedSub.ctas.hasPhoneCTA;
              ctas.hasEmailCTA = ctas.hasEmailCTA || parsedSub.ctas.hasEmailCTA;
              ctas.hasWhatsAppCTA = ctas.hasWhatsAppCTA || parsedSub.ctas.hasWhatsAppCTA;
              ctas.hasBookingCTA = ctas.hasBookingCTA || parsedSub.ctas.hasBookingCTA;
              ctas.hasContactForm = ctas.hasContactForm || parsedSub.ctas.hasContactForm;

              // Merge Social Links
              socialLinks.facebook = socialLinks.facebook || parsedSub.socialLinks.facebook;
              socialLinks.instagram = socialLinks.instagram || parsedSub.socialLinks.instagram;
              socialLinks.linkedin = socialLinks.linkedin || parsedSub.socialLinks.linkedin;
              socialLinks.twitter = socialLinks.twitter || parsedSub.socialLinks.twitter;
            }
          } catch {
            clearTimeout(subTimeoutId);
            // Non-fatal: secondary page failure does not fail the crawl
          }
        }
      }

      return {
        providerName: this.name,
        originalUrl: targetUrl,
        finalUrl,
        statusCode: response.status,
        isHttps,
        loadTimeMs: durationMs,
        pageSizeBytes: totalPageSizeBytes,
        pages,
        extractedEmails,
        extractedPhones,
        socialLinks,
        extractedServices: parsedHome.headings.slice(0, 5),
        ctas,
        meta: {
          title: parsedHome.title,
          description: parsedHome.description,
          hasViewport: parsedHome.hasViewport,
          hasCanonical: parsedHome.hasCanonical,
          hasSchema: parsedHome.hasSchema,
          hasRobotsMeta: parsedHome.hasRobotsMeta,
          renderMode,
        },
        crawledAt: new Date().toISOString(),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return createEmptyCrawlResult(targetUrl, Date.now() - startTime);
    }
  }
}

export const internalCrawlerProvider = new InternalCrawlerProvider();
