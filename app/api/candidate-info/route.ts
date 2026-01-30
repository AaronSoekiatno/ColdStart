import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { getCache, setCache } from '@/lib/redis-cache';

/**
 * Wraps a Supabase query with timeout
 */
async function withTimeout<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number = 10000
): Promise<{ data: T | null; error: any }> {
  try {
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const result = await Promise.race([queryFn(), timeoutPromise]);
    return result;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isTimeout = errorMessage.includes('timeout') || 
                     errorMessage.includes('ConnectTimeoutError') ||
                     errorMessage.includes('ECONNRESET');
    
    if (isTimeout) {
      return { 
        data: null, 
        error: { 
          message: 'Database connection timeout', 
          code: 'TIMEOUT',
          isTimeout: true 
        } 
      };
    }
    
    return { data: null, error: error };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Import cookies at runtime (Next.js 15+ requirement)
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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Try Redis cache first (event-driven caching with 24-hour TTL)
    const cacheKey = `candidate_info:${user.email}`;
    const cachedCandidate = await getCache<any>(cacheKey);

    if (cachedCandidate) {
      return NextResponse.json(cachedCandidate, {
        headers: {
          'Cache-Control': 'private, max-age=300',
          'X-Cache-Status': 'HIT',
        },
      });
    }

    // Cache miss - fetch from database
    console.log('[Candidate Info] Cache MISS:', {
      user: user.email,
      cacheKey,
    });

    // Get candidate info from candidates table - explicitly selecting subscription fields
    // Note: experience_level and salary_range are in the jobs table, not candidates table
    // Store in const so TypeScript knows it's not null inside the callback
    const adminClient = supabaseAdmin;
    const candidateResult = await withTimeout(
      async () => {
        const result = await adminClient
          .from('candidates')
          .select('id, subscription_tier, subscription_status, stripe_customer_id, role_type, job_type, skills, beta_access, onboarding_completed, github_username')
          .eq('email', user.email)
          .single();
        return result;
      },
      10000 // 10 second timeout
    );
    
    const { data: candidate, error: candidateError } = candidateResult;

    if (candidateError) {
      // Handle timeout errors
      if (candidateError.isTimeout || candidateError.code === 'TIMEOUT') {
        console.error('[Candidate Info] Timeout fetching candidate:', candidateError);
        return NextResponse.json(
          { 
            error: 'Database connection timeout',
            message: 'Request timed out. Please try again.'
          },
          { status: 504 }
        );
      }
      
      // PGRST116 is "not found" - return 404
      if (candidateError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'Candidate not found',
            message: `No candidate record found for email: ${user.email}. Please complete onboarding first.`
          },
          { status: 404 }
        );
      }
      
      // Other database errors - return 500
      return NextResponse.json(
        { 
          error: 'Database error',
          message: candidateError.message 
        },
        { status: 500 }
      );
    }

    if (!candidate) {
      return NextResponse.json(
        { 
          error: 'Candidate not found',
          message: `No candidate record found for email: ${user.email}`
        },
        { status: 404 }
      );
    }

    // Cache for 24 hours (ultra-static data, updated proactively on events)
    await setCache(cacheKey, candidate, 86400);
    console.log('[Candidate Info] Cached for 24 hours:', {
      user: user.email,
      cacheKey,
    });

    return NextResponse.json(candidate, {
      headers: {
        // Private cache (browser only, not CDN) for 5 minutes
        // User-specific data that doesn't change frequently
        'Cache-Control': 'private, max-age=300',
        'X-Cache-Status': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching candidate info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidate info' },
      { status: 500 }
    );
  }
}

