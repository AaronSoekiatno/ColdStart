import { NextRequest, NextResponse } from 'next/server';
import { verifyCandidateJWT } from '@/lib/generate-candidate-jwt';
import { createClient } from '@supabase/supabase-js';

// Target the official Anthropic Claude API
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

export const runtime = 'nodejs';

// Initialize Supabase client for logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Proxy handler for Anthropic Claude API
 * 
 * Intercepts requests to /api/proxy/claude/...
 * 1. Verifies the Bearer token (Candidate JWT)
 * 2. Logs prompt to admin_audit.prompt_logs
 * 3. Forwards to https://api.anthropic.com/...
 * 4. Logs response
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = Date.now();
  let candidateId: string | null = null;

  try {
    // 1. Authenticate Request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let jwtPayload: any;
    try {
      jwtPayload = verifyCandidateJWT(token);
      // Try both candidate_id (standard) and candidateId (fallback)
      candidateId = jwtPayload.candidate_id || jwtPayload.sub || jwtPayload.candidateId;
      
      if (!candidateId) {
        console.warn('[Claude Proxy] Valid JWT but missing candidate ID in payload');
      }
    } catch (error) {
      console.warn('[Claude Proxy] Invalid JWT token attempt');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // 2. Get Claude API Key from environment
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeApiKey) {
      console.error('[Claude Proxy] ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // 3. Parse request body for logging
    const requestBody = request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined;

    let requestJson: any = {};
    let promptText = '';
    let modelRequested = '';

    if (requestBody) {
      try {
        requestJson = JSON.parse(requestBody);
        
        // Extract prompt text from messages (Claude Messages API format)
        if (requestJson.messages && Array.isArray(requestJson.messages)) {
          promptText = requestJson.messages
            .map((msg: any) => `${msg.role}: ${msg.content}`)
            .join('\n');
        }
        
        // Extract model
        modelRequested = requestJson.model || '';
      } catch (e) {
        console.warn('[Claude Proxy] Failed to parse request body for logging');
      }
    }

    // 4. Construct Upstream URL
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const url = new URL(`/${path}`, ANTHROPIC_API_BASE);

    // Copy query params
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // 5. Forward Request to Claude API
    const upstreamResponse = await fetch(url.toString(), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'User-Agent': request.headers.get('User-Agent') || 'Hermes-Claude-Proxy/1.0',
      },
      body: requestBody,
    });

    const responseTime = Date.now() - startTime;
    const responseStatus = upstreamResponse.status;

    // 6. Parse Response
    const responseText = await upstreamResponse.text();
    let responseJson: any = {};
    let tokensUsed = 0;

    try {
      responseJson = JSON.parse(responseText);
      
      // Extract token usage (Claude API format)
      if (responseJson.usage) {
        tokensUsed = (responseJson.usage.input_tokens || 0) + 
                     (responseJson.usage.output_tokens || 0);
      }
    } catch (e) {
      console.warn('[Claude Proxy] Failed to parse response body');
    }

    // 7. Log to admin_audit.prompt_logs via RPC
    let logStatus = 'not-started';
    if (candidateId) {
      try {
        const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!sUrl || !sKey) {
          logStatus = 'missing-env-vars';
          console.error('[Claude Proxy] Supabase env vars missing in handler');
        } else {
          // Use default public schema for RPC
          const supabase = createClient(sUrl, sKey);
          
          const { error: logError } = await supabase.rpc('log_claude_prompt', {
            p_candidate_id: candidateId,
            p_tool_name: 'claude-code',
            p_provider: 'claude',
            p_model_requested: modelRequested,
            p_prompt_text: promptText,
            p_prompt_json: requestJson,
            p_response_json: responseJson,
            p_tokens_used: tokensUsed,
            p_response_status: responseStatus,
            p_response_time_ms: responseTime,
            p_user_agent: request.headers.get('User-Agent') || null,
            p_request_metadata: {
              path: path,
              method: request.method,
            },
          });
          
          if (logError) {
            logStatus = `error-${logError.code || 'unknown'}`;
            console.error('[Claude Proxy] Supabase RPC error:', logError);
          } else {
            logStatus = 'success';
            console.log(`[Claude Proxy] Logged prompt via RPC for candidate ${candidateId}`);
          }
        }
      } catch (logCatchError) {
        logStatus = 'caught-error';
        console.error('[Claude Proxy] Caught log error:', logCatchError);
      }
    }

    // 8. Return Response
    return new NextResponse(responseText, {
      status: responseStatus,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('[Claude Proxy] Detailed Proxy Error:', error);
    
    // Log error attempt if we have candidate ID
    if (candidateId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('prompt_logs')
          .insert({
            candidate_id: candidateId,
            tool_name: 'claude-code',
            provider: 'claude',
            response_status: 500,
            response_time_ms: Date.now() - startTime,
            request_metadata: { error: String(error) },
          });
      } catch (logError) {
        // Ignore logging errors
      }
    }

    return NextResponse.json(
      { error: 'Internal Proxy Error' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
