import { NextResponse } from 'next/server';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { secondaryBusinessDataProvider, SecondaryBusinessDataProvider } from '@/providers/SecondaryBusinessDataProvider';
import { webSearchDiscoveryProvider, WebSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { GooglePlacesDiscoveryProvider } from '@/providers/GooglePlacesDiscoveryProvider';
import { providerManager } from '@/lib/providers/ProviderManager';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';

export async function GET() {
  const results: any = {};

  // --- TEST E: Simulate Business Provider Failure ---
  try {
    SecondaryBusinessDataProvider.setSimulateFailure(true);

    const bpRes = await secondaryBusinessDataProvider.discoverBusinesses({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      limit: 50,
    });

    const osmRes = await osmOverpassProvider.discoverBusinesses({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      limit: 50,
    });

    SecondaryBusinessDataProvider.setSimulateFailure(false);

    const testEPassed = bpRes.status === 'FAILED' && bpRes.rawCount === 0 && osmRes.status === 'COMPLETE' && osmRes.rawCount > 0;
    results.testE = {
      passed: testEPassed,
      bpStatus: bpRes.status,
      bpRawCount: bpRes.rawCount,
      osmStatus: osmRes.status,
      osmRawCount: osmRes.rawCount,
    };
  } catch (err: any) {
    SecondaryBusinessDataProvider.setSimulateFailure(false);
    results.testE = { passed: false, error: err.message };
  }

  // --- TEST F: Simulate Web Search Failure ---
  try {
    WebSearchDiscoveryProvider.setSimulateFailure(true);

    const webRes = await webSearchDiscoveryProvider.discoverBusinesses({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      limit: 50,
    });

    const osmRes = await osmOverpassProvider.discoverBusinesses({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      limit: 50,
    });

    WebSearchDiscoveryProvider.setSimulateFailure(false);

    const testFPassed = webRes.status === 'FAILED' && osmRes.status === 'COMPLETE' && osmRes.rawCount > 0;
    results.testF = {
      passed: testFPassed,
      webStatus: webRes.status,
      webRawCount: webRes.rawCount,
      osmStatus: osmRes.status,
      osmRawCount: osmRes.rawCount,
    };
  } catch (err: any) {
    WebSearchDiscoveryProvider.setSimulateFailure(false);
    results.testF = { passed: false, error: err.message };
  }

  // --- TEST G: Duplicate same business from OSM + Web + Business Provider ---
  try {
    const candidate1 = {
      source: 'osm',
      sources: ['osm'],
      sourceId: 'osm:node:101',
      name: 'The Golden Spoon Restaurant',
      businessName: 'The Golden Spoon Restaurant',
      category: 'Restaurant',
      address: 'Plot 4, Knowledge Park 3, Greater Noida',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      latitude: 28.4721,
      longitude: 77.4891,
      phone: undefined,
      email: undefined,
      website: undefined,
      rawTags: { osmId: '101' },
    };

    const candidate2 = {
      source: 'web_search',
      sources: ['web_search'],
      sourceId: 'web:golden_spoon',
      name: 'Golden Spoon Restaurant',
      businessName: 'Golden Spoon Restaurant',
      category: 'Restaurant',
      address: 'Knowledge Park III, Greater Noida, UP',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      latitude: 28.4722,
      longitude: 77.4892,
      phone: '+91 98111 22334',
      email: 'contact@goldenspoon.com',
      website: 'https://goldenspoonrestaurant.com',
      rawTags: { source: 'web' },
    };

    const candidate3 = {
      source: 'business_provider',
      sources: ['business_provider'],
      sourceId: 'bp:place_999',
      name: 'The Golden Spoon',
      businessName: 'The Golden Spoon',
      category: 'Restaurant',
      address: 'Plot 4, Knowledge Park 3, Greater Noida, Uttar Pradesh',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      latitude: 28.4721,
      longitude: 77.4891,
      phone: '+91 98111 22334',
      email: undefined,
      website: 'https://goldenspoonrestaurant.com',
      rawTags: { placeId: '999' },
    };

    const mergeResult = await multiSourceMergeActor.execute({
      jobId: 'test_job_g',
      input: [candidate1, candidate2, candidate3],
    });

    const merged = mergeResult.data.merged;
    const isSingleMerged = merged.length === 1;
    const hasAllSources = ['osm', 'web_search', 'business_provider'].every((s) => merged[0]?.sources?.includes(s));
    const isEnriched = Boolean(merged[0]?.phone && merged[0]?.email && merged[0]?.website);

    results.testG = {
      passed: isSingleMerged && hasAllSources && isEnriched,
      mergedCount: merged.length,
      mergedSources: merged[0]?.sources,
      phone: merged[0]?.phone,
      email: merged[0]?.email,
      website: merged[0]?.website,
    };
  } catch (err: any) {
    results.testG = { passed: false, error: err.message };
  }

  // --- TEST H: Provider Health Service ---
  try {
    const health = providerHealthService.checkHealth();
    results.testH_ProviderHealth = {
      passed: typeof health.googlePlaces.configured === 'boolean' && health.osm.healthy === true,
      googlePlaces: health.googlePlaces,
      osm: health.osm,
    };
  } catch (err: any) {
    results.testH_ProviderHealth = { passed: false, error: err.message };
  }

  // --- TEST I: Simulate Google Places Timeout with OSM Fallback ---
  const prevKey = process.env.GOOGLE_PLACES_API_KEY;
  try {
    process.env.GOOGLE_PLACES_API_KEY = 'simulated_test_key_for_timeout';
    GooglePlacesDiscoveryProvider.setSimulateTimeout(true);

    const failDiscovery = await providerManager.executeDiscovery({
      industry: 'Restaurants',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 25,
    });

    GooglePlacesDiscoveryProvider.setSimulateTimeout(false);
    process.env.GOOGLE_PLACES_API_KEY = prevKey;

    const testIPassed =
      failDiscovery.providers.googlePlaces.status === 'PROVIDER_FAILURE' &&
      failDiscovery.providers.osm.status === 'COMPLETE' &&
      failDiscovery.businesses.length > 0;

    results.testI_GoogleTimeoutFallback = {
      passed: testIPassed,
      googlePlacesStatus: failDiscovery.providers.googlePlaces.status,
      osmStatus: failDiscovery.providers.osm.status,
      candidatesDelivered: failDiscovery.businesses.length,
      overallStatus: failDiscovery.overallStatus,
      durationMs: failDiscovery.latencies.totalMs,
    };
  } catch (err: any) {
    GooglePlacesDiscoveryProvider.setSimulateTimeout(false);
    results.testI_GoogleTimeoutFallback = { passed: false, error: err.message };
  }

  // --- TEST J: Smart Rotation & Contact History Prioritization ---
  try {
    const { smartRotationService } = await import('@/lib/workflow/SmartRotationService');
    const { leadHistoryService } = await import('@/lib/workflow/LeadHistoryService');

    const fakeLeadA = {
      leadId: 'test_lead_a',
      businessName: 'Alpha Bistro',
      category: 'Restaurant',
      address: 'Noida',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      phone: '+91 99999 11111',
      googlePlaceId: 'place_alpha',
      websiteStatus: 'Working',
      https: true,
      socialLinks: {},
      contacts: [],
      businessVerificationStatus: 'VERIFIED' as const,
      locationVerificationStatus: 'VERIFIED' as const,
      auditIssues: [],
      scoreBreakdown: [],
      leadScore: 80,
      sources: ['test'],
      sourceEvidence: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fakeLeadB = {
      ...fakeLeadA,
      leadId: 'test_lead_b',
      businessName: 'Beta Diner',
      phone: '+91 99999 22222',
      googlePlaceId: 'place_beta',
    };

    // Mark Alpha Bistro as contacted
    leadHistoryService.recordContactAction({
      placeId: 'place_alpha',
      action: 'CALL_ATTEMPTED',
      channel: 'phone',
    });

    const rot = smartRotationService.rotateCandidates(
      [fakeLeadA, fakeLeadB],
      2,
      'test_fingerprint'
    );

    // Beta Diner should be first because Alpha was contacted!
    const testJPassed = rot.orderedLeads[0].businessName === 'Beta Diner' && rot.orderedLeads[1].businessName === 'Alpha Bistro';
    results.testJ_SmartRotation = {
      passed: testJPassed,
      firstDelivered: rot.orderedLeads[0]?.businessName,
      secondDelivered: rot.orderedLeads[1]?.businessName,
      stats: rot.stats,
    };
  } catch (err: any) {
    results.testJ_SmartRotation = { passed: false, error: err.message };
  }

  // --- TEST K: In-Flight Concurrent Request Deduplication ---
  try {
    const { jobManager } = await import('@/jobs/JobManager');
    const payload = {
      industry: 'Hotels',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 10,
    };

    const [j1, j2] = await Promise.all([
      jobManager.executeJobSync(payload as any),
      jobManager.executeJobSync(payload as any),
    ]);

    const testKPassed = j1.id === j2.id && j1.leads !== undefined;
    results.testK_InFlightDeduplication = {
      passed: testKPassed,
      job1Id: j1.id,
      job2Id: j2.id,
      sameJobAttached: j1.id === j2.id,
    };
  } catch (err: any) {
    results.testK_InFlightDeduplication = { passed: false, error: err.message };
  }

  // --- TEST L: Google Quota Exceeded with OSM Fallback ---
  const keyBackup = process.env.GOOGLE_PLACES_API_KEY;
  try {
    process.env.GOOGLE_PLACES_API_KEY = 'test_quota_key';
    GooglePlacesDiscoveryProvider.setSimulateQuotaExceeded(true);

    const quotaDiscovery = await providerManager.executeDiscovery({
      industry: 'Restaurants',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 25,
    });

    GooglePlacesDiscoveryProvider.setSimulateQuotaExceeded(false);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;

    const testLPassed =
      quotaDiscovery.providers.googlePlaces.status === 'PROVIDER_FAILURE' &&
      quotaDiscovery.providers.osm.status === 'COMPLETE' &&
      quotaDiscovery.businesses.length > 0;

    results.testL_GoogleQuotaFallback = {
      passed: testLPassed,
      googlePlacesStatus: quotaDiscovery.providers.googlePlaces.status,
      osmStatus: quotaDiscovery.providers.osm.status,
      candidatesDelivered: quotaDiscovery.businesses.length,
    };
  } catch (err: any) {
    GooglePlacesDiscoveryProvider.setSimulateQuotaExceeded(false);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;
    results.testL_GoogleQuotaFallback = { passed: false, error: err.message };
  }

  // --- TEST M: Google Returns Sufficient Candidates -> OSM NOT CALLED ---
  try {
    process.env.GOOGLE_PLACES_API_KEY = 'test_sufficient_key';
    const fakeGoogle50 = Array.from({ length: 50 }, (_, i) => ({
      source: 'google_places',
      sources: ['google_places'],
      sourceId: `google_chij_${i}`,
      name: `Grand Palace ${i}`,
      businessName: `Grand Palace ${i}`,
      category: 'Restaurant',
      address: `Sector ${10 + (i % 50)}, Noida, Uttar Pradesh`,
      city: 'Noida',
      state: 'Uttar Pradesh',
      phone: `+91 98111 ${10000 + i}`,
      website: `https://grandpalace${i}.com`,
      latitude: 28.5355 + i * 0.001,
      longitude: 77.391 + i * 0.001,
      rawTags: { placeId: `chij_${i}` },
    }));

    GooglePlacesDiscoveryProvider.setSimulateResults(fakeGoogle50);

    const sufficientDiscovery = await providerManager.executeDiscovery({
      industry: 'Restaurants',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 50,
    });

    GooglePlacesDiscoveryProvider.setSimulateResults(null);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;

    const testMPassed =
      sufficientDiscovery.providers.googlePlaces.status === 'COMPLETE' &&
      sufficientDiscovery.providers.googlePlaces.rawCount === 50 &&
      sufficientDiscovery.providers.osm.status === 'NOT_NEEDED' &&
      sufficientDiscovery.providers.osm.rawCount === 0;

    results.testM_GoogleSufficientOsmNotCalled = {
      passed: testMPassed,
      googleRawCount: sufficientDiscovery.providers.googlePlaces.rawCount,
      osmStatus: sufficientDiscovery.providers.osm.status,
      osmRawCount: sufficientDiscovery.providers.osm.rawCount,
      totalDelivered: sufficientDiscovery.businesses.length,
    };
  } catch (err: any) {
    GooglePlacesDiscoveryProvider.setSimulateResults(null);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;
    results.testM_GoogleSufficientOsmNotCalled = { passed: false, error: err.message };
  }

  // --- TEST N: Google Returns 20 of 50 -> Google + OSM Supplemental Discovery ---
  try {
    process.env.GOOGLE_PLACES_API_KEY = 'test_partial_key';
    const fakeGoogle20 = Array.from({ length: 20 }, (_, i) => ({
      source: 'google_places',
      sources: ['google_places'],
      sourceId: `google_partial_${i}`,
      name: `Boutique Dine ${i}`,
      businessName: `Boutique Dine ${i}`,
      category: 'Restaurant',
      address: `Sector ${20 + i}, Noida, Uttar Pradesh`,
      city: 'Noida',
      state: 'Uttar Pradesh',
      phone: `+91 99111 ${20000 + i}`,
      latitude: 28.54 + i * 0.001,
      longitude: 77.38 + i * 0.001,
      rawTags: { placeId: `partial_${i}` },
    }));

    GooglePlacesDiscoveryProvider.setSimulateResults(fakeGoogle20);

    const partialDiscovery = await providerManager.executeDiscovery({
      industry: 'Restaurants',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 50,
    });

    GooglePlacesDiscoveryProvider.setSimulateResults(null);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;

    const testNPassed =
      partialDiscovery.providers.googlePlaces.rawCount === 20 &&
      partialDiscovery.providers.osm.status === 'COMPLETE' &&
      partialDiscovery.businesses.length > 20;

    results.testN_GooglePlusOsmSupplemental = {
      passed: testNPassed,
      googleRawCount: partialDiscovery.providers.googlePlaces.rawCount,
      osmStatus: partialDiscovery.providers.osm.status,
      osmRawCount: partialDiscovery.providers.osm.rawCount,
      totalDelivered: partialDiscovery.businesses.length,
    };
  } catch (err: any) {
    GooglePlacesDiscoveryProvider.setSimulateResults(null);
    process.env.GOOGLE_PLACES_API_KEY = keyBackup;
    results.testN_GooglePlusOsmSupplemental = { passed: false, error: err.message };
  }

  return NextResponse.json(results);
}
