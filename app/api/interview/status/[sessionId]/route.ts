import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getInterviewStatus } from '@/lib/vapi-orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const statusObj = await getInterviewStatus(sessionId);
    
    if (!statusObj || !statusObj.session) {
      return new NextResponse("unknown", { status: 404 });
    }

    // Return plain text status (e.g. "completed", "active")
    const status = statusObj.session.status || "unknown";
    
    return new NextResponse(status, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Error fetching session status:', error);
    return new NextResponse("error", { status: 500 });
  }
}
