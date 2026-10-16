import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { outscraperDiscoveryProvider, OutscraperDiscoveryProvider } from '@/providers/OutscraperDiscoveryProvider';
import { googlePlacesDiscoveryProvider, GooglePlacesDiscoveryProvider } from '@/providers/GooglePlacesDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { providerManager } from '@/lib/providers/ProviderManager';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { locationVerificationActor } from '@/actors/LocationVerificationActor';
import { businessVerificationActor } from '@/actors/BusinessVerificationActor';
import { deduplicationActor } from '@/actors/DeduplicationActor';
import { classifyCandidateWebsite } from '@/lib/audit/WebsiteStatusClassifier';
import { evaluateContactFilter } from '@/lib/providers/contactTypes';
import { RawDiscoveredBusiness } from '@/providers/BusinessDiscoveryProvider';
import { outscraperCircuitBreaker, googlePlacesCircuitBreaker, osmCircuitBreaker } from '@/lib/resilience/CircuitBreaker';
import { clearOverpassCache } from '@/lib/overpassClient';

function createJsonResponse(data: any, status = 200, ok = true) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => body,
    json: async () => JSON.parse(body),
  } as any;
}

describe('Outscraper Primary Discovery & Modular Google Places Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PRIMARY_DISCOVERY_PROVIDER = 'outscraper';
    process.env.OUTSCRAPER_API_KEY = 'test_outscraper_api_key_valid_123';
    process.env.OUTSCRAPER_ENABLED = 'true';
    process.env.GOOGLE_PLACES_ENABLED = 'false';
    process.env.GOOGLE_PLACES_API_KEY = '';

    OutscraperDiscoveryProvider.setSimulateTimeout(false);
    OutscraperDiscoveryProvider.setSimulateQuotaExceeded(false);
    OutscraperDiscoveryProvider.setSimulateAuthFailed(false);
    OutscraperDiscoveryProvider.setSimulateResults(null);

    GooglePlacesDiscoveryProvider.setSimulateTimeout(false);
    GooglePlacesDiscoveryProvider.setSimulateQuotaExceeded(false);
    GooglePlacesDiscoveryProvider.setSimulateResults(null);

    outscraperCircuitBreaker.reset();
    googlePlacesCircuitBreaker.reset();
    osmCircuitBreaker.reset();
    clearOverpassCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    OutscraperDiscoveryProvider.setSimulateTimeout(false);
    OutscraperDiscoveryProvider.setSimulateQuotaExceeded(false);
    OutscraperDiscoveryProvider.setSimulateAuthFailed(false);
    OutscraperDiscoveryProvider.setSimulateResults(null);

    GooglePlacesDiscoveryProvider.setSimulateTimeout(false);
    GooglePlacesDiscoveryProvider.setSimulateQuotaExceeded(false);
    GooglePlacesDiscoveryProvider.setSimulateResults(null);

    outscraperCircuitBreaker.reset();
    googlePlacesCircuitBreaker.reset();
    osmCircuitBreaker.reset();
    clearOverpassCache();
  });

  // 1. Normalization of Outscraper items into canonical RawDiscoveredBusiness
  it('1. Correctly normalizes raw Outscraper payload into canonical RawDiscoveredBusiness schema', () => {
    const rawOutscraperItem = {
      name: 'Delhi Plumbing & Sanitary Emporium',
      full_address: '124 Connaught Place, Block B, New Delhi, Delhi 110001, India',
      phone: '+91 98110 12345',
      site: 'https://www.delhiplumbing.com/services?ref=maps',
      type: 'Plumber',
      subtypes: ['Plumbing supply store', 'Drainage service', 'Emergency plumber'],
      rating: 4.7,
      reviews: 182,
      latitude: 28.6315,
      longitude: 77.2167,
      place_id: 'ChIJ1029384756abcdef',
      google_id: '0x390cfd37b077f',
      city: 'New Delhi',
      state: 'Delhi',
      postal_code: '110001',
      business_status: 'OPERATIONAL',
      email: 'info@delhiplumbing.com',
    };

    const normalized = outscraperDiscoveryProvider.mapOutscraperItemToBusiness(rawOutscraperItem, {
      industry: 'Plumbers',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      limit: 10,
    });

    expect(normalized.source).toBe('outscraper');
    expect(normalized.sources).toContain('outscraper');
    expect(normalized.name).toBe('Delhi Plumbing & Sanitary Emporium');
    expect(normalized.address).toContain('124 Connaught Place');
    expect(normalized.phone).toBe('+91 98110 12345'); // Correctly formatted phone
    expect(normalized.website).toBe('https://www.delhiplumbing.com/services?ref=maps');
    expect(normalized.rating).toBe(4.7);
    expect(normalized.userRatingCount).toBe(182);
    expect(normalized.latitude).toBeCloseTo(28.6315);
    expect(normalized.longitude).toBeCloseTo(77.2167);
    expect(normalized.googlePlaceId).toBe('ChIJ1029384756abcdef');
    expect(normalized.category).toBe('Plumber');
    expect(normalized.types).toContain('Plumbing supply store');
    expect(normalized.email).toBe('info@delhiplumbing.com');
  });

  // 2. Outscraper as Primary Discovery Provider via ProviderManager
  it('2. ProviderManager prioritizes Outscraper when PRIMARY_DISCOVERY_PROVIDER=outscraper', async () => {
    const mockOutscraperResults: RawDiscoveredBusiness[] = [
      {
        source: 'outscraper',
        sources: ['outscraper'],
        sourceId: 'outscraper_test_1',
        name: 'Prime Plumbers Noida',
        category: 'Plumber',
        address: 'Sector 18, Noida, Uttar Pradesh, India',
        city: 'Noida',
        state: 'Uttar Pradesh',
        phone: '+91 98765 43210',
        website: 'https://primeplumbers.in',
        confidence: 'HIGH',
      },
    ];

    OutscraperDiscoveryProvider.setSimulateResults(mockOutscraperResults);

    let googlePlacesCalled = false;
    const originalFetch = global.fetch;
    global.fetch = async (url: any, init?: any) => {
      if (String(url).includes('places.googleapis.com')) {
        googlePlacesCalled = true;
      }
      return originalFetch(url, init);
    };

    try {
      const result = await providerManager.executeDiscovery({
        industry: 'Plumbers',
        city: 'Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        limit: 10,
      });

      expect(result.primaryProvider).toBe('outscraper');
      expect(result.providers.outscraper?.status).toBe('SUCCESS');
      expect(result.providers.outscraper?.rawCount).toBe(1);
      expect(result.businesses[0].sources).toContain('outscraper');
      expect(result.businesses.length).toBeGreaterThan(0);
      expect(result.businesses[0].name).toBe('Prime Plumbers Noida');

      // Crucial: Google Places was NOT called while disabled
      expect(googlePlacesCalled).toBe(false);
      expect(result.providers.googlePlaces.status).toBe('DISABLED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 3. Google Places is DISABLED and makes ZERO requests when GOOGLE_PLACES_ENABLED=false
  it('3. Google Places returns DISABLED with 0 network calls when GOOGLE_PLACES_ENABLED=false', async () => {
    process.env.GOOGLE_PLACES_ENABLED = 'false';
    process.env.GOOGLE_PLACES_API_KEY = 'valid_looking_key_that_should_not_be_used';

    let fetchAttempted = false;
    const originalFetch = global.fetch;
    global.fetch = async (url: any, init?: any) => {
      if (String(url).includes('places.googleapis.com')) {
        fetchAttempted = true;
      }
      return originalFetch(url, init);
    };

    try {
      const res = await googlePlacesDiscoveryProvider.discoverBusinesses({
        industry: 'Dentists',
        city: 'Bangalore',
        state: 'Karnataka',
        limit: 10,
      });

      expect(fetchAttempted).toBe(false);
      expect(res.status).toBe('DISABLED');
      expect(res.rawCount).toBe(0);
      expect(res.statusReason).toContain('disabled');
      expect(res.errors[0]).toBe('GOOGLE_PLACES_DISABLED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 4. Missing or invalid Google Places API key does NOT break Outscraper discovery
  it('4. Outscraper discovery succeeds when Google Places API key is missing or invalid', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    process.env.GOOGLE_PLACES_ENABLED = 'false';

    const mockBusinesses: RawDiscoveredBusiness[] = [
      {
        source: 'outscraper',
        sources: ['outscraper'],
        sourceId: 'outscraper_ind_101',
        name: 'Apex Dental Care',
        category: 'Dentist',
        address: 'MG Road, Bangalore, Karnataka, India',
        city: 'Bangalore',
        state: 'Karnataka',
        phone: '+91 80123 45678',
        confidence: 'HIGH',
      },
    ];

    OutscraperDiscoveryProvider.setSimulateResults(mockBusinesses);

    const result = await providerManager.executeDiscovery({
      industry: 'Dentists',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      limit: 10,
    });

    expect(result.primaryProvider).toBe('outscraper');
    expect(result.providers.outscraper?.status).toBe('SUCCESS');
    expect(result.businesses[0].name).toBe('Apex Dental Care');
    expect(result.providers.googlePlaces.status).toBe('DISABLED');
  });

  // 5. Outscraper fallback to OSM Overpass when Outscraper encounters failure
  it('5. ProviderManager seamlessly falls back to OSM Overpass when Outscraper fails', async () => {
    OutscraperDiscoveryProvider.setSimulateTimeout(true);

    const originalFetch = global.fetch;
    global.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('overpass') || urlStr.includes('interpreter')) {
        return createJsonResponse({
          elements: [
            {
              type: 'node',
              id: 987654,
              lat: 19.076,
              lon: 72.8777,
              tags: {
                name: 'Mumbai Emergency Plumber',
                craft: 'plumber',
                'addr:city': 'Mumbai',
                phone: '+919988776655',
              },
            },
          ],
        });
      }
      return originalFetch(url, init);
    };

    try {
      const result = await providerManager.executeDiscovery({
        industry: 'Plumbers',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        limit: 10,
      });

      expect(result.providers.outscraper?.status).toBe('FAILED');
      expect(['SUCCESS', 'PARTIAL']).toContain(result.providers.osm.status);
      expect(result.businesses[0].sources).toContain('openstreetmap');
      expect(result.businesses.some((b) => b.name === 'Mumbai Emergency Plumber')).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 6. Dynamic provider switching when PRIMARY_DISCOVERY_PROVIDER='google_places'
  it('6. ProviderManager switches to Google Places when PRIMARY_DISCOVERY_PROVIDER=google_places and enabled', async () => {
    process.env.PRIMARY_DISCOVERY_PROVIDER = 'google_places';
    process.env.GOOGLE_PLACES_ENABLED = 'true';
    process.env.GOOGLE_PLACES_API_KEY = 'valid_test_key_google_abc';

    // Provide mock venues
    const mockGoogleVenues: RawDiscoveredBusiness[] = Array.from({ length: 5 }, (_, i) => ({
      source: 'google_places',
      sources: ['google_places'],
      sourceId: `ChIJ_google_primary_test_${i}`,
      name: `Metro Dental Clinic ${i + 1}`,
      category: 'Dentist',
      address: 'Connaught Place, New Delhi, India',
      city: 'New Delhi',
      state: 'Delhi',
      confidence: 'HIGH',
    }));

    GooglePlacesDiscoveryProvider.setSimulateResults(mockGoogleVenues);

    const result = await providerManager.executeDiscovery({
      industry: 'Dentists',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      limit: 5,
    });

    expect(result.primaryProvider).toBe('google_places');
    expect(['SUCCESS', 'PARTIAL']).toContain(result.providers.googlePlaces.status);
    expect(result.businesses[0].name).toBe('Metro Dental Clinic 1');
  });

  // 7. Downstream qualification, deduplication and merging remain provider-agnostic
  it('7. Downstream merge and deduplication operate seamlessly on Outscraper-sourced businesses', async () => {
    const rawOutscraperBusinesses: RawDiscoveredBusiness[] = [
      {
        source: 'outscraper',
        sources: ['outscraper'],
        sourceId: 'place_abc_1',
        name: 'Urban Fix Plumbing',
        businessName: 'Urban Fix Plumbing',
        category: 'Plumber',
        address: 'Shop 12, Sector 15, Gurgaon, Haryana, India',
        city: 'Gurgaon',
        state: 'Haryana',
        latitude: 28.4595,
        longitude: 77.0266,
        phone: '+91 98100 11223',
        website: 'https://urbanfix.in',
        confidence: 'HIGH',
        googlePlaceId: 'ChIJ_shared_place_id',
        rawTags: {},
      },
      {
        source: 'outscraper',
        sources: ['outscraper'],
        sourceId: 'place_abc_2_dup',
        name: 'Urban Fix Plumbing Pvt Ltd',
        businessName: 'Urban Fix Plumbing Pvt Ltd',
        category: 'Plumber',
        address: 'Shop 12, Sector 15, Gurgaon, Haryana',
        city: 'Gurgaon',
        state: 'Haryana',
        latitude: 28.4596,
        longitude: 77.0267,
        phone: '+91 98100 11223',
        website: 'https://urbanfix.in',
        confidence: 'HIGH',
        googlePlaceId: 'ChIJ_shared_place_id',
        rawTags: {},
      },
    ];

    const mergeResult = await multiSourceMergeActor.execute({
      jobId: 'test_outscraper_merge',
      input: rawOutscraperBusinesses,
    });

    // Cross-deduplication should merge identical phone/place ID into 1
    expect(mergeResult.data.deduplicatedCount).toBe(1);
    expect(mergeResult.data.merged).toHaveLength(1);
    expect(mergeResult.data.merged[0].sources).toContain('outscraper');
    expect(mergeResult.data.merged[0].phone).toBe('+91 98100 11223');
  });

  // 8. Contact & Website filters work identically for Outscraper candidates
  it('8. Website and contact qualification filters evaluate Outscraper candidates accurately', () => {
    const workingClassification = classifyCandidateWebsite(
      'https://modernsalons.com',
      'WORKING',
      {
        url: 'https://modernsalons.com',
        isReachable: true,
        statusCode: 200,
        responseTimeMs: 180,
        isHttps: true,
        flaws: [],
      }
    );
    expect(workingClassification.matchesFilter).toBe(true);
    expect(workingClassification.status).toBe('Working');

    const noWebClassification = classifyCandidateWebsite(undefined, 'NO_WEBSITE');
    expect(noWebClassification.matchesFilter).toBe(true);
    expect(noWebClassification.status).toBe('No Website');

    // Contact filtering
    const contactQualityNone = {
      level: 'NONE' as const,
      hasPhone: false,
      hasEmail: false,
      hasVerifiedPhone: false,
      hasVerifiedEmail: false,
      hasContact: false,
      hasVerifiedContact: false,
      phoneCount: 0,
      emailCount: 0,
      verifiedPhoneCount: 0,
      verifiedEmailCount: 0,
      explanation: 'No contact details found',
    };
    const contactQualityPhone = {
      level: 'LOW' as const,
      hasPhone: true,
      hasEmail: false,
      hasVerifiedPhone: false,
      hasVerifiedEmail: false,
      hasContact: true,
      hasVerifiedContact: false,
      phoneCount: 1,
      emailCount: 0,
      verifiedPhoneCount: 0,
      verifiedEmailCount: 0,
      explanation: 'Phone available',
    };

    expect(evaluateContactFilter('ALL_CONTACTS', contactQualityNone).match).toBe(true);
    expect(evaluateContactFilter('PHONE_OR_EMAIL', contactQualityNone).match).toBe(false);
    expect(evaluateContactFilter('PHONE_OR_EMAIL', contactQualityPhone).match).toBe(true);
  });

  // 9. Provider health check reports Outscraper as primary and Google Places as disabled
  it('9. ProviderHealthService accurately reports Outscraper ready and Google Places disabled', () => {
    const health = providerHealthService.checkHealth();

    expect(health.outscraper).toBeDefined();
    expect(health.outscraper.configured).toBe(true);
    expect(health.outscraper.enabled).toBe(true);
    expect(health.outscraper.healthy).toBe(true);

    expect(health.googlePlaces.enabled).toBe(false);
    expect(health.googlePlaces.reason).toBe('CONFIGURATION_ERROR');
    expect(health.googlePlaces.message).toContain('disabled');
  });
});
