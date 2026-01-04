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
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to provision your workspace.' },
        { status: 401 }
      );
    }

    // Get candidate record
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate record not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // Verify candidate_id matches authenticated user (security check)
    // This ensures candidates can only provision their own workspace
    const { data: candidateCheck, error: candidateCheckError } = await supabaseAdmin
      .from('candidates')
      .select('id, email')
      .eq('id', candidate.id)
      .eq('email', user.email)
      .single();

    if (candidateCheckError || !candidateCheck) {
      return NextResponse.json(
        { error: 'Authorization failed. Candidate ID does not match authenticated user.' },
        { status: 403 }
      );
    }

    // Call RPC function to create candidate schema
    const { data: schemaName, error: rpcError } = await supabaseAdmin.rpc(
      'create_candidate_schema',
      { candidate_id_param: candidate.id }
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
      jwtToken = generateCandidateJWT(candidate.id, schemaName, 24); // 24 hour expiration
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

