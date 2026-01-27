import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate admin
    await requireAdmin();

    // 2. Get all candidates with optional filters
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const jobType = searchParams.get('job_type');
    const exp = searchParams.get('exp');
    const university = searchParams.get('university');
    const verifiedOnly = searchParams.get('verified') === 'true';

    let allCandidates: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseAdmin
        .from('candidates')
        .select('id, name, email, github_username, github_connected_at, created_at, role_type, job_type, years_of_experience, university')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      if (role) {
        query = query.contains('role_type', [role]);
      }

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      if (exp) {
        query = query.ilike('years_of_experience', `%${exp}%`);
      }

      if (university) {
        query = query.ilike('university', `%${university}%`);
      }

      if (verifiedOnly) {
        query = query.not('github_username', 'is', null);
      }

      const { data, error } = await query;
      
      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allCandidates = [...allCandidates, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const candidates = allCandidates;
    const candidatesError = null;
    
    if (candidatesError) {
      throw candidatesError;
    }

    // 3. Get latest analysis for each candidate (using code analyses instead of missing verifications table)
    const candidateIds = candidates?.map(c => c.id) || [];

    if (candidateIds.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    // Attempt to fetch code analyses as a proxy for "verification"
    // If this table is also missing, we'll gracefully handle it
    let codeAnalyses: any[] = [];
    try {
        // Chunk requests for analyses to avoid hitting limits
        const chunkSize = 200; // conservative batch size for URL param length
        for (let i = 0; i < candidateIds.length; i += chunkSize) {
            const chunk = candidateIds.slice(i, i + chunkSize);
            const { data, error } = await supabaseAdmin
                .from('github_code_analyses')
                .select('candidate_id, overall_score, created_at')
                .in('candidate_id', chunk)
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                codeAnalyses.push(...data);
            }
        }
    } catch (e) {
        console.warn('Could not fetch github_code_analyses, proceeding without scores');
    }

    // 4. Create a map of candidate_id -> average score
    const scoreMap = new Map();
    for (const analysis of codeAnalyses) {
        if (!scoreMap.has(analysis.candidate_id)) {
            scoreMap.set(analysis.candidate_id, {
                score: analysis.overall_score,
                verified_at: analysis.created_at
            });
        }
    }

    // 5. Combine data
    const minScore = searchParams.get('min_score') ? parseInt(searchParams.get('min_score')!) : null;

    let result = candidates?.map(candidate => {
      const analysis = scoreMap.get(candidate.id);

      return {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        github_username: candidate.github_username,
        github_connected_at: candidate.github_connected_at,
        created_at: candidate.created_at,
        has_verification: !!candidate.github_username, // Verified means they have connected GitHub
        latest_score: analysis?.score || null,
        verification_status: analysis ? 'analyzed' : null,
        verified_at: candidate.github_connected_at || analysis?.verified_at || null,
        // Include new fields for debugging/display if needed
        role_type: candidate.role_type,
        job_type: candidate.job_type, 
        years_of_experience: candidate.years_of_experience,
        university: candidate.university
      };
    }) || [];

    // Apply post-query filters (score only now)
    if (minScore !== null) {
      result = result.filter(c => (c.latest_score || 0) >= minScore);
    }

    return NextResponse.json({ candidates: result });
  } catch (error: any) {
    console.error('Get candidates error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
