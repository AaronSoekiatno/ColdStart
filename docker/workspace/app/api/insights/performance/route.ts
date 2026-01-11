import { NextRequest, NextResponse } from "next/server";
import { mockPerformanceData, type PerformanceData } from "@/data/insights/seed-data";
import {
  getCandidateSupabaseClient,
  getCandidateIdFromRequest,
  ensureCandidateSchema,
} from "@/utils/supabase";

// Note: Using Node.js runtime instead of edge because Supabase client
// requires Node.js APIs that aren't available in edge runtime
// export const runtime = "edge";

/**
 * GET /api/insights/performance
 * 
 * Fetches performance data for all video scripts from candidate's schema.
 * Uses schema-per-candidate model: each candidate has their own sandbox_{candidate_id} schema.
 * 
 * The search_path "jails" candidates to their schema, so queries like
 * "SELECT * FROM video_scripts" only see their own data, but they can still
 * JOIN against "public.viral_benchmarks" for reference data.
 * 
 * TODO: Candidate - Optimize this query (consider joins and indexes)
 * TODO: Add pagination for large datasets
 * TODO: Add filtering/sorting options
 */
export async function GET(req: NextRequest) {
  try {
    // Use Supabase if configured, otherwise use mock data
    const useDatabase =
      process.env.SUPABASE_URL && process.env.SUPABASE_PRIVATE_KEY;

    if (!useDatabase) {
      // Return mock data - no database setup required
      return NextResponse.json(mockPerformanceData, { status: 200 });
    }

    // Get candidate ID from request (header, query param, or env var)
    const candidateId = getCandidateIdFromRequest(req);
    
    if (!candidateId) {
      // No candidate ID provided - return mock data
      return NextResponse.json(mockPerformanceData, { status: 200 });
    }

    // Ensure candidate schema exists (creates it if needed)
    await ensureCandidateSchema(candidateId);

    // Get candidate-specific Supabase client and schema name
    // Uses explicit schema selection to "jail" queries to the candidate's schema
    // This approach is robust against connection pooling (like Supavisor)
    const { client, schemaName } = await getCandidateSupabaseClient(candidateId);

    // TODO: Candidate - Optimize this query - consider using a JOIN instead of separate queries
    // TODO: Consider adding indexes on frequently queried columns
    // 
    // NOTE: Using .schema(schemaName) ensures PostgREST hits the right schema.
    // This bypasses the need for session-level search_path, making it work
    // reliably with connection pooling.
    // 
    // The candidate can still access public schema tables by using .schema('public')
    
    // Fetch all scripts from candidate's schema
    // Using .schema() to explicitly target the candidate's sandbox schema
    const scriptsResponse = await client
      .schema(schemaName)
      .from("video_scripts")
      .select("*")
      .order("created_at", { ascending: false });

    if (scriptsResponse.error) {
      throw scriptsResponse.error;
    }

    const scripts = scriptsResponse.data || [];

    // Fetch all performance logs from candidate's schema
    const logsResponse = await client
      .schema(schemaName)
      .from("performance_logs")
      .select("*")
      .order("logged_at", { ascending: false });

    if (logsResponse.error) {
      throw logsResponse.error;
    }

    const logs = logsResponse.data || [];

    // Combine scripts with their performance data
    // TODO: Candidate - Optimize this join logic
    // Consider: What if a script has multiple performance logs? Should we show the latest? Average?
    const performanceData: PerformanceData[] = scripts.map((script) => {
      const scriptLogs = logs.filter((log) => log.script_id === script.id);
      // For now, use the most recent log
      const latestLog = scriptLogs[0] || {
        views: 0,
        likes: 0,
        shares: 0,
        engagement_rate: 0,
        viral_score: 0,
        logged_at: script.created_at,
      };

      return {
        script_id: script.id,
        title: script.title,
        script_content: script.script_content,
        views: latestLog.views,
        likes: latestLog.likes,
        shares: latestLog.shares,
        engagement_rate: parseFloat(latestLog.engagement_rate) || 0,
        viral_score: parseFloat(latestLog.viral_score) || 0,
        logged_at: latestLog.logged_at || script.created_at,
      };
    });

    // TODO: Candidate - Add proper error handling for edge cases
    // TODO: Candidate - Format response structure (decide on shape)
    return NextResponse.json(performanceData, { status: 200 });
  } catch (error: any) {
    // Fallback to mock data on error
    console.error("Error fetching performance data, using mock data:", error);
    return NextResponse.json(mockPerformanceData, { status: 200 });
  }
}

