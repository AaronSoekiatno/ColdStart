import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { matchProjects, findDiscrepancies } from '@/lib/github-verification/project-matcher';
import { analyzeTimeline } from '@/lib/github-verification/timeline-analyzer';
import { calculateVerificationScore } from '@/lib/github-verification/score-calculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  description?: string;
  language?: string;
  languages?: string[];
  html_url: string;
  created_at: string;
}

interface GitHubCommit {
  date: string;
  repo?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate admin
    await requireAdmin();

    // 2. Get candidate_id and skip_ai from request body
    const body = await request.json();
    const { candidate_id, skip_ai = false } = body;

    if (!candidate_id) {
      return NextResponse.json(
        { success: false, error: 'candidate_id is required' },
        { status: 400 }
      );
    }



    // 3. Call the integrated Verification API route (now part of the main Next.js app)
    // Use the request origin to ensure we call the same server (localhost in dev, production in prod)
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin; // e.g., http://localhost:3000 or https://joinhermes.co
    const verificationServiceUrl = `${origin}/api/verifications`;
    
    console.log(`[ADMIN] Triggering high-fidelity verification for ${candidate_id} via ${verificationServiceUrl}`);


    const response = await fetch(verificationServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id,
        skip_ai,
      }),
    });

    // Read response as text first to avoid body consumption issues
    const responseText = await response.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[ADMIN] Failed to parse verification response:', parseError);
      console.error('[ADMIN] Response text:', responseText);
      console.error('[ADMIN] Response status:', response.status);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid response from verification service',
          details: responseText.substring(0, 200) // First 200 chars for debugging
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('[ADMIN] Verification service error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Verification service failed' },
        { status: response.status }
      );
    }

    const processingDuration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      verification_id: result.verification_id,
      verification: result.verification,
      processing_time_ms: processingDuration,
    });
  } catch (error: any) {
    console.error('Admin verification proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
