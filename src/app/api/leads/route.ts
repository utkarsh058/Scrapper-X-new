import { NextRequest, NextResponse } from 'next/server';
import { leadsDb } from '@/lib/leadsDb';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const leads = await leadsDb.getPersistedLeads(limit);

    return NextResponse.json({
      success: true,
      leads,
      count: leads.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed fetching leads.' },
      { status: 500 }
    );
  }
}
