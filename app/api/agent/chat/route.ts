import { NextRequest, NextResponse } from 'next/server';
import {
  getContainerBySessionId,
  executeClaudeInFlyContainer,
} from '@/lib/agent-executor';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes for long agent tasks

/**
 * POST /api/agent/chat
 * Executes Claude Code wrapper in the container and streams response
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing sessionId or message' },
        { status: 400 }
      );
    }

    // Get container info from session
    const container = await getContainerBySessionId(sessionId);
    if (!container) {
      return NextResponse.json(
        { error: 'Container not found for session' },
        { status: 404 }
      );
    }

    // Execute claude-code in Fly.io container
    if (!container.fly_app_name) {
      return NextResponse.json(
        { error: 'Container is not running on Fly.io. Chat only works in production.' },
        { status: 400 }
      );
    }

    const stream = await executeClaudeInFlyContainer(
      container.fly_app_name,
      container.container_id,
      message
    );

    // Stream response back to frontend
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process message' },
      { status: 500 }
    );
  }
}
