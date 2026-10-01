import { NextRequest, NextResponse } from 'next/server';
import { validateStateAndCity } from '@/data/indiaLocations';
import { resolveIndiaLocation } from '@/lib/geoResolver';
import { businessDiscoveryActor } from '@/actors/BusinessDiscoveryActor';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { locationVerificationActor } from '@/actors/LocationVerificationActor';
import { businessVerificationActor } from '@/actors/BusinessVerificationActor';
import { deduplicationActor } from '@/actors/DeduplicationActor';
import { SearchRequestPayload } from '@/types';
import { googleUsageTracker } from '@/lib/billing/GoogleUsageTracker';
import { performanceTracker } from '@/lib/metrics/PerformanceTracker';
import { backgroundEnrichmentQueue } from '@/lib/queue/BackgroundEnrichmentQueue';
import { googleDiscoveryCache } from '@/lib/cache/GoogleDiscoveryCache';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';

export async function POST(req: NextRequest) {
  const debugStart = Date.now();
  const searchId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  try {
    const body: SearchRequestPayload = await req.json();
    const {
      state,
      city,
      industry,
      contactFilter = 'All Contacts',
      websiteFilter = 'Any Website',
      limit = 50,
    } = body;

    const validation = validateStateAndCity(state, city);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const verifiedState = validation.matchedState || state;
    const verifiedCity = validation.matchedCity || city;
    const bbox = await resolveIndiaLocation(verifiedState, verifiedCity);
    const query = `${industry} in ${verifiedCity || verifiedState}`;

    // 1. Run multi-source discovery actor (Google Primary + OSM Fallback)
    const discoveryResult = await businessDiscoveryActor.execute({
      jobId: searchId,
      input: {
        industry,
        state: verifiedState,
        city: verifiedCity,
        limit: Math.max(Number(limit) || 50, 25),
        bbox,
      },
    });

    const discovery = discoveryResult.data;

    // 2. Run multi-source merge
    const mergeResult = await multiSourceMergeActor.execute({
      jobId: searchId,
      input: discovery.businesses,
    });
    const merged = mergeResult.data.merged;

    // 3. Location Verification
    const locResult = await locationVerificationActor.execute({
      jobId: searchId,
      input: {
        businesses: merged,
        state: verifiedState,
        city: verifiedCity,
      },
    });

    // 4. Business Verification
    const bizResult = await businessVerificationActor.execute({
      jobId: searchId,
      input: locResult.data.verified,
    });

    // 5. Deduplication
    const dedupResult = await deduplicationActor.execute({
      jobId: searchId,
      input: bizResult.data.verified,
    });

    const withPhoneCount = dedupResult.data.unique.filter((l) => Boolean(l.phone)).length;
    const withEmailCount = dedupResult.data.unique.filter((l) => Boolean(l.email)).length;
    const withWebsiteCount = dedupResult.data.unique.filter((l) => Boolean(l.website)).length;

    // Contact filtering preview
    const contactCount = dedupResult.data.unique.filter((l) => {
      const hasPhone = Boolean(l.phone);
      const hasEmail = Boolean(l.email);
      if (contactFilter === 'Email + Phone') return hasPhone && hasEmail;
      if (contactFilter === 'Email Only') return hasEmail && !hasPhone;
      if (contactFilter === 'Phone Only') return hasPhone && !hasEmail;
      if (contactFilter === 'No Contact') return !hasPhone && !hasEmail;
      if (contactFilter === 'Has Phone or Email' || contactFilter === 'Phone or Email') return hasPhone || hasEmail;
      return true;
    }).length;

    // Website filtering preview
    const websiteCount = dedupResult.data.unique.filter((l) => {
      const hasWebsite = Boolean(l.website);
      if (websiteFilter === 'No Website') return !hasWebsite;
      if (websiteFilter === 'Website Available') return hasWebsite;
      return true;
    }).length;

    const rejectionReasons = {
      OUTSIDE_LOCATION: locResult.data.rejected.length,
      MISSING_NAME: bizResult.data.rejected.filter((r) => r.reason === 'MISSING_NAME').length,
      INVALID_CATEGORY: bizResult.data.rejected.filter((r) => r.reason === 'INVALID_CATEGORY').length,
      DUPLICATE: mergeResult.data.deduplicatedCount + dedupResult.data.duplicatesCount,
      NO_CONTACT: dedupResult.data.unique.length - contactCount,
      HAS_WEBSITE: websiteFilter === 'No Website' ? withWebsiteCount : 0,
      NO_WEBSITE: websiteFilter === 'Website Available' ? dedupResult.data.unique.length - withWebsiteCount : 0,
      WEBSITE_UNREACHABLE: 0,
      AUDIT_FAILED: 0,
      NOT_QUALIFIED: 0,
      OTHER: 0,
    };

    const fastPathLatencyMs = Date.now() - debugStart;
    const usageStats = googleUsageTracker.getStats();
    const loadStats = performanceTracker.getLoadMetrics();
    const percentiles = performanceTracker.calculatePercentiles('fastPathLatencyMs');

    return NextResponse.json({
      success: true,
      searchId,
      query,
      providerHealth: providerHealthService.checkHealth(),
      googleStatus: discovery.providerStats.googlePlaces?.status || 'PROVIDER_NOT_CONFIGURED',
      osmStatus: discovery.providerStats.osm?.status || 'NOT_NEEDED',
      rawGoogleCount: discovery.providerStats.googlePlaces?.rawCount || 0,
      rawOSMCount: discovery.providerStats.osm?.rawCount || 0,
      normalizedCount: merged.length,
      locationVerified: locResult.data.verified.length,
      locationVerifiedCount: locResult.data.verified.length,
      deduplicatedCount: mergeResult.data.deduplicatedCount + dedupResult.data.duplicatesCount,
      phoneCount: withPhoneCount,
      emailCount: withEmailCount,
      phoneOrEmailCount: dedupResult.data.unique.filter((b) => Boolean(b.phone || b.email)).length,
      websiteCount: withWebsiteCount,
      verifiedNoWebsiteCount: dedupResult.data.unique.filter((b) => !b.website).length,
      finalCount: Math.min(dedupResult.data.unique.length, limit),
      fastPathLatencyMs,
      backgroundJobs: backgroundEnrichmentQueue.getQueueStats(searchId),
      cacheHits: loadStats.cacheHits,
      cacheMisses: loadStats.cacheMisses,
      errors: discovery.providerStats.googlePlaces?.errors || [],
      warnings: discoveryResult.warnings || [],
      search: {
        industry,
        state: verifiedState,
        city: verifiedCity,
        contactFilter,
        websiteFilter,
        requestedLimit: limit,
      },
      rawCount: discovery.totalDiscovered,
      totalDiscovered: discovery.totalDiscovered,
      osmRawCount: discovery.providerStats.osm?.rawCount || 0,
      googlePlacesRawCount: discovery.providerStats.googlePlaces?.rawCount || 0,
      webRawCount: discovery.providerStats.web?.rawCount || 0,
      directoryRawCount: discovery.providerStats.directory?.rawCount || 0,
      providerStatuses: {
        googlePlaces: discovery.providerStats.googlePlaces?.status || 'PROVIDER_NOT_CONFIGURED',
        osm: discovery.providerStats.osm?.status || 'NOT_NEEDED',
        web: discovery.providerStats.web?.status || 'NOT_NEEDED',
        directory: discovery.providerStats.directory?.status || 'NOT_NEEDED',
      },
      providerDurations: {
        googlePlaces: discovery.providerStats.googlePlaces?.durationMs || 0,
        osm: discovery.providerStats.osm?.durationMs || 0,
        web: discovery.providerStats.web?.durationMs || 0,
        directory: discovery.providerStats.directory?.durationMs || 0,
      },
      GoogleRequests: usageStats.totalRequests,
      OSMRequests: discovery.providerStats.osm?.status !== 'NOT_NEEDED' ? 1 : 0,
      rejectionReasons,
      sourceStatus: discovery.sourceComplete ? 'COMPLETE' : 'PARTIAL',
      statusReason: discovery.statusReason,
      overpassQuery: discovery.queryUsed,
      endpointUsed: discovery.endpointUsed,
      withPhoneCount,
      withEmailCount,
      withWebsiteCount,
      performance: {
        p50LatencyMs: percentiles.p50,
        p95LatencyMs: percentiles.p95,
        p99LatencyMs: percentiles.p99,
        averageLatencyMs: percentiles.average,
      },
      googleBudget: {
        mode: usageStats.budgetMode,
        dailyLimit: usageStats.dailyLimit,
        monthlyLimit: usageStats.monthlyLimit,
        todayCalls: usageStats.todayUsage.requestCount,
        alertLevel: usageStats.currentAlertLevel,
        isAllowed: usageStats.isGoogleAllowed,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Diagnostic query failed.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state') || 'Uttar Pradesh';
  const city = searchParams.get('city') || undefined;
  const industry = searchParams.get('industry') || 'Hotel';
  const contactFilter = (searchParams.get('contactFilter') as any) || 'All Contacts';
  const websiteFilter = (searchParams.get('websiteFilter') as any) || 'Any Website';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({ state, city, industry, contactFilter, websiteFilter, limit }),
  });

  return POST(fakeReq);
}
