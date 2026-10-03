import { NextResponse } from 'next/server';
import { AutonomousCampaignEngine } from '@/lib/autonomous/autonomousCampaignEngine';

export async function POST() {
  try {
    const report = await AutonomousCampaignEngine.runAutonomousCycle();
    return NextResponse.json({ success: true, ...report });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Autonomous engine run error.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const report = await AutonomousCampaignEngine.runAutonomousCycle();
    return NextResponse.json({ success: true, ...report });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Autonomous engine run error.' },
      { status: 500 }
    );
  }
}
