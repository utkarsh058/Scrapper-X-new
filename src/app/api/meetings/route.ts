import { NextRequest, NextResponse } from 'next/server';
import { MeetingService } from '@/lib/meetings/meetingService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const meetings = await MeetingService.getMeetings(status);
    return NextResponse.json({ success: true, meetings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch meetings.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await MeetingService.scheduleMeeting(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to schedule meeting.' },
      { status: 400 }
    );
  }
}
