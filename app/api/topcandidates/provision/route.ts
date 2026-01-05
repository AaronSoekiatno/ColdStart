import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
import { generateCandidateJWT } from '@/lib/generate-candidate-jwt';
import { getNextApiKey } from '@/lib/api-key-pool';

/**
 * POST /api/topcandidates/provision
 * 
 * Provisions a candidate's assessment workspace by:
 * 1. Creating a private Postgres schema
 * 2. Generating a schema-specific JWT token
 * 3. Selecting a Google API key from the pool
 * 4. Returning credentials for local development
 * 
 * Requires: Authenticated candidate with valid Supabase session
 */
async function handler(request: NextRequest) {
  try {

    // Initialize Supabase Client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    // 1. Try Authentication via Session (Browser/Cookie)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    let candidateId: string | null = null;
    let candidateEmail: string | null = null;

    if (user && user.email) {
      // Authenticated via Session
      const { data: candidateData, error: candidateError } = await supabaseAdmin!
        .from('candidates')
        .select('id, email')
        .eq('email', user.email)
        .single();
      
      if (!candidateError && candidateData) {
        candidateId = candidateData.id;
        candidateEmail = candidateData.email;
      }
    }

    // 2. Try Authentication via Provisioning Token (Script/Header)
    if (!candidateId) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            // Validate token against candidates table
            const { data: tokenCandidate, error: tokenError } = await supabaseAdmin!
                .from('candidates')
                .select('id, email')
                .eq('provisioning_token', token)
                .single();

            if (!tokenError && tokenCandidate) {
                candidateId = tokenCandidate.id;
                candidateEmail = tokenCandidate.email;
                console.log(`[Provision] Authenticated via provisioning token for candidate: ${candidateEmail}`);
            } else {
                console.warn(`[Provision] Invalid provisioning token attempt`);
            }
        }
    }

    if (!candidateId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in or provide a valid provisioning token.' },
        { status: 401 }
      );
    }

    // Call RPC function to create candidate schema
    const { data: schemaName, error: rpcError } = await supabaseAdmin!.rpc(
      'create_candidate_schema',
      { candidate_id_param: candidateId }
    );

    if (rpcError) {
      console.error('[Provision] RPC error:', rpcError);
      return NextResponse.json(
        { 
          error: 'Failed to create candidate schema',
          details: rpcError.message 
        },
        { status: 500 }
      );
    }

    if (!schemaName || typeof schemaName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid response from schema creation. Schema name not returned.' },
        { status: 500 }
      );
    }

    // Generate schema-specific JWT token
    let jwtToken: string;
    try {
      jwtToken = generateCandidateJWT(candidateId, schemaName, 24); // 24 hour expiration
    } catch (jwtError) {
      const errorMessage = jwtError instanceof Error ? jwtError.message : 'Unknown error';
      console.error('[Provision] JWT generation error:', jwtError);
      return NextResponse.json(
        { 
          error: 'Failed to generate authentication token',
          details: errorMessage 
        },
        { status: 500 }
      );
    }

    // Get Google API key from pool
    let googleApiKey: string;
    try {
      googleApiKey = getNextApiKey();
    } catch (apiKeyError) {
      const errorMessage = apiKeyError instanceof Error ? apiKeyError.message : 'Unknown error';
      console.error('[Provision] API key pool error:', apiKeyError);
      return NextResponse.json(
        { 
          error: 'API key pool exhausted or not configured',
          details: errorMessage 
        },
        { status: 503 }
      );
    }

    // Get Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    // Return credentials in format suitable for .env.local
    return NextResponse.json({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_PRIVATE_KEY: jwtToken,
      GOOGLE_API_KEY: googleApiKey,
    });

  } catch (error) {
    console.error('[Provision] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };

