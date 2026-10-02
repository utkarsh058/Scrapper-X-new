import { safeFetch } from '../security/ssrfProtection';
import { leadPilotDb } from '@/db';

export type CanonicalWebsiteFilter = 'ANY' | 'WORKING' | 'UNREACHABLE' | 'NO_WEBSITE' | 'NEEDS_IMPROVEMENT';

export type CanonicalWebsiteStatus = 'WORKING' | 'UNREACHABLE' | 'NO_WEBSITE' | 'NEEDS_IMPROVEMENT';

/**
 * Normalizes any frontend, API, or legacy string into one canonical website filter.
 */
export function normalizeWebsiteFilter(raw?: string): CanonicalWebsiteFilter {
  if (!raw) return 'ANY';
  const clean = raw.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (clean === 'ANY' || clean === 'ANY_WEBSITE' || clean === 'ALL' || clean === 'ALL_WEBSITES') return 'ANY';
  if (clean === 'WORKING' || clean === 'WORKING_WEBSITE' || clean === 'WEBSITE_AVAILABLE') return 'WORKING';
  if (clean === 'UNREACHABLE' || clean === 'WEBSITE_UNREACHABLE') return 'UNREACHABLE';
  if (clean === 'NO_WEBSITE' || clean === 'WITHOUT_WEBSITE' || clean === 'NONE') return 'NO_WEBSITE';
  if (clean === 'NEEDS_IMPROVEMENT' || clean === 'NEEDS_WEBSITE_IMPROVEMENT') return 'NEEDS_IMPROVEMENT';
  return 'ANY';
}

/**
 * Normalizes any status string into canonical website status.
 */
export function normalizeWebsiteStatus(raw?: string): CanonicalWebsiteStatus {
  if (!raw) return 'NO_WEBSITE';
  const clean = raw.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (clean === 'WORKING' || clean === 'LIVE') return 'WORKING';
  if (clean === 'UNREACHABLE' || clean === 'TIMEOUT' || clean === 'DNS_ERROR' || clean === 'SSL_ERROR') return 'UNREACHABLE';
  if (clean === 'NO_WEBSITE' || clean === 'NOT_FOUND' || clean === 'NONE') return 'NO_WEBSITE';
  if (clean === 'NEEDS_IMPROVEMENT' || clean === 'NEEDS_WEBSITE_IMPROVEMENT') return 'NEEDS_IMPROVEMENT';
  return 'NO_WEBSITE';
}

export interface ReachabilityCheckResult {
  url: string;
  isReachable: boolean;
  statusCode: number;
  responseTimeMs: number;
  isHttps: boolean;
  finalUrl?: string;
  error?: string;
  flaws: string[];
}

/**
 * Executes a fast, SSRF-safe HTTP check to verify website reachability and basic quality signals.
 */
export async function checkWebsiteReachability(rawUrl: string): Promise<ReachabilityCheckResult> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const cacheKey = `reachability:${url.toLowerCase()}`;
  const cached = leadPilotDb.getCache<ReachabilityCheckResult>(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await safeFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadPilotVerifier/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseTimeMs = Date.now() - startTime;
    const finalUrl = res.url || url;
    const isHttps = finalUrl.startsWith('https://');
    const statusCode = res.status;

    // HTTP 200 to 399 is considered reachable
    const isReachable = statusCode >= 200 && statusCode < 400;

    const flaws: string[] = [];
    if (!isHttps) flaws.push('Insecure connection (missing HTTPS/SSL)');
    if (responseTimeMs > 1500) flaws.push(`Slow server response (${responseTimeMs}ms TTFB)`);

    // Sample first 15KB of HTML to detect basic flaws if reachable
    if (isReachable) {
      try {
        const text = await res.text();
        const lower = text.slice(0, 15000).toLowerCase();
        if (!lower.includes('<meta') || !lower.includes('viewport')) {
          flaws.push('Missing mobile viewport meta tag');
        }
        if (!lower.includes('<meta') || !lower.includes('name="description"')) {
          flaws.push('Missing SEO meta description');
        }
        const hasBookingOrPhone =
          lower.includes('tel:') ||
          lower.includes('booking') ||
          lower.includes('appointment') ||
          lower.includes('contact');
        if (!hasBookingOrPhone) {
          flaws.push('Missing obvious contact or booking call-to-action');
        }
      } catch {
        // Stream read issue is non-fatal to reachability
      }
    }

    const result: ReachabilityCheckResult = {
      url,
      isReachable,
      statusCode,
      responseTimeMs,
      isHttps,
      finalUrl,
      error: isReachable ? undefined : `Server returned HTTP ${statusCode}`,
      flaws,
    };

    leadPilotDb.setCache(cacheKey, result, 7200000); // 2 hours
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const msg = err.message || 'Unknown network error';
    const isTimeout = msg.includes('abort') || msg.includes('timeout') || err.name === 'AbortError';
    const isDns = msg.includes('ENOTFOUND') || msg.includes('DNS') || msg.includes('getaddrinfo');

    const result: ReachabilityCheckResult = {
      url,
      isReachable: false,
      statusCode: 0,
      responseTimeMs: Date.now() - startTime,
      isHttps: url.startsWith('https://'),
      error: isTimeout ? 'Connection timed out (>3.5s)' : isDns ? 'DNS resolution failed (domain inactive or dead)' : msg,
      flaws: ['Website unreachable or server down'],
    };

    leadPilotDb.setCache(cacheKey, result, 7200000);
    return result;
  }
}

/**
 * Checks reachability for a batch of candidate URLs in parallel chunks.
 */
export async function checkBatchReachability(
  urls: (string | undefined)[]
): Promise<Map<string, ReachabilityCheckResult>> {
  const map = new Map<string, ReachabilityCheckResult>();
  const validUrls = Array.from(
    new Set(
      urls
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u && u.length > 0))
    )
  );

  const BATCH_SIZE = 10;
  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const chunk = validUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (u) => {
        try {
          const res = await checkWebsiteReachability(u);
          map.set(u, res);
          // Also map by stripped domain
          try {
            const domain = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase();
            map.set(domain, res);
          } catch {}
        } catch (e: any) {
          map.set(u, {
            url: u,
            isReachable: false,
            statusCode: 0,
            responseTimeMs: 0,
            isHttps: u.startsWith('https://'),
            error: e.message || 'Check failed',
            flaws: ['Check failed'],
          });
        }
      })
    );
  }

  return map;
}

export interface WebsiteClassification {
  hasWebsite: boolean;
  url?: string;
  status: 'Working' | 'Unreachable' | 'No Website' | 'Needs Improvement';
  canonicalStatus: CanonicalWebsiteStatus;
  detectedIssues: string[];
  hasEvidenceBackedImprovement: boolean;
  matchesFilter: boolean;
  rejectionReason?: 'NO_WEBSITE' | 'HAS_WEBSITE' | 'WEBSITE_UNREACHABLE' | 'WEBSITE_WORKING' | 'NO_IMPROVEMENT_OPPORTUNITY' | 'WEBSITE_FILTER_MISMATCH';
  rejectionDetails?: string;
}

/**
 * Deterministically classifies a business's website status against the requested filter.
 */
export function classifyCandidateWebsite(
  websiteUrl: string | undefined,
  filter: CanonicalWebsiteFilter,
  reachResult?: ReachabilityCheckResult
): WebsiteClassification {
  const cleanUrl = websiteUrl?.trim();
  const hasUrl = Boolean(cleanUrl && cleanUrl.length > 0);

  // 1. NO_WEBSITE CASE
  if (!hasUrl) {
    const matches = filter === 'ANY' || filter === 'NO_WEBSITE';
    return {
      hasWebsite: false,
      url: undefined,
      status: 'No Website',
      canonicalStatus: 'NO_WEBSITE',
      detectedIssues: [],
      hasEvidenceBackedImprovement: false,
      matchesFilter: matches,
      rejectionReason: matches ? undefined : 'NO_WEBSITE',
      rejectionDetails: matches ? undefined : `Candidate has no verified website (requested filter: ${filter})`,
    };
  }

  // 2. HAS WEBSITE -> EXAMINE REACHABILITY
  const isReachable = reachResult ? reachResult.isReachable : false;
  const flaws = reachResult?.flaws || [];

  if (!isReachable) {
    // Verified Unreachable
    const matches = filter === 'ANY' || filter === 'UNREACHABLE';
    return {
      hasWebsite: true,
      url: cleanUrl,
      status: 'Unreachable',
      canonicalStatus: 'UNREACHABLE',
      detectedIssues: [reachResult?.error || 'Website unreachable or server down'],
      hasEvidenceBackedImprovement: false,
      matchesFilter: matches,
      rejectionReason: matches ? undefined : filter === 'NO_WEBSITE' ? 'HAS_WEBSITE' : 'WEBSITE_UNREACHABLE',
      rejectionDetails: matches
        ? undefined
        : `Website is unreachable (${reachResult?.error || 'error'}) (requested filter: ${filter})`,
    };
  }

  // 3. REACHABLE WEBSITE -> DISTINGUISH WORKING vs NEEDS_IMPROVEMENT
  const hasFlaws = flaws.length > 0;

  if (filter === 'NEEDS_IMPROVEMENT') {
    if (hasFlaws) {
      return {
        hasWebsite: true,
        url: cleanUrl,
        status: 'Needs Improvement',
        canonicalStatus: 'NEEDS_IMPROVEMENT',
        detectedIssues: flaws,
        hasEvidenceBackedImprovement: true,
        matchesFilter: true,
      };
    } else {
      return {
        hasWebsite: true,
        url: cleanUrl,
        status: 'Working',
        canonicalStatus: 'WORKING',
        detectedIssues: [],
        hasEvidenceBackedImprovement: false,
        matchesFilter: false,
        rejectionReason: 'NO_IMPROVEMENT_OPPORTUNITY',
        rejectionDetails: 'Website is fully functional and optimized without detected flaws',
      };
    }
  }

  // If filter is WORKING
  if (filter === 'WORKING') {
    return {
      hasWebsite: true,
      url: cleanUrl,
      status: 'Working',
      canonicalStatus: 'WORKING',
      detectedIssues: flaws,
      hasEvidenceBackedImprovement: hasFlaws,
      matchesFilter: true,
    };
  }

  // If filter is NO_WEBSITE
  if (filter === 'NO_WEBSITE') {
    return {
      hasWebsite: true,
      url: cleanUrl,
      status: hasFlaws ? 'Needs Improvement' : 'Working',
      canonicalStatus: hasFlaws ? 'NEEDS_IMPROVEMENT' : 'WORKING',
      detectedIssues: flaws,
      hasEvidenceBackedImprovement: hasFlaws,
      matchesFilter: false,
      rejectionReason: 'HAS_WEBSITE',
      rejectionDetails: `Candidate has an active, working website: ${cleanUrl} (requested filter: NO_WEBSITE)`,
    };
  }

  // If filter is UNREACHABLE
  if (filter === 'UNREACHABLE') {
    return {
      hasWebsite: true,
      url: cleanUrl,
      status: hasFlaws ? 'Needs Improvement' : 'Working',
      canonicalStatus: hasFlaws ? 'NEEDS_IMPROVEMENT' : 'WORKING',
      detectedIssues: flaws,
      hasEvidenceBackedImprovement: hasFlaws,
      matchesFilter: false,
      rejectionReason: 'WEBSITE_WORKING',
      rejectionDetails: `Website is active and reachable (${reachResult?.statusCode || 200} OK) (requested filter: UNREACHABLE)`,
    };
  }

  // Filter is ANY
  return {
    hasWebsite: true,
    url: cleanUrl,
    status: hasFlaws ? 'Needs Improvement' : 'Working',
    canonicalStatus: hasFlaws ? 'NEEDS_IMPROVEMENT' : 'WORKING',
    detectedIssues: flaws,
    hasEvidenceBackedImprovement: hasFlaws,
    matchesFilter: true,
  };
}

/**
 * Hard Guarantee Assertion:
 * Enforces that no delivered lead violates the requested website filter.
 */
export function assertHardGuarantee<T extends { websiteStatus?: string; website?: any; businessName?: string }>(
  leads: T[],
  filter: CanonicalWebsiteFilter
): { validLeads: T[]; violationsCount: number } {
  const validLeads: T[] = [];
  let violationsCount = 0;

  for (const lead of leads) {
    const status = lead.websiteStatus;
    let ok = false;

    if (filter === 'ANY') {
      ok = true;
    } else if (filter === 'WORKING') {
      ok = (status === 'Working' || status === 'WORKING') && Boolean(lead.website);
    } else if (filter === 'UNREACHABLE') {
      ok = (status === 'Unreachable' || status === 'UNREACHABLE') && Boolean(lead.website);
    } else if (filter === 'NO_WEBSITE') {
      ok = (status === 'No Website' || status === 'NO_WEBSITE') && !lead.website;
    } else if (filter === 'NEEDS_IMPROVEMENT') {
      ok = (status === 'Needs Improvement' || status === 'NEEDS_IMPROVEMENT') && Boolean(lead.website);
    }

    if (ok) {
      validLeads.push(lead);
    } else {
      violationsCount++;
      console.error(
        `[HARD GUARANTEE VIOLATION REJECTED]: Lead "${lead.businessName}" with status "${status}" and website "${
          typeof lead.website === 'string' ? lead.website : lead.website?.url || 'none'
        }" violated filter "${filter}". Excluded from delivery.`
      );
    }
  }

  return { validLeads, violationsCount };
}
