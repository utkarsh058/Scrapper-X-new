import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/services/SearchService';
import { SearchRequestPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: SearchRequestPayload = await req.json();
    const url = new URL(req.url);
    const isSync = url.searchParams.get('sync') === 'true';

    const result = await searchService.startSearch(body, isSync);

    return NextResponse.json(result, {
      status: result.success === false ? 400 : 200,
    });
  } catch (error: any) {
    console.error('[API /api/leads/search Error]:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'FAILED',
        error: error.message || 'Failed to dispatch search job.',
      },
      { status: 500 }
    );
  }
}
