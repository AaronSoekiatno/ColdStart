import { NextRequest, NextResponse } from 'next/server';
import { fetchAshbyJobs } from '@/lib/ashby-jobs';
import { getStartup } from '@/lib/supabase';

/**
 * GET /api/startups/[id]/jobs
 *
 * Fetch job postings for a startup from their Ashby job board
 *
 * Query params:
 *   - slug (optional): Ashby slug if known (skips auto-detection)
 *
 * Example:
 *   GET /api/startups/123/jobs
 *   GET /api/startups/123/jobs?slug=firecrawl
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const startupId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const providedSlug = searchParams.get('slug') || undefined;

    // Fetch startup info
    const startup = await getStartup(startupId);

    if (!startup) {
      return NextResponse.json(
        { error: 'Startup not found' },
        { status: 404 }
      );
    }

    // Fetch jobs from Ashby
    const result = await fetchAshbyJobs(startup.name, providedSlug);

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          companyName: result.companyName,
          jobs: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      companyName: result.companyName,
      companySlug: result.companySlug,
      jobs: result.jobs,
      jobCount: result.jobs.length,
    });
  } catch (error) {
    console.error('Error fetching startup jobs:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
      },
      { status: 500 }
    );
  }
}
