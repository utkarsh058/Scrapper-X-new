import * as cheerio from 'cheerio';
import { safeFetch } from '@/lib/security/ssrfProtection';
import { leadPilotDb } from '@/db';

const INVALID_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)$/i;
const PLACEHOLDER_DOMAINS = /@(example\.(com|org|net)|domain\.(com|net)|test\.(com|net)|placeholder\.com|sentry\.io|wixpress\.com|myshopify\.com|localhost|invalid|schema\.org)$/i;
const GENERIC_USERNAMES = /^(yourname|your_email|name|email|username|user|sample)@/i;

/**
 * Email Utilities: Normalizes and extracts email addresses.
 * Never guesses or fabricates email addresses.
 */
export function normalizeEmail(rawEmail?: string | null): string | undefined {
  if (!rawEmail || typeof rawEmail !== 'string') return undefined;
  const trimmed = rawEmail.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === 'not available' ||
    trimmed === 'none' ||
    INVALID_EXTENSIONS.test(trimmed) ||
    PLACEHOLDER_DOMAINS.test(trimmed) ||
    GENERIC_USERNAMES.test(trimmed)
  ) {
    return undefined;
  }

  // RFC 5322-compatible email pattern check (no consecutive dots, valid TLD)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(trimmed) && !trimmed.includes('..')) {
    return trimmed;
  }
  return undefined;
}

export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  const valid = matches
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e));
  return Array.from(new Set(valid));
}

export interface WebsiteEmailExtractionResult {
  emails: string[];
  sourceUrl?: string;
}

/**
 * Lightweight, bounded email extraction from a candidate's actual website.
 * Never fabricates or guesses emails. Queries the homepage and if needed, 1 contact/about subpage.
 */
export async function extractEmailsFromWebsite(rawUrl: string): Promise<WebsiteEmailExtractionResult> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let domain = '';
  try {
    domain = new URL(url).hostname.toLowerCase();
  } catch {
    return { emails: [] };
  }

  const cacheKey = `emails:${domain}`;
  const cached = leadPilotDb.getCache<string[]>(cacheKey);
  if (cached) {
    return { emails: cached, sourceUrl: url };
  }

  const discoveredEmails = new Set<string>();
  let primarySourceUrl = url;

  // 1. Fetch homepage with short timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await safeFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadPilotVerifier/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      primarySourceUrl = res.url || url;
      const html = await res.text();
      const $ = cheerio.load(html);

      // A. Extract from mailto links
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const mail = href.replace(/^mailto:/i, '').split('?')[0].trim();
        const norm = normalizeEmail(mail);
        if (norm) discoveredEmails.add(norm);
      });

      // B. Extract from text content
      const bodyText = $('body').text() || html.slice(0, 50000);
      for (const email of extractEmailsFromText(bodyText)) {
        discoveredEmails.add(email);
      }

      // 2. If no email found on homepage, attempt at most 1 priority contact/about subpage
      if (discoveredEmails.size === 0) {
        let contactPageUrl: string | undefined;

        $('a[href]').each((_, el) => {
          if (contactPageUrl) return;
          const href = $(el).attr('href')?.trim();
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
          try {
            const resolved = new URL(href, primarySourceUrl);
            if (resolved.hostname.toLowerCase() === domain) {
              const path = resolved.pathname.toLowerCase();
              if (path.includes('contact') || path.includes('about')) {
                contactPageUrl = resolved.toString();
              }
            }
          } catch {}
        });

        if (contactPageUrl) {
          try {
            const subController = new AbortController();
            const subTimeoutId = setTimeout(() => subController.abort(), 2000);
            const subRes = await safeFetch(contactPageUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadPilotVerifier/1.0',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              signal: subController.signal,
            });
            clearTimeout(subTimeoutId);

            if (subRes.ok) {
              const subHtml = await subRes.text();
              const $sub = cheerio.load(subHtml);

              $sub('a[href^="mailto:"]').each((_, el) => {
                const href = $sub(el).attr('href') || '';
                const mail = href.replace(/^mailto:/i, '').split('?')[0].trim();
                const norm = normalizeEmail(mail);
                if (norm) {
                  discoveredEmails.add(norm);
                  primarySourceUrl = contactPageUrl!;
                }
              });

              const subBody = $sub('body').text() || subHtml.slice(0, 50000);
              for (const email of extractEmailsFromText(subBody)) {
                discoveredEmails.add(email);
                primarySourceUrl = contactPageUrl!;
              }
            }
          } catch {
            // Non-fatal subpage fetch error
          }
        }
      }
    }
  } catch {
    // Non-fatal network error or timeout
  }

  const resultList = Array.from(discoveredEmails);
  leadPilotDb.setCache(cacheKey, resultList, 86400000); // 24hr cache
  return { emails: resultList, sourceUrl: primarySourceUrl };
}

/**
 * Bounded concurrent extraction of emails across candidate websites.
 */
export async function extractBatchEmailsForCandidates(
  candidates: { website?: string; businessName?: string; email?: string; [key: string]: any }[],
  maxCandidates: number = 30
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  const toProcess = candidates
    .filter((c) => Boolean(c.website && c.website.trim().length > 0 && !c.email))
    .slice(0, maxCandidates);

  if (toProcess.length === 0) return emailMap;

  const BATCH_SIZE = 5;
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const chunk = toProcess.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (c) => {
        try {
          const res = await extractEmailsFromWebsite(c.website!);
          if (res.emails.length > 0) {
            const primaryEmail = res.emails[0];
            c.email = primaryEmail;
            c.emailSourceUrl = res.sourceUrl;
            emailMap.set(c.website!, primaryEmail);
          }
        } catch {
          // Non-fatal
        }
      })
    );
  }

  return emailMap;
}

