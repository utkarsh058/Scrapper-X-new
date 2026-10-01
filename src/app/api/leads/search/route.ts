import { NextRequest, NextResponse } from 'next/server';
import { isValidIndianState } from '@/data/indiaLocations';
import { pipelineOrchestrator } from '@/lib/orchestrator/pipelineOrchestrator';
import { searchService } from '@/services/SearchService';

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
    const isSync = url.searchParams.get('sync') === 'true' || body.sync === true;
    const requestedEngine = url.searchParams.get('engine') || body.engine;

    const {
      country = 'India',
      state,
      city,
      industry,
      contactFilter = 'All Contacts',
      websiteFilter = 'Any Website',
      limit = 100,
    } = body;

    // 1. Strict Location Validation
    if (country !== 'India') {
      return NextResponse.json(
        {
          success: false,
          error: 'Restricted to India only. Foreign locations are not permitted.',
          code: 'INVALID_COUNTRY',
          leads: [],
        },
        { status: 400 }
      );
    }

    if (!state || !isValidIndianState(state)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Indian State or Union Territory: "${state}". Please select a valid region in India.`,
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
      country: 'India',
      state,
      city: city ? String(city).trim() : undefined,
      industry: industry.trim(),
      contactFilter,
      websiteFilter,
      limit: requestedLimit,
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

