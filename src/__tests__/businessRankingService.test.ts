import { describe, it, expect } from 'vitest';
import { BusinessRankingService } from '@/services/ranking/BusinessRankingService';
import { CanonicalBusiness } from '@/types/canonical';

function makeRankCandidate(
  id: string,
  name: string,
  reviewCount: number | null,
  rating: number | null,
  included: boolean = true
): CanonicalBusiness {
  return {
    id,
    source: 'GOOGLE_PLACES',
    identity: { name, category: 'Restaurant', city: 'Greater Noida', state: 'Uttar Pradesh' },
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
    eligibility: { included, excludedReason: included ? null : 'PERFECT_5_STAR_RATING' },
    ranking: {},
    evidence: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('BusinessRankingService (Section 15, 35, 42: Deterministic Ranking Boundary)', () => {
  const rankingService = new BusinessRankingService();

  it('ranks businesses by reviewCount DESC then rating DESC (2000 -> 1000 -> 500)', () => {
    const b500 = makeRankCandidate('b500', 'Cafe 500', 500, 4.8);
    const b2000 = makeRankCandidate('b2000', 'Bistro 2000', 2000, 4.6);
    const b1000 = makeRankCandidate('b1000', 'Diner 1000', 1000, 4.7);

    const ranked = rankingService.rank([b500, b2000, b1000]);

    expect(ranked[0].id).toBe('b2000');
    expect(ranked[1].id).toBe('b1000');
    expect(ranked[2].id).toBe('b500');

    expect(ranked[0].ranking.overallRank).toBe(1);
    expect(ranked[1].ranking.overallRank).toBe(2);
    expect(ranked[2].ranking.overallRank).toBe(3);
  });

  it('breaks ties in reviewCount using rating DESC', () => {
    const bTieA = makeRankCandidate('tieA', 'Alpha Food', 500, 4.4);
    const bTieB = makeRankCandidate('tieB', 'Beta Food', 500, 4.8);

    const ranked = rankingService.rank([bTieA, bTieB]);

    expect(ranked[0].id).toBe('tieB'); // 4.8 > 4.4
    expect(ranked[1].id).toBe('tieA');
  });

  it('places ineligible/excluded businesses at the end of the ranked list', () => {
    const eligible1 = makeRankCandidate('e1', 'Good Eatery', 800, 4.5, true);
    const excluded5Star = makeRankCandidate('ex5', 'Fake 5-Star Diner', 3000, 5.0, false);
    const eligible2 = makeRankCandidate('e2', 'Modest Eatery', 400, 4.2, true);

    const ranked = rankingService.rank([eligible1, excluded5Star, eligible2]);

    expect(ranked[0].id).toBe('e1');
    expect(ranked[1].id).toBe('e2');
    expect(ranked[2].id).toBe('ex5'); // excluded placed last despite higher review count
  });
});
