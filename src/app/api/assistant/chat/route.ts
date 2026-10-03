import { NextRequest, NextResponse } from 'next/server';
import { SalesAssistantService } from '@/lib/assistant/salesAssistantService';

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid message string is required.' }, { status: 400 });
    }

    const response = await SalesAssistantService.chat(message, history || []);
    return NextResponse.json({ success: true, ...response });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Sales Assistant error.' },
      { status: 500 }
    );
  }
}
