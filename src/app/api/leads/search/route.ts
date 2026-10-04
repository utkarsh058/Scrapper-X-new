import { NextRequest, NextResponse } from 'next/server';
import { resolveCountry } from '@/lib/location/CountryRegistry';
import { resolveRegion } from '@/lib/location/RegionRegistry';
import { pipelineOrchestrator } from '@/lib/orchestrator/pipelineOrchestrator';
import { searchService } from '@/services/SearchService';
import { jobManager } from '@/jobs/JobManager';
import { waitUntil } from '@vercel/functions';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Malformed JSON payload in request body.',
          code: 'INVALID_JSON',
          leads: [],
        },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const isSync = url.searchParams.get('sync') === 'false' || body.sync === false ? false : true;
    const requestedEngine = url.searchParams.get('engine') || body.engine;

    const {
      country = 'India',
      countryCode,
      state,
      city,
      industry,
      contactFilter = 'All Contacts',
      websiteFilter = 'Any Website',
      limit = 100,
    } = body;

    // 1. Strict Multi-Country Location Validation
    const resolvedCountry = resolveCountry(countryCode || country);
    if (!resolvedCountry) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported country: "${country}". LeadPilot supports India, United States, and Canada.`,
          code: 'INVALID_COUNTRY',
          leads: [],
        },
        { status: 400 }
      );
    }

    const resolvedRegion = state ? resolveRegion(resolvedCountry.code, state) : null;
    if (!state || !resolvedRegion) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid State or Province for ${resolvedCountry.name}: "${state}". Please select a valid state, province, or territory.`,
          code: 'INVALID_STATE',
          leads: [],
        },
        { status: 400 }
      );
    }

    if (!industry || typeof industry !== 'string' || industry.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Industry is required.',
          code: 'MISSING_INDUSTRY',
          leads: [],
        },
        { status: 400 }
      );
    }

    const requestedLimit = Math.min(Math.max(Number(limit) || 25, 5), 250);
    const searchPayload = {
      country: resolvedCountry.name,
      countryCode: resolvedCountry.code,
      state: resolvedRegion.name,
      city: city ? String(city).trim() : undefined,
      industry: industry.trim(),
      contactFilter,
      websiteFilter,
      limit: requestedLimit,
      excludePerfectRating: body.excludePerfectRating !== false,
    };

    // If caller explicitly requests pipeline orchestrator engine
    if (requestedEngine === 'pipeline') {
      try {
        const result = await pipelineOrchestrator.executePipeline(searchPayload as any);
        return NextResponse.json({
          success: true,
          leads: result.leads,
          results: result.leads,
          summary: result.summary,
          totalDiscovered: result.totalDiscovered,
          totalMatched: result.totalMatched,
          jobId: result.jobId,
          pipelineRunId: result.pipelineRunId,
          sourceStatus: result.sourceStatus || 'COMPLETE',
          providers: result.providers,
          attribution: 'LeadPilot Pipeline • Real Verified Data',
        });
      } catch (pipelineErr: any) {
        console.warn('[PipelineOrchestrator Fallback to SearchService]:', pipelineErr.message);
      }
    }

    // Default: Dispatch via searchService (supports both asynchronous polling and synchronous execution)
    const result = await searchService.startSearch(searchPayload as any, isSync);

    if (!isSync) {
      const inFlightPromise = jobManager.getInFlightPromise(searchPayload as any);
      if (inFlightPromise) {
        waitUntil(inFlightPromise);
      }
    }

    return NextResponse.json(result, {
      status: result.success === false ? 400 : 200,
    });
  } catch (error: any) {
    console.error('[Search API Fatal Error]:', error);
    const msg = error.message || 'An error occurred while executing discovery pipeline.';
    return NextResponse.json(
      {
        success: false,
        error: msg.includes('timeout')
          ? 'Discovery service timed out. Please try a narrower city search or check network.'
          : msg,
        code: 'SEARCH_FAILED',
        leads: [],
        results: [],
      },
      { status: 500 }
    );
  }
}

