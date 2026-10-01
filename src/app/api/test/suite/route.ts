import { NextResponse } from 'next/server';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { secondaryBusinessDataProvider, SecondaryBusinessDataProvider } from '@/providers/SecondaryBusinessDataProvider';
import { webSearchDiscoveryProvider, WebSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';

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

  return NextResponse.json(results);
}
