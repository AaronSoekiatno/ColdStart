import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Chat History
 *
 * GET /api/agent/chat-history?sessionId=xxx
 * Load chat history for a session from localStorage-style persistence
 *
 * POST /api/agent/chat-history
 * Save chat history for a session
 */

// In-memory storage for chat histories (will persist across API calls in same deployment)
// For production, use a database table or Redis
const chatHistories = new Map<string, any[]>();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    try {
        const messages = chatHistories.get(sessionId) || [];
        return NextResponse.json({ messages });
    } catch (error) {
        console.error('[API] Error loading chat history:', error);
        return NextResponse.json(
            { error: 'Failed to load chat history', messages: [] },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, messages } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Store in memory
        chatHistories.set(sessionId, messages);
        console.log(`[API] Saved ${messages.length} messages for session ${sessionId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error saving chat history:', error);
        return NextResponse.json(
            { error: 'Failed to save chat history' },
            { status: 500 }
        );
    }
}
