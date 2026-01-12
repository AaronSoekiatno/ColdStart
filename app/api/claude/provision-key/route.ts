import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

/**
 * POST /api/claude/provision-key
 * 
 * Provisions a Claude API key for a user's container session.
 * The key is securely managed and tracked for usage monitoring.
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

    // 2. Get the master Anthropic API key from environment
    const masterApiKey = process.env.ANTHROPIC_API_KEY;
    if (!masterApiKey) {
      console.error('ANTHROPIC_API_KEY not configured in environment');
      return NextResponse.json(
        { error: 'Claude API not configured' },
        { status: 500 }
      );
    }

    // 3. Get or create session for this user
    const body = await request.json();
    const sessionId = body.sessionId || crypto.randomUUID();

    // 4. Check if user already has an active key for this session
    const { data: existingKey } = await supabase
      .from('claude_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .is('revoked_at', null)
      .single();

    if (existingKey) {
      // Return existing key
      return NextResponse.json({
        apiKey: masterApiKey, // For now, we use the master key
        sessionId,
        expiresAt: existingKey.expires_at,
      });
    }

    // 5. Create new key record for tracking
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4); // 4-hour session

    const apiKeyHash = createHash('sha256')
      .update(masterApiKey + sessionId)
      .digest('hex');

    const { error: insertError } = await supabase
      .from('claude_api_keys')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        api_key_hash: apiKeyHash,
        expires_at: expiresAt.toISOString(),
        usage_count: 0,
      });

    if (insertError) {
      console.error('Failed to create API key record:', insertError);
      return NextResponse.json(
        { error: 'Failed to provision API key' },
        { status: 500 }
      );
    }

    // 6. Return the API key (will be injected into container env)
    return NextResponse.json({
      apiKey: masterApiKey,
      sessionId,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Error provisioning Claude API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/claude/provision-key
 * 
 * Revokes a Claude API key for a session (called when session ends)
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

    // Revoke the key
    const { error } = await supabase
      .from('claude_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Failed to revoke API key:', error);
      return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error revoking Claude API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
