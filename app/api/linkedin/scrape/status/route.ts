import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  getCandidate,
  updateLinkedInScrapeJob,
  updateLinkedInImport,
  createFounderConnections,
  matchConnectionToCandidate,
  type FounderConnectionRow,
} from '@/lib/supabase';
import {
  checkScrapeStatus,
  fetchScrapeOutput,
  type LinkedInConnectionData,
} from '@/lib/phantombuster';

/**
 * GET /api/linkedin/scrape/status?jobId=xxx
 * Check the status of a LinkedIn scraping job
 * When complete, automatically processes and stores the results
 */
export async function GET(request: NextRequest) {
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

    // Get job ID from query params
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter.' },
        { status: 400 }
      );
    }

    // Fetch scrape job from database
    const { data: scrapeJob, error: jobError } = await supabase
      .from('linkedin_scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', candidate.id)
      .single();

    if (jobError || !scrapeJob) {
      return NextResponse.json(
        { error: 'Scrape job not found.' },
        { status: 404 }
      );
    }

    // If job already completed or failed, return cached status
    if (scrapeJob.status === 'success' || scrapeJob.status === 'failed') {
      return NextResponse.json({
        success: true,
        status: scrapeJob.status,
        progress: scrapeJob.progress || 100,
        error: scrapeJob.error_message,
      });
    }

    // Check PhantomBuster status
    const pbStatus = await checkScrapeStatus(scrapeJob.phantombuster_container_id);

    // Update job progress
    await updateLinkedInScrapeJob(jobId, {
      progress: pbStatus.progress || scrapeJob.progress,
    });

    // If still running, return current status
    if (pbStatus.status === 'running') {
      return NextResponse.json({
        success: true,
        status: 'running',
        progress: pbStatus.progress || 0,
        message: 'Scraping in progress...',
      });
    }

    // If failed, update job and return error
    if (pbStatus.status === 'error') {
      await updateLinkedInScrapeJob(jobId, {
        status: 'failed',
        error_message: pbStatus.message || 'Scraping failed',
        completed_at: new Date().toISOString(),
      });

      // Also update the import record
      const { data: importRecord } = await supabase
        .from('linkedin_imports')
        .select('id')
        .eq('user_id', candidate.id)
        .eq('method', 'api')
        .eq('status', 'processing')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single();

      if (importRecord) {
        await updateLinkedInImport(importRecord.id, {
          status: 'failed',
          error_message: pbStatus.message || 'Scraping failed',
          completed_at: new Date().toISOString(),
        });
      }

      // Return error with fallback suggestion
      return NextResponse.json({
        success: false,
        status: 'failed',
        error: pbStatus.message || 'Scraping failed',
        fallback: {
          method: 'csv',
          title: 'Try Manual Upload Instead',
          description: '100% reliable, takes 10 minutes',
          ctaUrl: '/linkedin/csv-upload',
        },
      }, { status: 200 }); // Still 200 because the request itself succeeded
    }

    // If success, fetch results and process them
    if (pbStatus.status === 'success') {
      const { data: connections, error: fetchError } = await fetchScrapeOutput(
        scrapeJob.phantombuster_container_id
      );

      if (fetchError || !connections) {
        await updateLinkedInScrapeJob(jobId, {
          status: 'failed',
          error_message: fetchError || 'Failed to fetch results',
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          success: false,
          status: 'failed',
          error: fetchError || 'Failed to fetch results',
        }, { status: 500 });
      }

      // Process and store connections
      const processedConnections = await processConnections(
        connections,
        candidate.id,
        supabase
      );

      // Update scrape job as complete
      await updateLinkedInScrapeJob(jobId, {
        status: 'success',
        progress: 100,
        completed_at: new Date().toISOString(),
      });

      // Update import record
      const { data: importRecord } = await supabase
        .from('linkedin_imports')
        .select('id')
        .eq('user_id', candidate.id)
        .eq('method', 'api')
        .eq('status', 'processing')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single();

      if (importRecord) {
        await updateLinkedInImport(importRecord.id, {
          status: 'complete',
          total_connections: connections.length,
          matched_connections: processedConnections.matchedCount,
          completed_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        progress: 100,
        totalConnections: connections.length,
        matchedConnections: processedConnections.matchedCount,
        message: `Successfully imported ${connections.length} connections. Found ${processedConnections.matchedCount} matches.`,
      });
    }

    // Unknown status
    return NextResponse.json({
      success: true,
      status: 'unknown',
      progress: 0,
    });
  } catch (error) {
    console.error('Error checking scrape status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check scrape status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Process PhantomBuster connections and store in database
 */
async function processConnections(
  pbConnections: LinkedInConnectionData[],
  userId: string,
  supabase: any
): Promise<{ matchedCount: number }> {
  // Find the most recent import for this user
  const { data: importRecord } = await supabase
    .from('linkedin_imports')
    .select('id')
    .eq('user_id', userId)
    .eq('method', 'api')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  const importId = importRecord?.id;

  const connections: FounderConnectionRow[] = [];
  let matchedCount = 0;

  for (const pbConn of pbConnections) {
    // Parse name
    const nameParts = pbConn.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const connection: FounderConnectionRow = {
      import_id: importId,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email: pbConn.email || undefined,
      company: pbConn.company || undefined,
      position: pbConn.jobTitle || undefined,
      profile_url: pbConn.profileUrl || undefined,
      connected_date: pbConn.connectedDate || undefined,
    };

    // Try to match to Hermes candidate
    const matchResult = await matchConnectionToCandidate({
      email: connection.email,
      first_name: connection.first_name,
      last_name: connection.last_name,
      company: connection.company,
      position: connection.position,
    });

    if (matchResult.candidate) {
      connection.matched_candidate_id = matchResult.candidate.id;
      connection.match_confidence = matchResult.confidence;
      connection.match_method = matchResult.method as 'email' | 'name_company' | 'name_school';
      matchedCount++;
    }

    connections.push(connection);
  }

  // Bulk insert all connections
  await createFounderConnections(connections);

  return { matchedCount };
}
