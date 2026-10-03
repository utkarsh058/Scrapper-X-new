import { NextRequest, NextResponse } from 'next/server';
import { WebsiteDemoService } from '@/lib/demo/websiteDemoService';

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required.' }, { status: 400 });
    }

    const result = await WebsiteDemoService.generateDemo(leadId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate website demo.' },
      { status: 500 }
    );
  }
}
