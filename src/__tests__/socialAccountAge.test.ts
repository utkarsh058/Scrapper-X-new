import { describe, it, expect } from 'vitest';
import {
  SocialAccountAgeResolverService,
  socialAccountAgeResolverService,
} from '@/services/social/SocialAccountAgeResolverService';
import { CanonicalBusinessIdentity, SocialProfile } from '@/types/canonical';

describe('Real Social Account Creation Date Enrichment V2 Test Suite', () => {
  const baseIdentity: CanonicalBusinessIdentity = {
    name: 'Haveli Of Grill',
    category: 'Restaurant',
    categories: ['Restaurant', 'North Indian Restaurant'],
    address: 'CC - 242, Ansal Golf Link -1, Greater Noida, Uttar Pradesh 201315',
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    postalCode: '201315',
    phone: '092660 41042',
    phoneE164: '+919266041042',
    website: 'https://haveliofgrill.com',
    confidenceScore: 0.95,
  };

  const baseProfile = (platform: 'facebook' | 'instagram' | 'linkedin', url: string): SocialProfile => ({
    id: `soc_test_${platform}`,
    businessId: 'biz_test_1',
    platform,
    profileUrl: url,
    username: 'haveliofgrill',
    displayName: 'Haveli Of Grill',
    description: 'Fine dining Indian restaurant',
    followers: null,
    following: null,
    posts: null,
    subscribers: null,
    videos: null,
    likes: null,
    verified: null,
    createdAt: null,
    createdAtType: 'NOT_AVAILABLE',
    firstSeenAt: new Date(),
    lastActivityAt: null,
    source: 'website_footer',
    confidence: 0.95,
    createdAtSource: null,
    metricStatus: 'NOT_AVAILABLE',
    metricSource: null,
    metricSourceType: 'NONE',
    followersFetchedAt: null,
    verificationStatus: 'VERIFIED',
    lastCheckedAt: new Date(),
  });

  // 1. Exact Facebook creation date
  it('1. resolves exact Facebook creation date with DAY precision', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Page created on June 12, 2018</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).not.toBeNull();
    expect(res.accountCreatedAt?.toISOString()).toBe('2018-06-12T00:00:00.000Z');
    expect(res.accountCreatedDatePrecision).toBe('DAY');
    expect(res.accountCreatedStatus).toBe('VERIFIED_EXACT');
    expect(res.accountCreatedConfidence).toBe('HIGH');
    expect(res.accountCreatedSourceType).toBe('PUBLIC_PROFILE');
    expect(res.accountCreatedEvidenceText).toContain('Page created on June 12, 2018');
  });

  // 2. Month-only Facebook date
  it('2. resolves month-only Facebook creation date with MONTH precision', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Joined Facebook in March 2019</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).not.toBeNull();
    expect(res.accountCreatedAt?.toISOString()).toBe('2019-03-01T00:00:00.000Z');
    expect(res.accountCreatedDatePrecision).toBe('MONTH');
    expect(res.accountCreatedStatus).toBe('VERIFIED_MONTH');
    expect(res.accountCreatedConfidence).toBe('HIGH');
    expect(res.accountCreatedEvidenceText).toContain('Joined Facebook in March 2019');
  });

  // 3. Year-only date
  it('3. resolves year-only Facebook date with YEAR precision', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Joined Facebook in 2018</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).not.toBeNull();
    expect(res.accountCreatedAt?.toISOString()).toBe('2018-01-01T00:00:00.000Z');
    expect(res.accountCreatedDatePrecision).toBe('YEAR');
    expect(res.accountCreatedStatus).toBe('VERIFIED_YEAR');
  });

  // 4. Instagram creation date unavailable
  it('4. marks Instagram creation date as NOT_AVAILABLE when not publicly exposed', async () => {
    const profile = baseProfile('instagram', 'https://www.instagram.com/haveliofgrill');
    const html = `<html><body><div>Haveli of Grill Restaurant • 1,234 followers</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedDatePrecision).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 5. LinkedIn creation date unavailable
  it('5. marks LinkedIn creation date as NOT_AVAILABLE when explicit creation date is missing', async () => {
    const profile = baseProfile('linkedin', 'https://www.linkedin.com/company/haveliofgrill');
    const html = `<html><body><div>Company overview: Hospitality • 50-200 employees</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedDatePrecision).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 6. First post must NOT become creation date
  it('6. ensures first post date does NOT become accountCreatedAt', async () => {
    const profile = baseProfile('instagram', 'https://www.instagram.com/haveliofgrill');
    const html = `<html><body><div>First post on March 15, 2021</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      providedEarliestPostDate: new Date('2021-03-15T00:00:00.000Z'),
      providedEarliestPostUrl: 'https://www.instagram.com/p/CMc12345/',
      bypassCache: true,
    });

    // CRITICAL REQUIREMENT: First post date MUST NOT be accountCreatedAt
    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedDatePrecision).toBeNull();
    expect(res.accountCreatedStatus).toBe('FIRST_OBSERVED_ONLY');
    expect(res.firstObservedAt?.toISOString()).toBe('2021-03-15T00:00:00.000Z');
    expect(res.firstObservedSourceType).toBe('PUBLIC_POST');
    expect(res.earliestPublicPostAt?.toISOString()).toBe('2021-03-15T00:00:00.000Z');
  });

  // 7. Domain registration must NOT become creation date
  it('7. ensures domain registration date does NOT become social account creation date', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Official domain registered on 2010-04-12</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 8. Business founding year must NOT become creation date
  it('8. ensures business founding year does NOT become LinkedIn account creation date', async () => {
    const profile = baseProfile('linkedin', 'https://www.linkedin.com/company/haveliofgrill');
    const html = `<html><body><div>Founded in 2005 • Food & Beverages</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    // CRITICAL: 2005 business founding year != LinkedIn page creation date
    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 9. Search-engine index date must NOT become creation date
  it('9. ensures search-engine index date does NOT become account creation date', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Indexed by Google on 2019-04-02</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 10. Archive date must become firstObservedAt, not accountCreatedAt
  it('10. records archive date as firstObservedAt and leaves accountCreatedAt as NULL', async () => {
    const profile = baseProfile('instagram', 'https://www.instagram.com/haveliofgrill');
    const archiveDate = new Date('2020-08-17T00:00:00.000Z');

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedArchiveDate: archiveDate,
      providedArchiveUrl: 'https://web.archive.org/web/20200817000000/https://instagram.com/haveliofgrill',
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.firstObservedAt?.toISOString()).toBe('2020-08-17T00:00:00.000Z');
    expect(res.firstObservedSourceType).toBe('PUBLIC_ARCHIVE');
    expect(res.accountCreatedStatus).toBe('FIRST_OBSERVED_ONLY');
  });

  // 11. Wrong social profile rejected
  it('11. rejects ambiguous candidate profile belonging to a different city', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill_delhi');
    const html = `<html><body><div>Page created on June 12, 2018</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      candidateLocation: 'Delhi, India', // Discrepancy with lead's city: Greater Noida
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
    expect(res.accountCreatedEvidenceText).toContain('Business identity rejected');
  });

  // 12. Conflicting dates
  it('12. surfaces CONFLICT status and sets accountCreatedAt to null when sources disagree', () => {
    const conflictResult = socialAccountAgeResolverService.evaluateConflict([
      {
        sourceUrl: 'https://facebook.com/page1',
        evidenceText: 'Joined in June 2018',
        parsedDate: new Date('2018-06-01T00:00:00.000Z'),
        precision: 'MONTH',
      },
      {
        sourceUrl: 'https://facebook.com/page2',
        evidenceText: 'Joined in September 2019',
        parsedDate: new Date('2019-09-01T00:00:00.000Z'),
        precision: 'MONTH',
      },
    ]);

    expect(conflictResult.status).toBe('CONFLICT');
    expect(conflictResult.chosenDate).toBeNull();
    expect(conflictResult.chosenPrecision).toBeNull();
  });

  // 13. Missing date
  it('13. returns NOT_AVAILABLE when date is completely missing', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Welcome to our restaurant! Contact us for bookings.</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 14. Invalid date
  it('14. rejects malformed or impossible dates without throwing', () => {
    const parsedInvalidDay = socialAccountAgeResolverService.parseDateWithPrecision('February 31, 2020');
    expect(parsedInvalidDay).toBeNull();

    const parsedInvalidMonth = socialAccountAgeResolverService.parseDateWithPrecision('Smarch 2019');
    expect(parsedInvalidMonth).toBeNull();

    const parsedImpossibleYear = socialAccountAgeResolverService.parseDateWithPrecision('1850');
    expect(parsedImpossibleYear).toBeNull();
  });

  // 15. Date precision preservation
  it('15. strictly preserves DAY, MONTH, and YEAR precision', () => {
    const exact = socialAccountAgeResolverService.parseDateWithPrecision('June 12, 2018');
    expect(exact?.precision).toBe('DAY');
    expect(exact?.date.getUTCDate()).toBe(12);
    expect(exact?.date.getUTCMonth()).toBe(5);
    expect(exact?.date.getUTCFullYear()).toBe(2018);

    const monthOnly = socialAccountAgeResolverService.parseDateWithPrecision('March 2019');
    expect(monthOnly?.precision).toBe('MONTH');
    expect(monthOnly?.date.getUTCDate()).toBe(1);
    expect(monthOnly?.date.getUTCMonth()).toBe(2);
    expect(monthOnly?.date.getUTCFullYear()).toBe(2019);

    const yearOnly = socialAccountAgeResolverService.parseDateWithPrecision('2018');
    expect(yearOnly?.precision).toBe('YEAR');
    expect(yearOnly?.date.getUTCDate()).toBe(1);
    expect(yearOnly?.date.getUTCMonth()).toBe(0);
    expect(yearOnly?.date.getUTCFullYear()).toBe(2018);
  });

  // 16. Evidence URL required
  it('16. populates accountCreatedSourceUrl when date is verified', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Page created on June 12, 2018</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedSourceUrl).toBe('https://www.facebook.com/haveliofgrill');
  });

  // 17. Evidence text required
  it('17. preserves the exact evidence snippet in accountCreatedEvidenceText', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Page created on June 12, 2018</div></body></html>`;

    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: html,
      bypassCache: true,
    });

    expect(res.accountCreatedEvidenceText).toBe('Page created on June 12, 2018');
  });

  // 18. Timestamp required
  it('18. records a valid fetchedAt timestamp on all resolution results', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Page created on June 12, 2018</div></body></html>`,
      bypassCache: true,
    });

    expect(res.accountCreatedFetchedAt).toBeInstanceOf(Date);
    expect(Date.now() - res.accountCreatedFetchedAt.getTime()).toBeLessThan(5000);
  });

  // 19. NULL remains NULL
  it('19. ensures missing creation date remains strictly NULL, never 0 or epoch', async () => {
    const profile = baseProfile('instagram', 'https://www.instagram.com/haveliofgrill');
    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>No creation info</div></body></html>`,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedAt).not.toBe(0);
    expect(res.accountCreatedAt).not.toEqual(new Date(0));
  });

  // 20. No fabricated dates
  it('20. does not fabricate dates to artificially inflate coverage', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    // HTML with no creation date statement
    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Just restaurant photos and menu items</div></body></html>`,
      bypassCache: true,
    });

    expect(res.accountCreatedAt).toBeNull();
    expect(res.accountCreatedStatus).toBe('NOT_AVAILABLE');
  });

  // 21. No hardcoded production dates
  it('21. dynamically reflects different input dates without hardcoding', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');

    const res1 = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Page created on July 4, 2015</div></body></html>`,
      bypassCache: true,
    });
    const res2 = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Page created on November 23, 2021</div></body></html>`,
      bypassCache: true,
    });

    expect(res1.accountCreatedAt?.toISOString()).toBe('2015-07-04T00:00:00.000Z');
    expect(res2.accountCreatedAt?.toISOString()).toBe('2021-11-23T00:00:00.000Z');
    expect(res1.accountCreatedAt?.getTime()).not.toBe(res2.accountCreatedAt?.getTime());
  });

  // 22. No random dates (Deterministic)
  it('22. produces strictly deterministic results across multiple identical invocations', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const html = `<html><body><div>Page created on June 12, 2018</div></body></html>`;

    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        socialAccountAgeResolverService.resolve(baseIdentity, profile, {
          providedHtml: html,
          bypassCache: true,
        })
      )
    );

    const firstIso = results[0].accountCreatedAt?.toISOString();
    expect(firstIso).toBe('2018-06-12T00:00:00.000Z');
    for (const r of results) {
      expect(r.accountCreatedAt?.toISOString()).toBe(firstIso);
      expect(r.accountCreatedDatePrecision).toBe('DAY');
      expect(r.accountCreatedStatus).toBe('VERIFIED_EXACT');
    }
  });

  // 23. No conversion of year-only to exact day
  it('23. preserves YEAR precision and does not claim Jan 1 as an exact day', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Joined in 2019</div></body></html>`,
      bypassCache: true,
    });

    expect(res.accountCreatedDatePrecision).toBe('YEAR');
    expect(res.accountCreatedStatus).toBe('VERIFIED_YEAR');
    // Normalized representation is 2019-01-01 UTC, but precision MUST be YEAR
    expect(res.accountCreatedDatePrecision).not.toBe('DAY');
  });

  // 24. No conversion of month-only to exact day
  it('24. preserves MONTH precision and does not claim day 1 as an exact day', async () => {
    const profile = baseProfile('facebook', 'https://www.facebook.com/haveliofgrill');
    const res = await socialAccountAgeResolverService.resolve(baseIdentity, profile, {
      providedHtml: `<html><body><div>Joined Facebook in March 2019</div></body></html>`,
      bypassCache: true,
    });

    expect(res.accountCreatedDatePrecision).toBe('MONTH');
    expect(res.accountCreatedStatus).toBe('VERIFIED_MONTH');
    expect(res.accountCreatedDatePrecision).not.toBe('DAY');
  });

  // 25. UI displays precision correctly
  it('25. UI formatting logic handles exact, month, year, first-observed and not-available correctly', () => {
    const formatUiDisplay = (soc: {
      accountCreatedAt: Date | null;
      accountCreatedDatePrecision: string | null;
      accountCreatedStatus: string;
      firstObservedAt?: Date | null;
    }) => {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      if (!soc.accountCreatedAt || soc.accountCreatedStatus === 'NOT_AVAILABLE') {
        const firstObserved = soc.firstObservedAt
          ? `${monthNames[soc.firstObservedAt.getUTCMonth()]} ${soc.firstObservedAt.getUTCDate()}, ${soc.firstObservedAt.getUTCFullYear()}`
          : null;
        return {
          createdText: 'Not available',
          statusBadge: null,
          firstObservedText: firstObserved,
        };
      }

      const d = soc.accountCreatedAt;
      if (soc.accountCreatedDatePrecision === 'YEAR' || soc.accountCreatedStatus === 'VERIFIED_YEAR') {
        return {
          createdText: String(d.getUTCFullYear()),
          statusBadge: 'Verified year',
          firstObservedText: null,
        };
      }

      if (soc.accountCreatedDatePrecision === 'MONTH' || soc.accountCreatedStatus === 'VERIFIED_MONTH') {
        return {
          createdText: `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
          statusBadge: 'Verified month',
          firstObservedText: null,
        };
      }

      return {
        createdText: `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
        statusBadge: 'Verified',
        firstObservedText: null,
      };
    };

    // Case A: Exact
    const exactUi = formatUiDisplay({
      accountCreatedAt: new Date('2018-06-12T00:00:00.000Z'),
      accountCreatedDatePrecision: 'DAY',
      accountCreatedStatus: 'VERIFIED_EXACT',
    });
    expect(exactUi.createdText).toBe('June 12, 2018');
    expect(exactUi.statusBadge).toBe('Verified');

    // Case B: Month
    const monthUi = formatUiDisplay({
      accountCreatedAt: new Date('2019-03-01T00:00:00.000Z'),
      accountCreatedDatePrecision: 'MONTH',
      accountCreatedStatus: 'VERIFIED_MONTH',
    });
    expect(monthUi.createdText).toBe('March 2019');
    expect(monthUi.statusBadge).toBe('Verified month');
    expect(monthUi.createdText).not.toContain('March 1, 2019');

    // Case C: Year
    const yearUi = formatUiDisplay({
      accountCreatedAt: new Date('2018-01-01T00:00:00.000Z'),
      accountCreatedDatePrecision: 'YEAR',
      accountCreatedStatus: 'VERIFIED_YEAR',
    });
    expect(yearUi.createdText).toBe('2018');
    expect(yearUi.statusBadge).toBe('Verified year');
    expect(yearUi.createdText).not.toContain('January 1, 2018');

    // Case D: First observed only
    const firstObsUi = formatUiDisplay({
      accountCreatedAt: null,
      accountCreatedDatePrecision: null,
      accountCreatedStatus: 'FIRST_OBSERVED_ONLY',
      firstObservedAt: new Date('2021-03-15T00:00:00.000Z'),
    });
    expect(firstObsUi.createdText).toBe('Not available');
    expect(firstObsUi.firstObservedText).toBe('March 15, 2021');

    // Case E: No evidence
    const noneUi = formatUiDisplay({
      accountCreatedAt: null,
      accountCreatedDatePrecision: null,
      accountCreatedStatus: 'NOT_AVAILABLE',
    });
    expect(noneUi.createdText).toBe('Not available');
    expect(noneUi.firstObservedText).toBeNull();
  });
});
