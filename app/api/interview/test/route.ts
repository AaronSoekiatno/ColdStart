import { NextRequest, NextResponse } from 'next/server';
import { handleTestEvent } from '@/lib/vapi-orchestrator';

/**
 * POST /api/interview/test
 * Handles test/check suite events from assessment repository
 * 
 * Body:
 *   - sessionId: string (required) - Session ID from repository config
 *   - testData: object (required) - Test result information
 *     - status: string - 'success' | 'failure' | 'neutral'
 *     - conclusion: string - 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out'
 *     - head_sha: string - Commit SHA that was tested
 *     - check_run_id?: string - GitHub check run ID
 *     - details_url?: string - URL to view test details
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, testData } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId. Read it from .hermes/config.json in your repository.' },
        { status: 400 }
      );
    }

    if (!testData) {
      return NextResponse.json(
        { error: 'Missing testData' },
        { status: 400 }
      );
    }

    // Validate required test fields
    if (!testData.status || !testData.conclusion || !testData.head_sha) {
      return NextResponse.json(
        { error: 'testData must include status, conclusion, and head_sha' },
        { status: 400 }
      );
    }

    console.log(`[API] Test event received for session ${sessionId}:`, {
      status: testData.status,
      conclusion: testData.conclusion,
      headSha: testData.head_sha
    });

    const result = await handleTestEvent(sessionId, testData);

    // Handle different return shapes from handleTestEvent
    const transitioned = 'transition' in result ? result.transition !== false : false;
    const currentPhase = 'currentPhase' in result ? result.currentPhase : null;

    return NextResponse.json({
      success: true,
      transitioned,
      currentPhase: currentPhase?.id,
      phase: currentPhase
    });

  } catch (error) {
    console.error('[API] Error handling test event:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process test event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
