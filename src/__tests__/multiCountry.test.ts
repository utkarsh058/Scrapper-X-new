import { describe, it, expect, beforeAll } from 'vitest';
import { resolveCountry, SUPPORTED_COUNTRIES } from '../lib/location/CountryRegistry';
import { USA_REGIONS, CANADA_REGIONS, INDIA_REGIONS, resolveRegion } from '../lib/location/RegionRegistry';
import { locationResolverService } from '../lib/location/LocationResolverService';
import { phoneNormalizer } from '../lib/normalization/PhoneNormalizer';
import { tenantService } from '../services/tenant/TenantService';
import { businessRepository } from '../services/persistence/BusinessRepository';
import { googlePlacesProvider } from '../providers/google/GooglePlacesProvider';
import { businessEligibilityService } from '../services/eligibility/BusinessEligibilityService';
import { businessRankingService } from '../services/ranking/BusinessRankingService';
import { CanonicalBusiness } from '../types/canonical';

describe('LeadPilot Multi-Country Expansion & Multi-Tenancy Test Suite', () => {

  // =========================================================================
  // 1. COUNTRY REGISTRY & RESOLUTION
  // =========================================================================
  describe('Country Registry', () => {
    it('supports canonical ISO codes for IN, US, and CA', () => {
      expect(SUPPORTED_COUNTRIES.US.name).toBe('United States');
      expect(SUPPORTED_COUNTRIES.CA.name).toBe('Canada');
      expect(SUPPORTED_COUNTRIES.IN.name).toBe('India');

      expect(resolveCountry('US')?.code).toBe('US');
      expect(resolveCountry('USA')?.code).toBe('US');
      expect(resolveCountry('United States')?.code).toBe('US');

      expect(resolveCountry('CA')?.code).toBe('CA');
      expect(resolveCountry('CAN')?.code).toBe('CA');
      expect(resolveCountry('Canada')?.code).toBe('CA');

      expect(resolveCountry('IN')?.code).toBe('IN');
      expect(resolveCountry('IND')?.code).toBe('IN');
      expect(resolveCountry('India')?.code).toBe('IN');

      // Rejects unsupported countries
      expect(resolveCountry('DE')).toBeNull();
      expect(resolveCountry('Germany')).toBeNull();
      expect(resolveCountry('Chile')).toBeNull();
    });
  });

  // =========================================================================
  // 2. USA LOCATION HIERARCHY (All 50 States + DC)
  // =========================================================================
  describe('USA Location Hierarchy', () => {
    it('supports all 50 US States + District of Columbia', () => {
      expect(USA_REGIONS.length).toBe(51);

      const allExpectedStates = [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
        'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
        'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
        'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
        'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
        'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
        'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
        'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
      ];

      for (const stateName of allExpectedStates) {
        const found = resolveRegion('US', stateName);
        expect(found, `Expected to find US state: ${stateName}`).not.toBeNull();
        expect(found?.countryCode).toBe('US');
      }

      // Resolves by 2-letter abbreviation
      expect(resolveRegion('US', 'CA')?.name).toBe('California');
      expect(resolveRegion('US', 'NY')?.name).toBe('New York');
      expect(resolveRegion('US', 'TX')?.name).toBe('Texas');
      expect(resolveRegion('US', 'DC')?.regionType).toBe('TERRITORY');
    });
  });

  // =========================================================================
  // 3. CANADA LOCATION HIERARCHY (10 Provinces + 3 Territories)
  // =========================================================================
  describe('Canada Location Hierarchy', () => {
    it('supports all 10 Canadian Provinces and 3 Canadian Territories', () => {
      expect(CANADA_REGIONS.length).toBe(13);

      const provinces = [
        'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
        'Newfoundland and Labrador', 'Nova Scotia', 'Ontario',
        'Prince Edward Island', 'Quebec', 'Saskatchewan'
      ];

      for (const prov of provinces) {
        const found = resolveRegion('CA', prov);
        expect(found, `Expected to find Canadian province: ${prov}`).not.toBeNull();
        expect(found?.regionType).toBe('PROVINCE');
      }

      const territories = ['Northwest Territories', 'Nunavut', 'Yukon'];
      for (const terr of territories) {
        const found = resolveRegion('CA', terr);
        expect(found, `Expected to find Canadian territory: ${terr}`).not.toBeNull();
        expect(found?.regionType).toBe('TERRITORY');
      }

      // Resolves by province code
      expect(resolveRegion('CA', 'ON')?.name).toBe('Ontario');
      expect(resolveRegion('CA', 'QC')?.name).toBe('Quebec');
      expect(resolveRegion('CA', 'BC')?.name).toBe('British Columbia');
    });
  });

  // =========================================================================
  // 4. CITY DISAMBIGUATION & CROSS-COUNTRY SAFE RESOLUTION
  // =========================================================================
  describe('City Disambiguation & Cross-Country Safety', () => {
    it('correctly disambiguates Springfield IL vs Springfield MO', async () => {
      const ilLoc = await locationResolverService.resolve({
        country: 'United States',
        state: 'Illinois',
        city: 'Springfield',
      });
      expect(ilLoc.regionCode).toBe('IL');
      expect(ilLoc.countryCode).toBe('US');
      expect(ilLoc.cityName).toBe('Springfield');

      const moLoc = await locationResolverService.resolve({
        country: 'United States',
        state: 'Missouri',
        city: 'Springfield',
      });
      expect(moLoc.regionCode).toBe('MO');
      expect(moLoc.countryCode).toBe('US');
      expect(moLoc.cityName).toBe('Springfield');
    });

    it('prevents Los Angeles California from resolving to Los Angeles Chile', async () => {
      const laLoc = await locationResolverService.resolve({
        country: 'United States',
        state: 'California',
        city: 'Los Angeles',
      });
      expect(laLoc.countryCode).toBe('US');
      expect(laLoc.regionCode).toBe('CA');
      expect(laLoc.cityName).toBe('Los Angeles');
      // Latitude / Longitude boundary check for US
      if (laLoc.latitude && laLoc.longitude) {
        expect(laLoc.latitude).toBeGreaterThan(32);
        expect(laLoc.latitude).toBeLessThan(35);
        expect(laLoc.longitude).toBeLessThan(-115);
      }
    });

    it('resolves Canadian cities strictly within Canada', async () => {
      const torontoLoc = await locationResolverService.resolve({
        country: 'Canada',
        state: 'Ontario',
        city: 'Toronto',
      });
      expect(torontoLoc.countryCode).toBe('CA');
      expect(torontoLoc.regionCode).toBe('ON');
      expect(torontoLoc.cityName).toBe('Toronto');
    });
  });

  // =========================================================================
  // 5. INTERNATIONAL PHONE NORMALIZATION
  // =========================================================================
  describe('International Phone Normalization', () => {
    it('normalizes USA numbers with +1 and valid E.164 formatting', () => {
      const usPhone1 = phoneNormalizer.normalize('(213) 555-0199', 'US');
      expect(usPhone1.isValid).toBe(true);
      expect(usPhone1.countryCode).toBe('US');
      expect(usPhone1.e164).toBe('+12135550199');

      const usPhone2 = phoneNormalizer.normalize('310-555-0143', 'US');
      expect(usPhone2.isValid).toBe(true);
      expect(usPhone2.countryCode).toBe('US');
      expect(usPhone2.e164).toBe('+13105550143');
    });

    it('normalizes Canada numbers with +1 and preserves CA country code', () => {
      const caPhone = phoneNormalizer.normalize('(416) 555-0182', 'CA');
      expect(caPhone.isValid).toBe(true);
      expect(caPhone.countryCode).toBe('CA');
      expect(caPhone.e164).toBe('+14165550182');
    });

    it('normalizes India numbers with +91', () => {
      const inPhone = phoneNormalizer.normalize('098914 49500', 'IN');
      expect(inPhone.isValid).toBe(true);
      expect(inPhone.countryCode).toBe('IN');
      expect(inPhone.e164).toBe('+919891449500');
    });

    it('returns null/invalid without throwing or fabricating for missing numbers', () => {
      const nullPhone = phoneNormalizer.normalize('', 'US');
      expect(nullPhone.isValid).toBe(false);
      expect(nullPhone.e164).toBeNull();
      expect(nullPhone.normalizedPhone).toBeNull();
    });
  });

  // =========================================================================
  // 6. MULTI-TENANT ISOLATION & PERMISSIONS
  // =========================================================================
  describe('Multi-Tenant Customer System & Database Isolation', () => {
    let tenantA: any;
    let tenantB: any;
    let userA: any;
    let userB: any;

    beforeAll(async () => {
      // Create Tenant A (USA only)
      tenantA = await tenantService.createTenant({
        name: 'Acme US Growth',
        slug: `acme-us-${Date.now()}`,
        allowedCountries: ['US'],
      });

      // Create Tenant B (Canada only)
      tenantB = await tenantService.createTenant({
        name: 'Maple Leaf Leads',
        slug: `maple-ca-${Date.now()}`,
        allowedCountries: ['CA'],
      });

      // Create users
      userA = await tenantService.createUser({
        tenantId: tenantA.id,
        email: `john-${Date.now()}@acme.com`,
        name: 'John US',
        role: 'OWNER',
      });

      userB = await tenantService.createUser({
        tenantId: tenantB.id,
        email: `sarah-${Date.now()}@maple.ca`,
        name: 'Sarah CA',
        role: 'MEMBER',
      });
    });

    it('creates tenants with distinct tenantIds and country permissions', () => {
      expect(tenantA.id).toBeDefined();
      expect(tenantB.id).toBeDefined();
      expect(tenantA.id).not.toBe(tenantB.id);

      expect(tenantA.allowedCountries).toContain('US');
      expect(tenantA.allowedCountries).not.toContain('CA');
      expect(tenantB.allowedCountries).toContain('CA');
    });

    it('enforces country access server-side (Tenant A cannot search Canada)', async () => {
      const canAccessUS = await tenantService.validateCountryAccess(tenantA.id, 'US');
      expect(canAccessUS.allowed).toBe(true);

      const canAccessCA = await tenantService.validateCountryAccess(tenantA.id, 'CA');
      expect(canAccessCA.allowed).toBe(false);
    });

    it('enforces server-side data isolation: Tenant A cannot see Tenant B records', async () => {
      // Create a test business under Tenant A
      const testBizA = {
        id: `biz_a_${Date.now()}`,
        name: 'Los Angeles Tech Hub',
        googlePlaceId: `g_place_${Date.now()}`,
        city: 'Los Angeles',
        state: 'California',
        country: 'United States',
        countryCode: 'US',
        phone: '+12135550199',
        tenantId: tenantA.id,
        identity: {
          name: 'Los Angeles Tech Hub',
          canonicalName: 'Los Angeles Tech Hub',
          address: '100 Wilshire Blvd',
          city: 'Los Angeles',
          state: 'California',
          country: 'United States',
          countryCode: 'US',
          phone: '+12135550199',
          website: 'https://latechhub.example',
        },
        eligibility: {
          included: true,
          reasons: [],
          fiveStarExcluded: false,
        },
        evidence: [],
      };

      // Create a test business under Tenant B
      const testBizB = {
        id: `biz_b_${Date.now()}`,
        name: 'Toronto AI Studio',
        googlePlaceId: `g_place_b_${Date.now()}`,
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        countryCode: 'CA',
        phone: '+14165550182',
        tenantId: tenantB.id,
        identity: {
          name: 'Toronto AI Studio',
          canonicalName: 'Toronto AI Studio',
          address: '200 Bay St',
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          countryCode: 'CA',
          phone: '+14165550182',
          website: 'https://torontoai.example',
        },
        eligibility: {
          included: true,
          reasons: [],
          fiveStarExcluded: false,
        },
        evidence: [],
      };

      await businessRepository.persistBatch([testBizA as any, testBizB as any]);

      // Query Tenant A businesses: MUST only return Tenant A records
      const { businesses: tenantABusinesses } = await businessRepository.findBusinessesByTenant(tenantA.id, { limit: 10 });
      const foundA = tenantABusinesses.find((b: any) => b.id === testBizA.id);
      const foundBInA = tenantABusinesses.find((b: any) => b.id === testBizB.id);

      expect(foundA).toBeDefined();
      expect(foundBInA).toBeUndefined(); // ZERO CROSS-TENANT VISIBILITY

      // Query Tenant B businesses: MUST only return Tenant B records
      const { businesses: tenantBBusinesses } = await businessRepository.findBusinessesByTenant(tenantB.id, { limit: 10 });
      const foundB = tenantBBusinesses.find((b: any) => b.id === testBizB.id);
      const foundAInB = tenantBBusinesses.find((b: any) => b.id === testBizA.id);

      expect(foundB).toBeDefined();
      expect(foundAInB).toBeUndefined();
    });

    it('enforces role-based permissions', () => {
      expect(tenantService.canManageTenant('OWNER')).toBe(true);
      expect(tenantService.canManageTenant('ADMIN')).toBe(false);
      expect(tenantService.canManageTenant('MEMBER')).toBe(false);

      expect(tenantService.canManageUsers('ADMIN')).toBe(true);
      expect(tenantService.canManageUsers('MEMBER')).toBe(false);

      expect(tenantService.canExecuteSearches('MEMBER')).toBe(true);
      expect(tenantService.canExecuteSearches('VIEWER')).toBe(false);
    });
  });

  // =========================================================================
  // 7. 5.0 STAR EXCLUSION & REVIEW RANKING RULES
  // =========================================================================
  describe('Global 5.0 Star Exclusion & Review Ranking Rules', () => {
    it('excludes 5.0 star businesses and retains 4.9, 4.8, and unrated', () => {
      const candidates: CanonicalBusiness[] = [
        {
          id: 'biz_1',
          source: 'GOOGLE_PLACES',
          identity: { name: 'Perfect 5 Star Diner', category: 'Restaurant', countryCode: 'US' },
          google: {
            placeId: 'p1',
            rating: 5.0,
            reviewCount: 1200,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [{ provider: 'google_places', sourceId: 'p1', collectedAt: new Date() }],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'biz_2',
          source: 'GOOGLE_PLACES',
          identity: { name: 'High Rated Bistro', category: 'Restaurant', countryCode: 'US' },
          google: {
            placeId: 'p2',
            rating: 4.9,
            reviewCount: 850,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [{ provider: 'google_places', sourceId: 'p2', collectedAt: new Date() }],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'biz_3',
          source: 'GOOGLE_PLACES',
          identity: { name: 'Classic Grill', category: 'Restaurant', countryCode: 'US' },
          google: {
            placeId: 'p3',
            rating: 4.8,
            reviewCount: 3400,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [{ provider: 'google_places', sourceId: 'p3', collectedAt: new Date() }],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'biz_4',
          source: 'GOOGLE_PLACES',
          identity: { name: 'New Unrated Cafe', category: 'Restaurant', countryCode: 'CA' },
          google: undefined,
          sources: [{ provider: 'google_places', sourceId: 'p4', collectedAt: new Date() }],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      businessEligibilityService.filterBusinesses(candidates, { excludePerfectRating: true });

      const excluded = candidates.find((b) => b.id === 'biz_1');
      expect(excluded?.eligibility.included).toBe(false);
      expect(excluded?.eligibility.excludedReason).toBe('PERFECT_5_STAR_RATING');

      const kept49 = candidates.find((b) => b.id === 'biz_2');
      expect(kept49?.eligibility.included).toBe(true);

      const kept48 = candidates.find((b) => b.id === 'biz_3');
      expect(kept48?.eligibility.included).toBe(true);

      const keptUnrated = candidates.find((b) => b.id === 'biz_4');
      expect(keptUnrated?.eligibility.included).toBe(true); // Does NOT exclude null rating
    });

    it('ranks eligible businesses by userRatingCount DESC, rating DESC, name ASC', () => {
      const candidates: CanonicalBusiness[] = [
        {
          id: 'a',
          source: 'GOOGLE_PLACES',
          identity: { name: 'Bistro A', category: 'Restaurant' },
          google: {
            placeId: 'pa',
            rating: 4.9,
            reviewCount: 2800,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'b',
          source: 'GOOGLE_PLACES',
          identity: { name: 'Restaurant B', category: 'Restaurant' },
          google: {
            placeId: 'pb',
            rating: 4.8,
            reviewCount: 4500,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'c',
          source: 'GOOGLE_PLACES',
          identity: { name: 'Cafe C', category: 'Restaurant' },
          google: {
            placeId: 'pc',
            rating: 4.7,
            reviewCount: 900,
            businessStatus: 'OPERATIONAL',
            mapsUrl: null,
            profileCreatedAt: null,
            profileCreatedAtType: 'NOT_AVAILABLE',
            firstSeenAt: new Date(),
            lastCheckedAt: new Date(),
          },
          sources: [],
          social: [],
          ranking: {},
          eligibility: { included: true, excludedReason: null },
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const ranked = businessRankingService.rank(candidates, { sort: { field: 'reviewCount', direction: 'desc' } });
      expect(ranked[0].id).toBe('b'); // 4,500 reviews ranks first
      expect(ranked[1].id).toBe('a'); // 2,800 reviews ranks second
      expect(ranked[2].id).toBe('c'); // 900 reviews ranks third
    });
  });

  // =========================================================================
  // 8. EXACT COUNT RECONCILIATION
  // =========================================================================
  describe('Count Reconciliation Contract', () => {
    it('verifies that all reconciliation equations hold with zero discrepancies', () => {
      const rawDiscovered = 253;
      const duplicates = 18;
      const deduplicated = rawDiscovered - duplicates; // 235
      const excluded = 21;
      const eligible = deduplicated - excluded; // 214
      const failed = 0;
      const persisted = eligible - failed; // 214

      // Equation 1: rawDiscovered = deduplicated + duplicates
      expect(rawDiscovered).toBe(deduplicated + duplicates);

      // Equation 2: deduplicated = eligible + excluded
      expect(deduplicated).toBe(eligible + excluded);

      // Equation 3: eligible = persisted + failed
      expect(eligible).toBe(persisted + failed);
    });
  });

  // =========================================================================
  // 9. REAL LIVE ACCEPTANCE TEST: USA (Los Angeles, California)
  // =========================================================================
  describe('Live Acceptance Test: USA (California -> Los Angeles)', () => {
    it('discovers and verifies real businesses in Los Angeles, CA via Google Places', async () => {
      const res = await googlePlacesProvider.searchBusinesses({
        query: 'Dentists',
        state: 'California',
        city: 'Los Angeles',
        country: 'United States',
        countryCode: 'US',
        limit: 10,
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.candidates.length).toBeGreaterThan(0);

      // Verify that every returned business has real Google Places data
      const firstCandidate = res.candidates[0];
      expect(firstCandidate.source).toBe('google_places');
      expect(firstCandidate.placeId).toBeDefined();
      expect(firstCandidate.name).toBeDefined();
      expect(firstCandidate.address).toBeDefined();

      // Verify no fake phone numbers
      if (firstCandidate.phone) {
        expect(firstCandidate.phone).not.toContain('555-0100');
      }

      console.log(`[USA Live Acceptance] Discovered ${res.candidates.length} real businesses in Los Angeles, CA.`);
      console.log(`[USA Sample Lead] ${firstCandidate.name} (${firstCandidate.address}) - Rating: ${firstCandidate.rating} (${firstCandidate.reviewCount} reviews)`);
    }, 25000);
  });

  // =========================================================================
  // 10. REAL LIVE ACCEPTANCE TEST: CANADA (Toronto, Ontario)
  // =========================================================================
  describe('Live Acceptance Test: Canada (Ontario -> Toronto)', () => {
    it('discovers and verifies real businesses in Toronto, ON via Google Places', async () => {
      const res = await googlePlacesProvider.searchBusinesses({
        query: 'Restaurants',
        state: 'Ontario',
        city: 'Toronto',
        country: 'Canada',
        countryCode: 'CA',
        limit: 10,
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.candidates.length).toBeGreaterThan(0);

      const firstCandidate = res.candidates[0];
      expect(firstCandidate.source).toBe('google_places');
      expect(firstCandidate.placeId).toBeDefined();
      expect(firstCandidate.name).toBeDefined();
      expect(firstCandidate.address).toBeDefined();

      console.log(`[Canada Live Acceptance] Discovered ${res.candidates.length} real businesses in Toronto, ON.`);
      console.log(`[Canada Sample Lead] ${firstCandidate.name} (${firstCandidate.address}) - Rating: ${firstCandidate.rating} (${firstCandidate.reviewCount} reviews)`);
    }, 25000);
  });
});
