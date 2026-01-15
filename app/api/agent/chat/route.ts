import { NextRequest, NextResponse } from 'next/server';
import {
  getContainerBySessionId,
  executeClaudeInFlyContainer,
  executeClaudeInDockerContainer,
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

    // Execute claude-code in the container based on environment
    let stream: ReadableStream;

    if (container.environment === 'flyio' && container.fly_app_name) {
      // Fly.io production environment
      stream = await executeClaudeInFlyContainer(
        container.fly_app_name,
        container.container_id,
        message
      );
    } else {
      // Local Docker development
      stream = executeClaudeInDockerContainer(container.container_id, message);
    }

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
