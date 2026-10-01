import { NextRequest, NextResponse } from 'next/server';
import { isValidIndianState } from '@/data/indiaLocations';
import { pipelineOrchestrator } from '@/lib/orchestrator/pipelineOrchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
          leads: [],
        },
        { status: 400 }
      );
    }

    if (!industry || industry.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Industry is required.',
          leads: [],
        },
        { status: 400 }
      );
    }

    const requestedLimit = Math.min(Math.max(Number(limit) || 25, 5), 250);

    // 2. Execute Orchestrated Pipeline with Canonical DB Persistence
    const result = await pipelineOrchestrator.executePipeline({
      country: 'India',
      state,
      city: city || undefined,
      industry,
      contactFilter,
      websiteFilter,
      limit: requestedLimit,
    });

    return NextResponse.json({
      success: true,
      leads: result.leads,
      summary: result.summary,
      totalDiscovered: result.totalDiscovered,
      totalMatched: result.totalMatched,
      jobId: result.jobId,
      pipelineRunId: result.pipelineRunId,
      attribution: 'LeadPilot Pipeline • Real Verified Data',
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
        leads: [],
      },
      { status: 500 }
    );
  }
}
