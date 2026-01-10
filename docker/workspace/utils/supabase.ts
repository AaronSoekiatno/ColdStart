import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Get candidate-specific Supabase client with schema "jailing"
 * 
 * Uses explicit schema selection via the .schema() method to "jail" queries
 * to the candidate's specific schema. This approach is robust against connection
 * pooling (like Supavisor) since it doesn't rely on session-level search_path.
 * 
 * When using this client, always call .schema(schemaName) before .from() to
 * ensure queries target the correct candidate schema.
 * 
 * The candidate can still access public schema tables by using .schema('public')
 * before querying reference data like viral_benchmarks.
 * 
 * @param candidateId - The candidate identifier (e.g., "aidan")
 * @returns Object with Supabase client and schema name for explicit schema selection
 */
export async function getCandidateSupabaseClient(candidateId: string): Promise<{
  client: SupabaseClient;
  schemaName: string;
}> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_PRIVATE_KEY must be set in environment variables"
    );
  }

  // Generate schema name: sandbox_{candidate_id}
  const schemaName = `sandbox_${candidateId.toLowerCase().replace(/-/g, "_")}`;

  // Create Supabase client ready for schema-switching
  // No session-level search_path needed - we use explicit .schema() calls
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return { client, schemaName };
}

/**
 * Get public Supabase client for shared reference data
 * Used for reading viral_benchmarks, global_templates, etc.
 * 
 * Note: Use schema-qualified table names: `public.viral_benchmarks`
 */
export function getPublicSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_PRIVATE_KEY must be set in environment variables"
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Ensure candidate schema exists
 * Creates the schema and tables if they don't exist
 */
export async function ensureCandidateSchema(
  candidateId: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_PRIVATE_KEY must be set in environment variables"
    );
  }

  // Use admin client to create schema
  const adminClient = createClient(supabaseUrl, supabaseKey);

  // Call the create_candidate_schema function
  const { data, error } = await adminClient.rpc("create_candidate_schema", {
    candidate_id: candidateId,
  });

  if (error) {
    // If schema already exists, that's fine
    if (error.message.includes("already exists")) {
      return `sandbox_${candidateId.toLowerCase().replace(/-/g, "_")}`;
    }
    throw error;
  }

  return data || `sandbox_${candidateId.toLowerCase().replace(/-/g, "_")}`;
}

/**
 * Extract candidate ID from request
 * Checks headers, query params, or environment variable
 */
export function getCandidateIdFromRequest(
  req: Request
): string | null {
  // Try to get from X-Candidate-Id header (set by proxy/middleware)
  const headerCandidateId = req.headers.get("x-candidate-id");
  if (headerCandidateId) {
    return headerCandidateId;
  }

  // Try to get from query parameter
  const url = new URL(req.url);
  const queryCandidateId = url.searchParams.get("candidate_id");
  if (queryCandidateId) {
    return queryCandidateId;
  }

  // Fallback to environment variable (for development/testing)
  const envCandidateId = process.env.CANDIDATE_ID;
  if (envCandidateId) {
    return envCandidateId;
  }

  return null;
}

