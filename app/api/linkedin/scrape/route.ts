import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  getCandidate,
  createLinkedInScrapeJob,
  createLinkedInImport,
} from '@/lib/supabase';
import { launchLinkedInScrape } from '@/lib/phantombuster';

/**
 * POST /api/linkedin/scrape
 * Initiate LinkedIn connection scraping via PhantomBuster API
 *
 * IMPORTANT SECURITY NOTES:
 * - Passwords are NEVER stored in the database
 * - Passwords are encrypted in transit only
 * - Job queue removes data immediately after processing
 */
export async function POST(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate profile not found.' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { linkedinEmail, linkedinPassword } = body;

    if (!linkedinEmail || !linkedinPassword) {
      return NextResponse.json(
        { error: 'LinkedIn email and password are required.' },
        { status: 400 }
      );
    }

    // Check if PhantomBuster API is configured
    if (!process.env.PHANTOMBUSTER_API_KEY) {
      return NextResponse.json(
        {
          error: 'PhantomBuster API not configured. Please use CSV upload method instead.',
          fallbackUrl: '/linkedin/csv-upload'
        },
        { status: 503 }
      );
    }

    // Launch PhantomBuster scrape
    const { containerId, error: launchError } = await launchLinkedInScrape(
      linkedinEmail,
      linkedinPassword
    );

    if (launchError || !containerId) {
      // Suggest fallback to CSV method
      return NextResponse.json(
        {
          error: launchError || 'Failed to launch scraping job',
          fallback: {
            method: 'csv',
            title: 'Try Manual Upload Instead',
            description: '100% reliable, takes 10 minutes',
            ctaUrl: '/linkedin/csv-upload',
          },
        },
        { status: 500 }
      );
    }

    // Create scrape job record
    const scrapeJob = await createLinkedInScrapeJob({
      user_id: candidate.id,
      phantombuster_container_id: containerId,
      status: 'running',
      progress: 0,
    });

    // Create LinkedIn import record
    const linkedInImport = await createLinkedInImport({
      user_id: candidate.id,
      method: 'api',
      status: 'processing',
    });

    // Note: Password is NOT stored anywhere - it was only used transiently above
    // The scraping happens asynchronously via PhantomBuster's servers

    return NextResponse.json({
      success: true,
      jobId: scrapeJob.id,
      importId: linkedInImport.id,
      containerId,
      message: 'Scraping job started. This usually takes 5-10 minutes.',
    });
  } catch (error) {
    console.error('Error initiating LinkedIn scrape:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate scrape',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
