import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const offset = (page - 1) * limit;

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

    // Get candidate ID
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id);

    // Get paginated matches ordered by score descending
    const { data: rawMatches, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, score, matched_at, startup_id')
      .eq('candidate_id', candidate.id)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchError) {
      return NextResponse.json(
        { error: `Failed to load matches: ${matchError.message}` },
        { status: 500 }
      );
    }

    if (!rawMatches || rawMatches.length === 0) {
      return NextResponse.json({
        matches: [],
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasMore: false,
        },
      });
    }

    // Get startup IDs
    const startupIds = Array.from(
      new Set(
        rawMatches
          .map((m) => m.startup_id)
          .filter((id): id is string => !!id)
      )
    );

    // Load startup data
    let startupsById: Record<
      string,
      {
        id: string;
        name: string;
        industry: string;
        location: string;
        yc_description?: string;
        team_size?: string;
        funding_stage: string;
        funding_amount: string;
        tags: string;
        website: string;
        founder_emails?: string;
        founder_names?: string;
        founder_linkedin?: string;
        founder_twitter_urls?: string;
        founder_backgrounds?: string;
        founders_pfp?: string;
        batch?: string;
        description?: string;
        company_logo?: string;
        yc_link?: string;
        company_twitter_url?: string;
        founders?: Array<{
          id: string;
          name: string;
          email?: string;
          role?: string;
          linkedin_url?: string;
          twitter_url?: string;
          background?: string;
          profile_picture?: string;
        }>;
      }
    > = {};

    if (startupIds.length > 0) {
      const { data: startupRows, error: startupsError } = await supabaseAdmin
        .from('startups')
        .select('*')
        .in('id', startupIds);

      if (!startupsError && startupRows) {
        // Fetch founders from founders table for all startups
        const { data: foundersRows, error: foundersError } = await supabaseAdmin
          .from('founders')
          .select('id, startup_id, name, email, role, linkedin_url, twitter_url, background')
          .in('startup_id', startupIds)
          .order('created_at', { ascending: true });

        // Group founders by startup_id and map profile pictures
        const foundersByStartupId: Record<string, Array<{
          id: string;
          name: string;
          email?: string;
          role?: string;
          linkedin_url?: string;
          twitter_url?: string;
          background?: string;
          profile_picture?: string;
        }>> = {};

        if (!foundersError && foundersRows) {
          for (const founder of foundersRows) {
            if (!foundersByStartupId[founder.startup_id]) {
              foundersByStartupId[founder.startup_id] = [];
            }
            foundersByStartupId[founder.startup_id].push({
              id: founder.id,
              name: founder.name,
              email: founder.email ?? undefined,
              role: founder.role ?? undefined,
              linkedin_url: founder.linkedin_url ?? undefined,
              twitter_url: founder.twitter_url ?? undefined,
              background: founder.background ?? undefined,
              // profile_picture will be mapped below from founders_pfp array
            });
          }
        }

        for (const s of startupRows) {
          // Parse founders_pfp array (could be array or comma-separated string)
          const foundersPfpArray: string[] = s.founders_pfp
            ? Array.isArray(s.founders_pfp)
              ? s.founders_pfp.map((url: any) => String(url).trim()).filter((url: string) => url && url !== '')
              : String(s.founders_pfp).split(',').map((url: string) => url.trim()).filter((url: string) => url && url !== '')
            : [];

          // Map profile pictures to founders by index
          const founders = foundersByStartupId[s.id] || [];
          const foundersWithPfp = founders.map((founder, index) => ({
            ...founder,
            profile_picture: foundersPfpArray[index] || undefined,
          }));

          startupsById[s.id] = {
            id: s.id,
            name: s.name,
            industry: s.industry || '',
            location: s.location || '',
            yc_description: s.yc_description ?? undefined,
            team_size: s.team_size ?? undefined,
            funding_stage: s.funding_stage || '',
            funding_amount: s.funding_amount || '',
            tags: s.tags || '',
            website: s.website || '',
            founder_emails: s.founder_emails ?? undefined,
            founder_names: s.founder_names ?? undefined,
            founder_linkedin: s.founder_linkedin ?? undefined,
            founder_twitter_urls: s.founder_twitter_urls ?? undefined,
            founder_backgrounds: s.founder_backgrounds ?? undefined,
            founders_pfp: s.founders_pfp ?? undefined,
            batch: s.batch ?? undefined,
            description: s.description ?? undefined,
            company_logo: s.company_logo ?? undefined,
            yc_link: s.yc_link ?? undefined,
            company_twitter_url: s.company_twitter_url ?? undefined,
            founders: foundersWithPfp,
          };
        }
      }
    }

    // Join matches with startup data
    const matches = rawMatches.map((m) => ({
      id: m.id,
      score: m.score,
      matched_at: m.matched_at,
      startup: startupsById[m.startup_id] ?? null,
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      matches,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

