import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration
// These environment variables should be set in .env.local
// NEXT_PUBLIC_ prefix is required for client-side access in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Get the Supabase client instance for browser use
 * Uses createBrowserClient to properly handle cookies for SSR
 * Validates environment variables and throws helpful errors if missing
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
      'Please add it to your .env.local file.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
      'Please add it to your .env.local file.'
    );
  }

  // Use createBrowserClient for proper cookie-based session management
  // This ensures sessions are shared between client and server in Next.js
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Initialize Supabase client for browser/client components
// This client properly handles cookies so sessions work across client/server
export const supabase = getSupabaseClient();

// For server-side operations that require elevated permissions,
// you can create a service role client (if needed)
// Note: Service role key should NEVER be exposed to the client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl!, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'coldstart-admin',
        },
      },
    })
  : null;

// ==================== CANDIDATE FUNCTIONS ====================

export interface CandidateRow {
  id?: string; // UUID primary key (auto-generated)
  email: string; // Unique email
  name: string;
  summary: string;
  skills: string; // Comma-separated string
  location?: string;
  education_level?: string;
  university?: string;
  past_internships?: string; // Comma-separated string
  technical_projects?: string; // Comma-separated string
  resume_path?: string; // Path to resume file in Supabase Storage (DEPRECATED - use resumes table)
  resume_full_text?: string; // Full extracted text content from resume (DEPRECATED - use resumes table)
  subscription_tier?: 'free' | 'premium'; // Subscription tier
  stripe_customer_id?: string; // Stripe customer ID
  stripe_subscription_id?: string; // Stripe subscription ID
  subscription_status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'; // Subscription status
  subscription_current_period_end?: string; // ISO timestamp of when subscription period ends
  created_at?: string;
}

export interface ResumeRow {
  id?: string; // UUID primary key (auto-generated)
  candidate_id: string; // Reference to candidates.id
  name: string; // User-defined name for the resume
  file_name: string; // Original uploaded file name
  resume_path?: string; // Path to resume file in Supabase Storage
  resume_full_text?: string; // Full extracted text content from resume
  is_active?: boolean; // Whether this resume is active/available for use
  is_primary?: boolean; // Whether this resume is the primary/current resume for email generation
  created_at?: string;
  updated_at?: string;
}

/**
 * Check if a candidate has an active premium subscription
 * @param candidate - Candidate data with subscription fields
 * @returns true if the candidate has an active premium subscription
 */
export function isSubscribed(candidate: {
  subscription_tier?: 'free' | 'premium';
  subscription_status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
}): boolean {
  return (
    candidate.subscription_tier === 'premium' &&
    (candidate.subscription_status === 'active' || candidate.subscription_status === 'trialing')
  );
}

/**
 * Save or update a candidate in Supabase
 * @param candidate - Candidate data
 * @returns The saved candidate record with UUID id
 */
export async function saveCandidate(candidate: CandidateRow): Promise<{ id: string; email: string; [key: string]: any }> {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('candidates')
    .upsert(
      {
        email: candidate.email,
        name: candidate.name,
        summary: candidate.summary,
        skills: candidate.skills,
        location: candidate.location,
        education_level: candidate.education_level,
        university: candidate.university,
        past_internships: candidate.past_internships,
        technical_projects: candidate.technical_projects,
        resume_path: candidate.resume_path,
        resume_full_text: candidate.resume_full_text,
        created_at: candidate.created_at || new Date().toISOString(),
      },
      {
        onConflict: 'email',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save candidate: ${error.message}`);
  }

  return data;
}

/**
 * Get a candidate by email
 */
export async function getCandidate(email: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('candidates')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get candidate: ${error.message}`);
  }

  return data;
}

// ==================== STARTUP FUNCTIONS ====================

export interface StartupRow {
  id: string; // Primary key (generated from name: lowercase, spaces -> dashes)
  name: string;
  industry: string;
  description: string;
  funding_stage: string;
  funding_amount: string;
  location: string;
  website: string;
  tags: string;
  founder_emails?: string;
  founder_names?: string;
  founder_linkedin?: string;
  batch?: string;
  job_openings?: string;
  date_raised?: string;
  created_at?: string;
}

/**
 * Save or update a startup in Supabase
 * Ensures no duplicates are created and preserves existing founder data
 * @param startup - Startup data
 */
export async function saveStartup(startup: StartupRow) {
  const client = supabaseAdmin || supabase;
  
  // FIRST: Check if startup already exists in Supabase
  const { data: existing, error: fetchError } = await client
    .from('startups')
    .select('*')
    .eq('id', startup.id)
    .single();

  // If there's an error fetching and it's not "not found", throw it
  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to check existing startup: ${fetchError.message}`);
  }

  // Build the data object, merging with existing data to preserve founder info
  const dataToInsert: any = {
    id: startup.id,
    // Use provided values, or fall back to existing, or use defaults
    name: startup.name || existing?.name || 'Unknown',
    industry: startup.industry !== undefined ? startup.industry : (existing?.industry || ''),
    description: startup.description !== undefined ? startup.description : (existing?.description || ''),
    funding_stage: startup.funding_stage !== undefined ? startup.funding_stage : (existing?.funding_stage || ''),
    funding_amount: startup.funding_amount !== undefined ? startup.funding_amount : (existing?.funding_amount || ''),
    location: startup.location !== undefined ? startup.location : (existing?.location || ''),
    website: startup.website !== undefined ? startup.website : (existing?.website || ''),
    tags: startup.tags !== undefined ? startup.tags : (existing?.tags || ''),
    created_at: startup.created_at || existing?.created_at || new Date().toISOString(),
  };

  // Preserve existing founder data if new data isn't explicitly provided
  // This ensures founder emails are never lost when updating from Pinecone matches
  if (startup.founder_emails !== undefined) {
    dataToInsert.founder_emails = startup.founder_emails || null;
  } else if (existing?.founder_emails) {
    // ✅ CRITICAL: Preserve existing founder emails if not provided in update
    dataToInsert.founder_emails = existing.founder_emails;
  } else {
    dataToInsert.founder_emails = null;
  }

  if (startup.founder_names !== undefined) {
    dataToInsert.founder_names = startup.founder_names || null;
  } else if (existing?.founder_names) {
    dataToInsert.founder_names = existing.founder_names;
  } else {
    dataToInsert.founder_names = null;
  }

  if (startup.founder_linkedin !== undefined) {
    dataToInsert.founder_linkedin = startup.founder_linkedin || null;
  } else if (existing?.founder_linkedin) {
    dataToInsert.founder_linkedin = existing.founder_linkedin;
  } else {
    dataToInsert.founder_linkedin = null;
  }
  
  if (startup.batch !== undefined) {
    dataToInsert.batch = startup.batch || null;
  } else if (existing?.batch) {
    dataToInsert.batch = existing.batch;
  } else {
    dataToInsert.batch = null;
  }
  
  if (startup.job_openings !== undefined) {
    dataToInsert.job_openings = startup.job_openings || null;
  } else if (existing?.job_openings) {
    dataToInsert.job_openings = existing.job_openings;
  } else {
    dataToInsert.job_openings = null;
  }
  
  if (startup.date_raised !== undefined) {
    dataToInsert.date_raised = startup.date_raised || null;
  } else if (existing?.date_raised) {
    dataToInsert.date_raised = existing.date_raised;
  } else {
    dataToInsert.date_raised = null;
  }
  
  // Use upsert with onConflict to ensure only one row per startup ID
  // This prevents duplicates and updates existing rows
  const { data, error } = await client
    .from('startups')
    .upsert(dataToInsert, {
      onConflict: 'id',
    })
    .select()
    .single();

  if (error) {
    // If error is about missing column, provide helpful message
    if (error.message.includes('does not exist')) {
      throw new Error(
        `Column missing in Supabase. Please run migration: supabase/migrations/002_add_founder_columns.sql\n` +
        `Original error: ${error.message}`
      );
    }
    throw new Error(`Failed to save startup: ${error.message}`);
  }

  return data;
}

/**
 * Get a startup by ID
 */
export async function getStartup(id: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('startups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get startup: ${error.message}`);
  }

  return data;
}

/**
 * Get a startup by name (case-insensitive)
 */
export async function getStartupByName(name: string) {
  const client = supabaseAdmin || supabase;
  
  // Use case-insensitive search
  const { data, error } = await client
    .from('startups')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get startup: ${error.message}`);
  }

  return data;
}

/**
 * Find or get existing startup by name, returning the Supabase startup ID
 * This ensures we use existing Supabase data instead of creating duplicates
 * @param name - Startup name (case-insensitive match)
 * @returns The existing startup ID if found, null otherwise
 */
export async function findStartupIdByName(name: string): Promise<string | null> {
  const client = supabaseAdmin || supabase;
  
  if (!name || name.trim() === '') {
    return null;
  }

  // Case-insensitive search for existing startup
  const { data, error } = await client
    .from('startups')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.warn(`Error finding startup by name "${name}":`, error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Batch lookup startup IDs by names (optimized for performance)
 * Returns a Map of startup name (normalized) -> startup ID
 * @param names - Array of startup names to look up
 * @returns Map of startup name to ID
 */
export async function findStartupIdsByNames(names: string[]): Promise<Map<string, string>> {
  const client = supabaseAdmin || supabase;
  const resultMap = new Map<string, string>();

  if (!names || names.length === 0) {
    return resultMap;
  }

  // Filter out empty names and normalize
  const validNames = names
    .filter(name => name && name.trim() !== '')
    .map(name => name.trim());

  if (validNames.length === 0) {
    return resultMap;
  }

  // Use parallel individual lookups - much faster than sequential
  // This is still faster than sequential because all queries run in parallel
  // Typical improvement: 100 sequential queries (5-10s) -> 100 parallel queries (<1s)
  const lookupPromises = validNames.map(async (name) => {
    try {
      const id = await findStartupIdByName(name);
      return { name, id };
    } catch (error) {
      console.warn(`Error looking up startup "${name}":`, error instanceof Error ? error.message : 'Unknown error');
      return { name, id: null };
    }
  });

  const results = await Promise.all(lookupPromises);
  
  results.forEach(({ name, id }) => {
    if (id) {
      resultMap.set(name, id);
    }
  });

  return resultMap;
}

// ==================== MATCH FUNCTIONS ====================

export interface MatchRow {
  candidate_id: string; // Foreign key to candidates (email or id)
  startup_id: string; // Foreign key to startups.id
  score: number; // Similarity score (0-1)
  matched_at?: string;
}

/**
 * Save a match between a candidate and startup
 * @param match - Match data
 */
export async function saveMatch(match: MatchRow) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('matches')
    .insert({
      candidate_id: match.candidate_id,
      startup_id: match.startup_id,
      score: match.score,
      matched_at: match.matched_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save match: ${error.message}`);
  }

  return data;
}

/**
 * Save multiple matches for a candidate
 * @param candidateId - Candidate's identifier (email)
 * @param matches - Array of matches with startup_id and score
 */
export async function saveMatches(
  candidateId: string,
  matches: Array<{ startup_id: string; score: number }>
) {
  const client = supabaseAdmin || supabase;

  // Delete all existing matches for this candidate first
  // This ensures we only show the most recent matches from the latest resume upload
  const { error: deleteError } = await client
    .from('matches')
    .delete()
    .eq('candidate_id', candidateId);

  if (deleteError) {
    throw new Error(`Failed to clear old matches: ${deleteError.message}`);
  }

  // Now insert the new matches
  const matchRows = matches.map((match) => ({
    candidate_id: candidateId,
    startup_id: match.startup_id,
    score: match.score,
    matched_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('matches')
    .insert(matchRows)
    .select();

  if (error) {
    throw new Error(`Failed to save matches: ${error.message}`);
  }

  return data;
}

/**
 * Get all matches for a candidate
 */
export async function getCandidateMatches(candidateId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('matches')
    .select(`
      *,
      startup:startups(*)
    `)
    .eq('candidate_id', candidateId)
    .order('score', { ascending: false });

  if (error) {
    throw new Error(`Failed to get matches: ${error.message}`);
  }

  return data;
}

// ==================== RESUME FUNCTIONS ====================

/**
 * Get all resumes for a candidate
 */
export async function getResumesForCandidate(candidateId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('resumes')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get resumes: ${error.message}`);
  }

  return data;
}

/**
 * Get count of active resumes for a candidate (for premium checks)
 */
export async function getResumeCountForCandidate(candidateId: string): Promise<number> {
  const client = supabaseAdmin || supabase;

  const { count, error } = await client
    .from('resumes')
    .select('*', { count: 'exact', head: true })
    .eq('candidate_id', candidateId)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to count resumes: ${error.message}`);
  }

  return count || 0;
}

/**
 * Create a new resume record
 * Note: This function requires the service role client to bypass RLS policies
 */
export async function createResume(resume: {
  candidate_id: string;
  name: string;
  file_name: string;
  resume_path?: string;
  resume_full_text?: string;
  is_active?: boolean;
  is_primary?: boolean;
}) {
  // Always use admin client for server-side operations to bypass RLS
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot create resume without admin access.');
  }

  // If setting as primary, first unset any existing primary resume
  if (resume.is_primary) {
    await supabaseAdmin
      .from('resumes')
      .update({ is_primary: false })
      .eq('candidate_id', resume.candidate_id)
      .eq('is_primary', true);
  }

  const { data, error } = await supabaseAdmin
    .from('resumes')
    .insert({
      ...resume,
      is_active: resume.is_active !== undefined ? resume.is_active : true, // Default to active
      is_primary: resume.is_primary !== undefined ? resume.is_primary : false, // Default to false
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create resume: ${error.message}`);
  }

  return data;
}

/**
 * Update a resume record
 */
export async function updateResume(resumeId: string, updates: Partial<{
  name: string;
  file_name: string;
  resume_path: string;
  resume_full_text: string;
  is_active: boolean;
  is_primary: boolean;
}>) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('resumes')
    .update(updates)
    .eq('id', resumeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update resume: ${error.message}`);
  }

  return data;
}

/**
 * Delete/deactivate a resume
 */
export async function deleteResume(resumeId: string) {
  const client = supabaseAdmin || supabase;

  // Soft delete by setting is_active to false
  const { data, error } = await client
    .from('resumes')
    .update({ is_active: false })
    .eq('id', resumeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to delete resume: ${error.message}`);
  }

  return data;
}

/**
 * Get a specific resume by ID
 */
export async function getResume(resumeId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get resume: ${error.message}`);
  }

  return data;
}

/**
 * Get the most recent active resume for a candidate
 * This is useful for backward compatibility when migrating from candidates.resume_path
 * @param candidateId - Candidate's UUID
 * @returns The most recent active resume, or null if none found
 */
export async function getMostRecentResumeForCandidate(candidateId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('resumes')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get most recent resume: ${error.message}`);
  }

  return data;
}

/**
 * Get the primary (current) resume for a candidate
 * This is the resume that will be used for email generation
 * @param candidateId - Candidate's UUID
 * @returns The primary resume, or null if none found
 */
export async function getPrimaryResumeForCandidate(candidateId: string) {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('resumes')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .eq('is_primary', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No primary resume found, fall back to most recent
      return getMostRecentResumeForCandidate(candidateId);
    }
    throw new Error(`Failed to get primary resume: ${error.message}`);
  }

  return data;
}

/**
 * Set a resume as the primary (current) resume for a candidate
 * This will unset any other primary resume for the same candidate
 * @param candidateId - Candidate's UUID
 * @param resumeId - Resume ID to set as primary
 */
export async function setPrimaryResume(candidateId: string, resumeId: string) {
  // Always use admin client for server-side operations to bypass RLS
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot set primary resume without admin access.');
  }

  // First, unset all primary resumes for this candidate
  const { error: unsetError } = await supabaseAdmin
    .from('resumes')
    .update({ is_primary: false })
    .eq('candidate_id', candidateId)
    .eq('is_primary', true);

  if (unsetError) {
    throw new Error(`Failed to unset existing primary resume: ${unsetError.message}`);
  }

  // Then set the new primary resume
  const { data, error } = await supabaseAdmin
    .from('resumes')
    .update({ is_primary: true })
    .eq('id', resumeId)
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set primary resume: ${error.message}`);
  }

  return data;
}
