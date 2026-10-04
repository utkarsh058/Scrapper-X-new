/**
 * Social Account Age & Creation Date Resolver Service (V2)
 * 
 * Strict Architectural Guarantees:
 * 1. ACCURACY > COVERAGE.
 * 2. ZERO FAKE/ESTIMATED DATA POLICY IS ABSOLUTE.
 *    - Never infer creation date from first post, oldest reel, follower count, or username age.
 *    - Never use domain registration date or business founding date as social account creation date.
 *    - Never convert earliest search engine indexed date to account creation date.
 *    - Never convert year-only or month-only dates into exact days.
 * 3. Statuses allowed:
 *    - VERIFIED_EXACT (e.g. "Page created on June 12, 2018")
 *    - VERIFIED_MONTH (e.g. "Joined Facebook in March 2019")
 *    - VERIFIED_YEAR  (e.g. "Joined in 2019")
 *    - FIRST_OBSERVED_ONLY (archive snapshot, earliest public post, etc.)
 *    - NOT_AVAILABLE (when unverifiable or missing)
 *    - CONFLICT (when two independent sources disagree)
 * 4. Precisions allowed: 'DAY' | 'MONTH' | 'YEAR'.
 * 5. Bounded HTTP requests with timeouts and SSRF protection.
 * 6. Business Identity Validation to reject ambiguous profiles.
 */

import {
  SocialPlatform,
  AccountCreatedStatus,
  AccountCreatedDatePrecision,
  AccountCreatedConfidence,
  AccountCreatedSourceType,
  CanonicalBusinessIdentity,
  SocialProfile,
} from '@/types/canonical';

export interface AccountCreationEvidence {
  platform: SocialPlatform;
  profileUrl: string;
  accountCreatedAt: Date | null;
  accountCreatedDatePrecision: AccountCreatedDatePrecision | null;
  accountCreatedStatus: AccountCreatedStatus;
  accountCreatedConfidence: AccountCreatedConfidence | null;
  accountCreatedSourceType: AccountCreatedSourceType | null;
  accountCreatedSourceUrl: string | null;
  accountCreatedEvidenceText: string | null;
  accountCreatedFetchedAt: Date;
  firstObservedAt: Date | null;
  firstObservedSourceType: string | null;
  firstObservedSourceUrl: string | null;
  firstObservedEvidenceText: string | null;
  earliestPublicPostAt?: Date | null;
  earliestPublicPostSourceUrl?: string | null;
  conflictingEvidences?: Array<{
    sourceUrl: string;
    evidenceText: string;
    parsedDate: Date;
    precision: AccountCreatedDatePrecision;
  }>;
}

export interface ParsedExplicitDate {
  date: Date;
  precision: AccountCreatedDatePrecision;
  evidenceText: string;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export class SocialAccountAgeResolverService {
  private static readonly REQUEST_TIMEOUT_MS = 4000;
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Main entry point: Resolves the account creation or first-observed date for a social profile.
   */
  public async resolve(
    identity: CanonicalBusinessIdentity,
    profile: SocialProfile,
    options?: {
      providedHtml?: string;
      providedArchiveDate?: Date;
      providedArchiveUrl?: string;
      providedEarliestPostDate?: Date;
      providedEarliestPostUrl?: string;
      candidateLocation?: string;
      candidateDomain?: string;
      bypassCache?: boolean;
    }
  ): Promise<AccountCreationEvidence> {
    const now = new Date();
    const profileUrl = profile.profileUrl || '';
    const platform = profile.platform.toLowerCase() as SocialPlatform;

    // 1. Business Identity Guard: Reject ambiguous or mismatched profiles
    const isIdentityValid = this.validateBusinessIdentity(identity, profile, {
      candidateLocation: options?.candidateLocation,
      candidateDomain: options?.candidateDomain,
    });

    if (!isIdentityValid) {
      return this.createNotAvailableResult(platform, profileUrl, now, 'Business identity rejected / ambiguous profile');
    }

    // 2. Cache / Idempotency Check:
    // If a verified result already exists and is within TTL, preserve it
    if (
      !options?.bypassCache &&
      profile.accountCreatedFetchedAt &&
      profile.accountCreatedStatus &&
      profile.accountCreatedStatus !== 'NOT_AVAILABLE' &&
      now.getTime() - new Date(profile.accountCreatedFetchedAt).getTime() < SocialAccountAgeResolverService.CACHE_TTL_MS
    ) {
      return {
        platform,
        profileUrl,
        accountCreatedAt: profile.accountCreatedAt || null,
        accountCreatedDatePrecision: profile.accountCreatedDatePrecision || null,
        accountCreatedStatus: profile.accountCreatedStatus,
        accountCreatedConfidence: profile.accountCreatedConfidence || null,
        accountCreatedSourceType: profile.accountCreatedSourceType || null,
        accountCreatedSourceUrl: profile.accountCreatedSourceUrl || null,
        accountCreatedEvidenceText: profile.accountCreatedEvidenceText || null,
        accountCreatedFetchedAt: profile.accountCreatedFetchedAt,
        firstObservedAt: profile.firstObservedAt || null,
        firstObservedSourceType: profile.firstObservedSourceType || null,
        firstObservedSourceUrl: profile.firstObservedSourceUrl || null,
        firstObservedEvidenceText: profile.firstObservedEvidenceText || null,
        earliestPublicPostAt: profile.earliestPublicPostAt || null,
        earliestPublicPostSourceUrl: profile.earliestPublicPostSourceUrl || null,
      };
    }

    // 3. Platform-specific creation date resolution
    let creationEvidence: ParsedExplicitDate | null = null;
    let sourceUrl: string | null = null;
    let sourceType: AccountCreatedSourceType = 'NONE';
    let confidence: AccountCreatedConfidence = 'HIGH';

    if (platform === 'facebook') {
      const fbResult = await this.resolveFacebookPageCreation(profileUrl, options?.providedHtml);
      if (fbResult) {
        creationEvidence = fbResult.parsed;
        sourceUrl = fbResult.sourceUrl;
        sourceType = fbResult.sourceType;
        confidence = fbResult.confidence;
      }
    } else if (platform === 'instagram') {
      const igResult = await this.resolveInstagramAccountAge(profileUrl, options?.providedHtml);
      if (igResult) {
        creationEvidence = igResult.parsed;
        sourceUrl = igResult.sourceUrl;
        sourceType = igResult.sourceType;
        confidence = igResult.confidence;
      }
    } else if (platform === 'linkedin') {
      const liResult = await this.resolveLinkedInCompanyAccountAge(profileUrl, options?.providedHtml);
      if (liResult) {
        creationEvidence = liResult.parsed;
        sourceUrl = liResult.sourceUrl;
        sourceType = liResult.sourceType;
        confidence = liResult.confidence;
      }
    }

    // 4. Handle Discovered Creation Date (if valid explicit creation date found)
    if (creationEvidence) {
      let status: AccountCreatedStatus = 'VERIFIED_EXACT';
      if (creationEvidence.precision === 'MONTH') {
        status = 'VERIFIED_MONTH';
      } else if (creationEvidence.precision === 'YEAR') {
        status = 'VERIFIED_YEAR';
      }

      return {
        platform,
        profileUrl,
        accountCreatedAt: creationEvidence.date,
        accountCreatedDatePrecision: creationEvidence.precision,
        accountCreatedStatus: status,
        accountCreatedConfidence: confidence,
        accountCreatedSourceType: sourceType,
        accountCreatedSourceUrl: sourceUrl || profileUrl,
        accountCreatedEvidenceText: creationEvidence.evidenceText,
        accountCreatedFetchedAt: now,
        firstObservedAt: null,
        firstObservedSourceType: null,
        firstObservedSourceUrl: null,
        firstObservedEvidenceText: null,
      };
    }

    // 5. Fallback: Check Supporting Evidence for First Observed Date (NEVER copy into accountCreatedAt)
    // Sources: Archive snapshots, earliest public post, etc.
    let firstObservedAt: Date | null = null;
    let firstObservedSourceType: string | null = null;
    let firstObservedSourceUrl: string | null = null;
    let firstObservedEvidenceText: string | null = null;

    if (options?.providedArchiveDate) {
      firstObservedAt = options.providedArchiveDate;
      firstObservedSourceType = 'PUBLIC_ARCHIVE';
      firstObservedSourceUrl = options.providedArchiveUrl || 'https://web.archive.org';
      firstObservedEvidenceText = `Public archive snapshot observed on ${options.providedArchiveDate.toISOString().split('T')[0]}`;
    } else if (options?.providedEarliestPostDate) {
      firstObservedAt = options.providedEarliestPostDate;
      firstObservedSourceType = 'PUBLIC_POST';
      firstObservedSourceUrl = options.providedEarliestPostUrl || profileUrl;
      firstObservedEvidenceText = `Earliest public post observed on ${options.providedEarliestPostDate.toISOString().split('T')[0]}`;
    }

    if (firstObservedAt) {
      return {
        platform,
        profileUrl,
        accountCreatedAt: null,
        accountCreatedDatePrecision: null,
        accountCreatedStatus: 'FIRST_OBSERVED_ONLY',
        accountCreatedConfidence: 'MEDIUM',
        accountCreatedSourceType: 'NONE',
        accountCreatedSourceUrl: null,
        accountCreatedEvidenceText: null,
        accountCreatedFetchedAt: now,
        firstObservedAt,
        firstObservedSourceType,
        firstObservedSourceUrl,
        firstObservedEvidenceText,
        earliestPublicPostAt: options?.providedEarliestPostDate || null,
        earliestPublicPostSourceUrl: options?.providedEarliestPostUrl || null,
      };
    }

    // 6. Nothing verifiable: return NOT_AVAILABLE with NULL
    return this.createNotAvailableResult(platform, profileUrl, now);
  }

  /**
   * Helper to return standard NOT_AVAILABLE record with all required NULLs.
   */
  public createNotAvailableResult(
    platform: SocialPlatform,
    profileUrl: string,
    fetchedAt: Date,
    evidenceText: string = 'No explicit public account creation date available'
  ): AccountCreationEvidence {
    return {
      platform,
      profileUrl,
      accountCreatedAt: null,
      accountCreatedDatePrecision: null,
      accountCreatedStatus: 'NOT_AVAILABLE',
      accountCreatedConfidence: null,
      accountCreatedSourceType: 'NONE',
      accountCreatedSourceUrl: null,
      accountCreatedEvidenceText: evidenceText,
      accountCreatedFetchedAt: fetchedAt,
      firstObservedAt: null,
      firstObservedSourceType: null,
      firstObservedSourceUrl: null,
      firstObservedEvidenceText: null,
      earliestPublicPostAt: null,
      earliestPublicPostSourceUrl: null,
    };
  }

  /**
   * Resolves Facebook Page creation date from public HTML / transparency signals.
   * Only accepts explicit public statements:
   * - "Page created on June 12, 2018"
   * - "Page created - 12 June 2018"
   * - "Joined Facebook in March 2019"
   * - "Joined Facebook in 2018"
   */
  public async resolveFacebookPageCreation(
    profileUrl: string,
    providedHtml?: string
  ): Promise<{
    parsed: ParsedExplicitDate;
    sourceUrl: string;
    sourceType: AccountCreatedSourceType;
    confidence: AccountCreatedConfidence;
  } | null> {
    const html = providedHtml || (await this.fetchPublicHtml(profileUrl));
    if (!html) return null;

    const parsed = this.parseExplicitCreationDate(html, 'facebook');
    if (!parsed) return null;

    return {
      parsed,
      sourceUrl: profileUrl,
      sourceType: 'PUBLIC_PROFILE',
      confidence: 'HIGH',
    };
  }

  /**
   * Resolves Instagram account age.
   * Strict Rule:
   * Instagram does NOT expose account creation date on public web profiles.
   * If not explicitly and genuinely found in public metadata, returns null (NOT_AVAILABLE).
   * NEVER infers creation date from first post, oldest reel, or follower count.
   */
  public async resolveInstagramAccountAge(
    profileUrl: string,
    providedHtml?: string
  ): Promise<{
    parsed: ParsedExplicitDate;
    sourceUrl: string;
    sourceType: AccountCreatedSourceType;
    confidence: AccountCreatedConfidence;
  } | null> {
    const html = providedHtml || (await this.fetchPublicHtml(profileUrl));
    if (!html) return null;

    const parsed = this.parseExplicitCreationDate(html, 'instagram');
    if (!parsed) return null;

    return {
      parsed,
      sourceUrl: profileUrl,
      sourceType: 'PUBLIC_PROFILE',
      confidence: 'HIGH',
    };
  }

  /**
   * Resolves LinkedIn organization page creation date.
   * Strict Rule:
   * LinkedIn public company pages often state "Founded in 2005".
   * THIS IS COMPANY FOUNDING YEAR, NOT LINKEDIN CREATION YEAR!
   * Returns null unless the page explicitly states "Page created on..." or "Joined LinkedIn in...".
   */
  public async resolveLinkedInCompanyAccountAge(
    profileUrl: string,
    providedHtml?: string
  ): Promise<{
    parsed: ParsedExplicitDate;
    sourceUrl: string;
    sourceType: AccountCreatedSourceType;
    confidence: AccountCreatedConfidence;
  } | null> {
    const html = providedHtml || (await this.fetchPublicHtml(profileUrl));
    if (!html) return null;

    const parsed = this.parseExplicitCreationDate(html, 'linkedin');
    if (!parsed) return null;

    return {
      parsed,
      sourceUrl: profileUrl,
      sourceType: 'PUBLIC_PROFILE',
      confidence: 'HIGH',
    };
  }

  /**
   * Parses explicit creation wording from raw text or HTML.
   *
   * STRICT SEPARATION:
   * - "First post on ...", "Oldest photo ...", "Domain registered ...", "Founded in ..."
   *   MUST NEVER MATCH HERE!
   */
  public parseExplicitCreationDate(
    text: string,
    platform?: string
  ): ParsedExplicitDate | null {
    if (!text || typeof text !== 'string') return null;

    // Reject false-positive triggers
    // If the text contains ONLY founding date or domain date or first post without explicit account creation:
    // We strictly search for explicit patterns:
    // 1. "Page created on <Date>"
    // 2. "Page created - <Date>"
    // 3. "Page created: <Date>"
    // 4. "Page created • <Date>"
    // 5. "Created on <Date>"
    // 6. "Created - <Date>"
    // 7. "Joined Facebook in <Month Year>" / "Joined Facebook on <Date>" / "Joined Facebook in <Year>"
    // 8. "Joined Instagram in <Month Year>" / "Joined Instagram on <Date>"
    // 9. "Joined LinkedIn in <Month Year>" / "Joined LinkedIn on <Date>"
    // 10. "Account created on <Date>" / "Account created in <Month Year>" / "Account created in <Year>"
    // 11. "Profile created on <Date>"
    // 12. "Joined <Month Year>" (when in explicit join context)

    const patterns: RegExp[] = [
      // Explicit Page/Account Created with Day / Month / Year
      /(?:page\s+created\s*(?:on|[-:•])?\s*|account\s+created\s*(?:on|in|[-:•])?\s*|profile\s+created\s*(?:on|[-:•])?\s*)([A-Za-z]+[\s\d,.-]+|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4})/i,
      // Created on / Created in
      /(?:created\s+(?:on|in)\s*)([A-Za-z]+[\s\d,.-]+|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      // Joined <Platform> on / in
      /(?:joined\s+(?:facebook|instagram|linkedin)\s+(?:on|in)\s*)([A-Za-z]+[\s\d,.-]+|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4})/i,
      // Joined on / Joined in (e.g. "Joined March 2019", "Joined in 2019", "Joined June 12, 2018")
      /(?:joined\s+(?:in|on)\s+)([A-Za-z]+\s+\d{1,2},?\s+\d{4}|[A-Za-z]+\s+\d{4}|\d{4})/i,
      /(?:joined\s+)([A-Za-z]+\s+\d{4})/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const rawDateCandidate = match[1].trim();
        // Disqualify if it contains non-date words like "first post" or "founded"
        if (/post|founded|domain|register|index|photo|reel/i.test(rawDateCandidate)) {
          continue;
        }

        const parsed = this.parseDateWithPrecision(rawDateCandidate);
        if (parsed) {
          return {
            date: parsed.date,
            precision: parsed.precision,
            evidenceText: match[0].trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Deterministically parses a date string and identifies its exact precision.
   * Returns:
   * - DAY: Date with exact day, month, and year
   * - MONTH: Normalized to 1st of month, precision = MONTH
   * - YEAR: Normalized to Jan 1 of year, precision = YEAR
   *
   * Never fabricates missing components.
   */
  public parseDateWithPrecision(
    raw: string
  ): { date: Date; precision: AccountCreatedDatePrecision } | null {
    if (!raw || typeof raw !== 'string') return null;

    const cleaned = raw.replace(/[•,]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Check ISO Format: YYYY-MM-DD
    const isoDayMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDayMatch) {
      const y = parseInt(isoDayMatch[1], 10);
      const m = parseInt(isoDayMatch[2], 10) - 1;
      const d = parseInt(isoDayMatch[3], 10);
      if (this.isValidDateValues(y, m, d)) {
        return {
          date: new Date(Date.UTC(y, m, d, 0, 0, 0)),
          precision: 'DAY',
        };
      }
    }

    // 2. Check ISO Format: YYYY-MM
    const isoMonthMatch = cleaned.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMonthMatch) {
      const y = parseInt(isoMonthMatch[1], 10);
      const m = parseInt(isoMonthMatch[2], 10) - 1;
      if (this.isValidDateValues(y, m, 1)) {
        return {
          date: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
          precision: 'MONTH',
        };
      }
    }

    // 3. Format: Day Month Year (e.g. "12 June 2018", "12 Jun 2018")
    const dmyMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const monthStr = dmyMatch[2].toLowerCase();
      const y = parseInt(dmyMatch[3], 10);
      const m = MONTH_NAMES[monthStr];
      if (m !== undefined && this.isValidDateValues(y, m, d)) {
        return {
          date: new Date(Date.UTC(y, m, d, 0, 0, 0)),
          precision: 'DAY',
        };
      }
    }

    // 4. Format: Month Day Year (e.g. "June 12 2018", "Jun 12 2018")
    const mdyMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    if (mdyMatch) {
      const monthStr = mdyMatch[1].toLowerCase();
      const d = parseInt(mdyMatch[2], 10);
      const y = parseInt(mdyMatch[3], 10);
      const m = MONTH_NAMES[monthStr];
      if (m !== undefined && this.isValidDateValues(y, m, d)) {
        return {
          date: new Date(Date.UTC(y, m, d, 0, 0, 0)),
          precision: 'DAY',
        };
      }
    }

    // 5. Format: Month Year (e.g. "March 2019", "March 2019", "Mar 2019")
    const myMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (myMatch) {
      const monthStr = myMatch[1].toLowerCase();
      const y = parseInt(myMatch[2], 10);
      const m = MONTH_NAMES[monthStr];
      if (m !== undefined && this.isValidDateValues(y, m, 1)) {
        return {
          date: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
          precision: 'MONTH',
        };
      }
    }

    // 6. Format: Year Only (e.g. "2018")
    const yMatch = cleaned.match(/^(\d{4})$/);
    if (yMatch) {
      const y = parseInt(yMatch[1], 10);
      if (y >= 1995 && y <= new Date().getFullYear()) {
        return {
          date: new Date(Date.UTC(y, 0, 1, 0, 0, 0)),
          precision: 'YEAR',
        };
      }
    }

    return null;
  }

  private isValidDateValues(year: number, monthIndex: number, day: number): boolean {
    if (year < 1995 || year > new Date().getFullYear()) return false;
    if (monthIndex < 0 || monthIndex > 11) return false;
    if (day < 1) return false;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    if (day > daysInMonth) return false;
    return true;
  }

  /**
   * Conflict Detection:
   * When two sources disagree (e.g. Source A says "June 2018", Source B says "September 2019"),
   * DO NOT arbitrarily choose one.
   * Mark as CONFLICT and store both records.
   */
  public evaluateConflict(
    evidences: Array<{
      sourceUrl: string;
      evidenceText: string;
      parsedDate: Date;
      precision: AccountCreatedDatePrecision;
    }>
  ): {
    status: AccountCreatedStatus;
    chosenDate: Date | null;
    chosenPrecision: AccountCreatedDatePrecision | null;
  } {
    if (!evidences || evidences.length === 0) {
      return { status: 'NOT_AVAILABLE', chosenDate: null, chosenPrecision: null };
    }

    if (evidences.length === 1) {
      const single = evidences[0];
      const status: AccountCreatedStatus =
        single.precision === 'DAY'
          ? 'VERIFIED_EXACT'
          : single.precision === 'MONTH'
          ? 'VERIFIED_MONTH'
          : 'VERIFIED_YEAR';
      return {
        status,
        chosenDate: single.parsedDate,
        chosenPrecision: single.precision,
      };
    }

    // Compare all candidates. If they have differing years or differing months:
    const first = evidences[0];
    const hasDisagreement = evidences.some((e) => {
      if (first.precision === 'YEAR' && e.precision === 'YEAR') {
        return first.parsedDate.getUTCFullYear() !== e.parsedDate.getUTCFullYear();
      }
      if (first.precision === 'MONTH' && e.precision === 'MONTH') {
        return (
          first.parsedDate.getUTCFullYear() !== e.parsedDate.getUTCFullYear() ||
          first.parsedDate.getUTCMonth() !== e.parsedDate.getUTCMonth()
        );
      }
      return first.parsedDate.getTime() !== e.parsedDate.getTime();
    });

    if (hasDisagreement) {
      return {
        status: 'CONFLICT',
        chosenDate: null, // Do not fabricate or pick one arbitrarily
        chosenPrecision: null,
      };
    }

    return {
      status: first.precision === 'DAY' ? 'VERIFIED_EXACT' : first.precision === 'MONTH' ? 'VERIFIED_MONTH' : 'VERIFIED_YEAR',
      chosenDate: first.parsedDate,
      chosenPrecision: first.precision,
    };
  }

  /**
   * Business Identity Validation:
   * Ensures that candidate social profile actually matches the LeadPilot business.
   * Rejects ambiguous candidates (e.g. Lead in Greater Noida, candidate in Delhi).
   */
  public validateBusinessIdentity(
    identity: CanonicalBusinessIdentity,
    profile: SocialProfile,
    candidateDetails?: {
      candidateLocation?: string;
      candidateDomain?: string;
    }
  ): boolean {
    if (!identity || !identity.name) return false;

    // 1. Check City / Location Conflict
    if (identity.city && candidateDetails?.candidateLocation) {
      const cleanLeadCity = identity.city.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCandidateLoc = candidateDetails.candidateLocation.toLowerCase().replace(/[^a-z0-9]/g, '');

      // If candidate mentions a distinct city that does NOT match the lead's city:
      const majorCities = ['delhi', 'noida', 'greaternoida', 'gurgaon', 'mumbai', 'bengaluru', 'toronto', 'losangeles'];
      const leadInMajor = majorCities.find((c) => cleanLeadCity.includes(c));
      const candInMajor = majorCities.find((c) => cleanCandidateLoc.includes(c));

      if (leadInMajor && candInMajor && leadInMajor !== candInMajor) {
        // Discrepancy: Candidate is Delhi, Lead is Greater Noida -> Reject!
        return false;
      }
    }

    // 2. Check Domain Match if provided
    if (identity.website && candidateDetails?.candidateDomain) {
      const bizDomain = this.normalizeDomain(identity.website);
      const candDomain = this.normalizeDomain(candidateDetails.candidateDomain);
      if (bizDomain && candDomain && bizDomain !== candDomain) {
        return false;
      }
    }

    // 3. High confidence if profile was extracted directly from business website
    if (
      profile.source === 'website_header' ||
      profile.source === 'website_footer' ||
      profile.source === 'website_jsonld' ||
      profile.source === 'website_body'
    ) {
      return true;
    }

    // 4. Verification status
    if (profile.verificationStatus === 'REJECTED') {
      return false;
    }

    return true;
  }

  private normalizeDomain(urlOrDomain: string): string {
    try {
      const withProto = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
      const hostname = new URL(withProto).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      return urlOrDomain.toLowerCase().replace(/^www\./, '');
    }
  }

  /**
   * Safe Bounded HTTP Fetch:
   * - SSRF protection: only social platform domains allowed.
   * - Max 4s timeout.
   * - No login bypass, no CAPTCHA solving.
   * - On failure (403, 429, 302 to login, timeout): returns null.
   */
  private async fetchPublicHtml(url: string): Promise<string | null> {
    if (!url || !url.startsWith('http')) return null;

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      const allowedHosts = [
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'instagram.com',
        'www.instagram.com',
        'linkedin.com',
        'www.linkedin.com',
        'archive.org',
        'web.archive.org',
      ];

      const isAllowed = allowedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
      if (!isAllowed) {
        return null;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SocialAccountAgeResolverService.REQUEST_TIMEOUT_MS);

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        return null;
      }

      // Check if redirected to a login wall
      const finalUrl = resp.url || '';
      if (
        finalUrl.includes('login') ||
        finalUrl.includes('checkpoint') ||
        finalUrl.includes('auth') ||
        finalUrl.includes('signin')
      ) {
        return null;
      }

      const text = await resp.text();
      return text;
    } catch {
      return null;
    }
  }
}

export const socialAccountAgeResolverService = new SocialAccountAgeResolverService();
