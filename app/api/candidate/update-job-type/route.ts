import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { setCache } from '@/lib/redis-cache';
import { normalizeJobType } from '@/lib/normalize-candidate-data';

export async function POST(request: NextRequest) {
  try {
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

    const { jobType } = await request.json();

    // Normalize the job type to lowercase
    const normalizedJobType = normalizeJobType(jobType);

    if (!normalizedJobType) {
      return NextResponse.json(
        { error: 'Invalid job type. Must be full-time, part-time, or internship' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Update the candidate's job_type
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({ job_type: normalizedJobType })
      .eq('email', user.email);

    if (updateError) {
      console.error('Error updating job type:', updateError);
      return NextResponse.json(
        { error: 'Failed to update job type' },
        { status: 500 }
      );
    }

    // Proactively update cache with fresh data
    const { data: freshCandidate } = await supabaseAdmin
      .from('candidates')
      .select('id, subscription_tier, subscription_status, stripe_customer_id, role_type, job_type, skills')
      .eq('email', user.email)
      .single();

    if (freshCandidate) {
      const cacheKey = `candidate_info:${user.email}`;
      await setCache(cacheKey, freshCandidate, 86400); // 24 hours
      console.log('[Update Job Type] Cache updated proactively:', cacheKey);
    }

    return NextResponse.json({ success: true, jobType: normalizedJobType });
  } catch (error) {
    console.error('Exception updating job type:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
