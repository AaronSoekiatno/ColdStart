import { NextRequest, NextResponse } from 'next/server';
import { verifyCandidateJWT } from '@/lib/generate-candidate-jwt';
import { createClient } from '@supabase/supabase-js';

// Target the official Anthropic Claude API
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

export const runtime = 'nodejs';

// Security Configuration
const MAX_TOKENS_PER_REQUEST = 15000; // 15K - Sufficient for the 'Absurd Data Flywheel' context
const MAX_REQUESTS_PER_MINUTE = 3;    // One every 20 seconds - Kills 'Prompt Spamming'
const PROXY_ENABLED = process.env.CLAUDE_PROXY_ENABLED !== 'false'; // Kill switch

// Simple in-memory rate limiter (use Redis/Upstash for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(candidateId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = candidateId;
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    // Reset window
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - limit.count };
}

// Initialize Supabase client for logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Proxy handler for Anthropic Claude API
 * 
 * Intercepts requests to /api/proxy/claude/...
 * 1. Verifies the Bearer token (Candidate JWT)
 * 2. Enforces rate limits and token limits
 * 3. Logs prompt to admin_audit.prompt_logs
 * 4. Forwards to https://api.anthropic.com/...
 * 5. Logs response
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = Date.now();
  let candidateId: string | null = null;

  try {
    // 0. Check if proxy is enabled (kill switch)
    if (!PROXY_ENABLED) {
      console.warn('[Claude Proxy] Proxy is disabled via CLAUDE_PROXY_ENABLED');
      return NextResponse.json(
        { error: 'Claude API proxy is temporarily disabled' },
        { status: 503 }
      );
    }

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
        return NextResponse.json(
          { error: 'Invalid token: missing candidate ID' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.warn('[Claude Proxy] Invalid JWT token attempt');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // 2. Check Rate Limit
    const rateLimit = checkRateLimit(candidateId);
    if (!rateLimit.allowed) {
      console.warn(`[Claude Proxy] Rate limit exceeded for candidate ${candidateId}`);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute allowed`,
          retryAfter: 60 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': MAX_REQUESTS_PER_MINUTE.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60'
          }
        }
      );
    }

    // 3. Get Claude API Key from environment
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeApiKey) {
      console.error('[Claude Proxy] ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // 4. Parse request body for logging and validation
    const requestBody = request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined;

    let requestJson: any = {};
    let promptText = '';
    let modelRequested = '';
    let maxTokensRequested = 0;

    if (requestBody) {
      try {
        requestJson = JSON.parse(requestBody);
        
        // Extract prompt text from messages (Claude Messages API format)
        if (requestJson.messages && Array.isArray(requestJson.messages)) {
          promptText = requestJson.messages
            .map((msg: any) => `${msg.role}: ${msg.content}`)
            .join('\n');
        }
        
        // Extract model and max_tokens
        modelRequested = requestJson.model || '';
        maxTokensRequested = requestJson.max_tokens || 0;

        // Enforce token limit
        if (maxTokensRequested > MAX_TOKENS_PER_REQUEST) {
          console.warn(`[Claude Proxy] Token limit exceeded: ${maxTokensRequested} > ${MAX_TOKENS_PER_REQUEST}`);
          return NextResponse.json(
            { 
              error: 'Token limit exceeded',
              message: `Maximum ${MAX_TOKENS_PER_REQUEST} tokens per request allowed`,
              requested: maxTokensRequested,
              limit: MAX_TOKENS_PER_REQUEST
            },
            { status: 400 }
          );
        }

        // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
        const estimatedInputTokens = Math.ceil(promptText.length / 4);
        if (estimatedInputTokens > MAX_TOKENS_PER_REQUEST) {
          console.warn(`[Claude Proxy] Input too large: ~${estimatedInputTokens} tokens`);
          return NextResponse.json(
            { 
              error: 'Input too large',
              message: `Estimated input size (~${estimatedInputTokens} tokens) exceeds limit of ${MAX_TOKENS_PER_REQUEST} tokens`,
              hint: 'Reduce the size of your prompt or conversation history'
            },
            { status: 400 }
          );
        }

      } catch (e) {
        console.warn('[Claude Proxy] Failed to parse request body for validation');
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        );
      }
    }

    // 5. Construct Upstream URL
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const url = new URL(`/${path}`, ANTHROPIC_API_BASE);

    // Copy query params
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // 6. Forward Request to Claude API
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

    // 7. Parse Response
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

    // 8. Log to admin_audit.prompt_logs via RPC (CRITICAL: Must succeed)
    let logStatus = 'not-started';
    if (candidateId) {
      try {
        const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!sUrl || !sKey) {
          logStatus = 'missing-env-vars';
          console.error('[Claude Proxy] Supabase env vars missing - BLOCKING REQUEST');
          // CRITICAL: If logging fails, block the request to prevent untracked usage
          return NextResponse.json(
            { error: 'Logging service unavailable - request blocked for security' },
            { status: 503 }
          );
        }

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
            rateLimit: {
              remaining: rateLimit.remaining,
              limit: MAX_REQUESTS_PER_MINUTE
            }
          },
        });
        
        if (logError) {
          logStatus = `error-${logError.code || 'unknown'}`;
          console.error('[Claude Proxy] Supabase RPC error - BLOCKING REQUEST:', logError);
          // CRITICAL: If logging fails, block the request
          return NextResponse.json(
            { 
              error: 'Logging failed - request blocked for security',
              details: 'All API usage must be logged. Please contact support.'
            },
            { status: 503 }
          );
        }
        
        logStatus = 'success';
        console.log(`[Claude Proxy] ✓ Logged ${tokensUsed} tokens for candidate ${candidateId}`);
      } catch (logCatchError) {
        logStatus = 'caught-error';
        console.error('[Claude Proxy] Caught log error - BLOCKING REQUEST:', logCatchError);
        // CRITICAL: If logging fails, block the request
        return NextResponse.json(
          { error: 'Logging service error - request blocked for security' },
          { status: 503 }
        );
      }
    }

    // 9. Return Response with rate limit headers
    return new NextResponse(responseText, {
      status: responseStatus,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': MAX_REQUESTS_PER_MINUTE.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
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
        // Ignore logging errors in error handler
      }
    }

    return NextResponse.json(
      { error: 'Internal Proxy Error' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
