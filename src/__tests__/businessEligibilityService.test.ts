import { describe, it, expect } from 'vitest';
import { BusinessEligibilityService } from '@/services/eligibility/BusinessEligibilityService';
import { CanonicalBusiness } from '@/types/canonical';

function makeTestBusiness(id: string, rating: number | null, reviewCount: number | null = 100): CanonicalBusiness {
  return {
    id,
    source: 'GOOGLE_PLACES',
    identity: {
      name: `Business ${id}`,
      category: 'Restaurant',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
    },
    google: {
      placeId: `place_${id}`,
      rating,
      reviewCount,
      mapsUrl: null,
      profileCreatedAt: null,
      profileCreatedAtType: 'NOT_AVAILABLE',
      firstSeenAt: new Date(),
      lastCheckedAt: new Date(),
    },
    sources: [{ provider: 'google_places', sourceId: `place_${id}`, collectedAt: new Date() }],
    social: [],
    eligibility: { included: true, excludedReason: null },
    ranking: {},
    evidence: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('BusinessEligibilityService (Section 14 & 42: 5-Star Exclusion Boundary)', () => {
  const service = new BusinessEligibilityService();

  it('strictly excludes perfect 5.0 rated businesses', () => {
    const biz5_0 = makeTestBusiness('1', 5.0, 500);
    const result = service.evaluate(biz5_0);

    expect(result.included).toBe(false);
    expect(result.excludedReason).toBe('PERFECT_5_STAR_RATING');
  });

  it('strictly keeps 4.9, 4.8, 4.5, 4.0 rated businesses', () => {
    const biz4_9 = makeTestBusiness('2', 4.9, 300);
    const result4_9 = service.evaluate(biz4_9);
    expect(result4_9.included).toBe(true);
    expect(result4_9.excludedReason).toBeNull();

    const biz4_8 = makeTestBusiness('3', 4.8, 200);
    const result4_8 = service.evaluate(biz4_8);
    expect(result4_8.included).toBe(true);

    const biz4_5 = makeTestBusiness('4', 4.5, 250);
    const result4_5 = service.evaluate(biz4_5);
    expect(result4_5.included).toBe(true);

    const biz4_0 = makeTestBusiness('5', 4.0, 150);
    const result4_0 = service.evaluate(biz4_0);
    expect(result4_0.included).toBe(true);
  });

  it('strictly keeps businesses with null rating (NEVER assume null = 5.0)', () => {
    const bizNull = makeTestBusiness('5', null, null);
    const result = service.evaluate(bizNull);

    expect(result.included).toBe(true);
    expect(result.excludedReason).toBeNull();
  });

  it('correctly partitions eligible and excluded lists without deleting raw records', () => {
    const list = [
      makeTestBusiness('1', 5.0, 100),
      makeTestBusiness('2', 4.7, 450),
      makeTestBusiness('3', 4.9, 80),
      makeTestBusiness('4', null, null),
    ];

    const { eligible, excluded } = service.filterBusinesses(list);

    expect(eligible).toHaveLength(3);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].id).toBe('1');
    expect(excluded[0].eligibility.excludedReason).toBe('PERFECT_5_STAR_RATING');
  });
});
