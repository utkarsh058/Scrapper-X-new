import { NextRequest, NextResponse } from 'next/server';
import { targetPlanner } from '@/lib/planner/targetPlanner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query string is required.' },
        { status: 400 }
      );
    }

    const plan = targetPlanner.parseNaturalLanguageTarget(query);

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Target planning failed.' },
      { status: 500 }
    );
  }
}
