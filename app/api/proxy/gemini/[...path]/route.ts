import { NextRequest, NextResponse } from 'next/server';
import { getNextApiKey } from '@/lib/api-key-pool';
import { verifyCandidateJWT } from '@/lib/generate-candidate-jwt';

// Target the official Google Gemini API
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com';

export const runtime = 'nodejs'; // Required for fetch proxying in some envs, but default is usually fine. Explicit is safer.

/**
 * Proxy handler for Google Gemini API
 * 
 * Intercepts requests to /api/proxy/gemini/...
 * 1. Verifies the Bearer token (Candidate JWT)
 * 2. Appends the Google API Key (server-side)
 * 3. Forwards to https://generativelanguage.googleapis.com/...
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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
    try {
      verifyCandidateJWT(token);
    } catch (error) {
       console.warn('[Proxy] Invalid JWT token attempt');
       return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // 2. Get API Key from Pool
    let apiKey: string;
    try {
      apiKey = getNextApiKey();
    } catch (error) {
      console.error('[Proxy] API Key Pool Exhausted:', error);
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // 3. Construct Upstream URL
    // Await params because in Next.js 15+ params is a Promise
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const url = new URL(`/${path}`, GOOGLE_API_BASE);
    
    // Copy existing query params from the incoming request
    request.nextUrl.searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
    });

    // Append the API Key
    url.searchParams.append('key', apiKey);

    // 4. Forward Request
    const body = request.method !== 'GET' && request.method !== 'HEAD' 
      ? await request.text() 
      : undefined;

    const upstreamResponse = await fetch(url.toString(), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        // Do NOT forward the original Authorization header to Google, they don't use our JWTs
      },
      body,
    });

    // 5. Return Response
    const data = await upstreamResponse.json();
    return NextResponse.json(data, { status: upstreamResponse.status });

  } catch (error) {
    console.error('[Proxy] Detailed Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Proxy Error' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
