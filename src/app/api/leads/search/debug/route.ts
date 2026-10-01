import { NextRequest, NextResponse } from 'next/server';
import { validateStateAndCity } from '@/data/indiaLocations';
import { resolveIndiaLocation } from '@/lib/geoResolver';
import { businessDiscoveryActor } from '@/actors/BusinessDiscoveryActor';
import { multiSourceMergeActor } from '@/actors/MultiSourceMergeActor';
import { SearchRequestPayload } from '@/types';

export async function POST(req: NextRequest) {
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

    // Run multi-source discovery actor
    const discoveryResult = await businessDiscoveryActor.execute({
      jobId: `debug_${Date.now()}`,
      input: {
        industry,
        state: verifiedState,
        city: verifiedCity,
        limit: Math.max(Number(limit) || 50, 25),
        bbox,
      },
    });

    const discovery = discoveryResult.data;

    // Run multi-source merge
    const mergeResult = await multiSourceMergeActor.execute({
      jobId: `debug_merge_${Date.now()}`,
      input: discovery.businesses,
    });

    const merged = mergeResult.data.merged;

    const withPhoneCount = merged.filter((l) => Boolean(l.phone)).length;
    const withEmailCount = merged.filter((l) => Boolean(l.email)).length;
    const withWebsiteCount = merged.filter((l) => Boolean(l.website)).length;

    // Contact filtering preview
    const contactCount = merged.filter((l) => {
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
    const websiteCount = merged.filter((l) => {
      const hasWebsite = Boolean(l.website);
      if (websiteFilter === 'No Website') return !hasWebsite;
      if (websiteFilter === 'Website Available') return hasWebsite;
      return true;
    }).length;

    return NextResponse.json({
      success: true,
      search: {
        industry,
        state: verifiedState,
        city: verifiedCity,
        contactFilter,
        websiteFilter,
        requestedLimit: limit,
      },
      osmRawCount: discovery.providerStats.osm.rawCount,
      webRawCount: discovery.providerStats.web.rawCount,
      directoryRawCount: discovery.providerStats.directory.rawCount,
      totalDiscovered: discovery.totalDiscovered,
      normalizedCount: merged.length,
      deduplicatedCount: mergeResult.data.deduplicatedCount,
      locationVerifiedCount: merged.length,
      contactCount,
      websiteCount,
      finalCount: Math.min(merged.length, limit),
      providerStatuses: {
        osm: discovery.providerStats.osm.status,
        web: discovery.providerStats.web.status,
        directory: discovery.providerStats.directory.status,
      },
      providerDurations: {
        osm: discovery.providerStats.osm.durationMs,
        web: discovery.providerStats.web.durationMs,
        directory: discovery.providerStats.directory.durationMs,
      },
      sourceStatus: discovery.sourceComplete ? 'COMPLETE' : 'PARTIAL',
      statusReason: discovery.statusReason,
      overpassQuery: discovery.queryUsed,
      endpointUsed: discovery.endpointUsed,
      withPhoneCount,
      withEmailCount,
      withWebsiteCount,
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
