import { NextRequest, NextResponse } from 'next/server';
import { handleCommitEvent } from '@/lib/vapi-orchestrator';

/**
 * POST /api/interview/commit
 * Handles commit events from assessment repository
 * 
 * Body:
 *   - sessionId: string (required) - Session ID from repository config
 *   - commitData: object (required) - Commit information
 *     - id: string - Commit SHA
 *     - message: string - Commit message
 *     - timestamp: string - ISO timestamp
 *     - author?: object - Author information
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, commitData } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId. Read it from .hermes/config.json in your repository.' },
        { status: 400 }
      );
    }

    if (!commitData) {
      return NextResponse.json(
        { error: 'Missing commitData' },
        { status: 400 }
      );
    }

    // Validate required commit fields
    if (!commitData.id || !commitData.message) {
      return NextResponse.json(
        { error: 'commitData must include id (SHA) and message' },
        { status: 400 }
      );
    }

    console.log(`[API] Commit event received for session ${sessionId}:`, {
      commitId: commitData.id,
      message: commitData.message.substring(0, 50)
    });

    const result = await handleCommitEvent(sessionId, commitData);

    return NextResponse.json({
      success: true,
      transitioned: result.shouldTransition || false,
      currentPhase: result.currentPhase?.id,
      phase: result.currentPhase,
      session: result.session
    });

  } catch (error) {
    console.error('[API] Error handling commit event:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process commit event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
