import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/ide/start-session
 * 
 * Starts an IDE session for a user.
 * For now, this provisions the Claude API key and returns connection info.
 * 
 * In production with Docker, this would:
 * 1. Provision Claude API key
 * 2. Start a Docker container with the key injected
 * 3. Return the container URL
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // 2. Generate session ID
    const sessionId = crypto.randomUUID();

    // 3. Provision Claude API key for this session
    const masterApiKey = process.env.ANTHROPIC_API_KEY;
    if (!masterApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'Claude API not configured' },
        { status: 500 }
      );
    }

    // 4. Track the session in database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4); // 4-hour session

    const { error: insertError } = await supabase
      .from('claude_api_keys')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        api_key_hash: `hash_${sessionId}`, // Simplified for now
        expires_at: expiresAt.toISOString(),
        usage_count: 0,
      });

    if (insertError) {
      console.error('Failed to create session record:', insertError);
      // Continue anyway - this is just for tracking
    }

    // 5. For local development, return localhost URL
    // In production, this would start a Docker container and return its URL
    const ideUrl = process.env.NODE_ENV === 'production'
      ? `https://ide-${sessionId}.your-domain.com` // Replace with your actual domain
      : 'http://localhost:8080';

    // 6. Store session info for the user
    const { error: sessionError } = await supabase
      .from('ide_sessions')
      .upsert({
        user_id: user.id,
        session_id: sessionId,
        container_url: ideUrl,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Failed to store session info:', sessionError);
    }

    return NextResponse.json({
      sessionId,
      ideUrl,
      expiresAt: expiresAt.toISOString(),
      claudeEnabled: true,
    });

  } catch (error) {
    console.error('Error starting IDE session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ide/start-session
 * 
 * Ends an IDE session and cleans up resources
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    // Revoke Claude API key
    await supabase
      .from('claude_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('session_id', sessionId);

    // Mark session as ended
    await supabase
      .from('ide_sessions')
      .update({ 
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('session_id', sessionId);

    // In production, this would also stop the Docker container

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error ending IDE session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
