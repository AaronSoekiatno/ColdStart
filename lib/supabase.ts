import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { normalizeName, normalizeEducationLevel, normalizeUniversityName } from './normalize-candidate-data';

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
  skills: string; // Comma-separated string
  location?: string;
  education_level?: string;
  university?: string;
  experience?: string; // Comma-separated string
  technical_projects?: string; // Comma-separated string
  objectives?: string[]; // Array of objectives selected during onboarding
  job_type?: 'full-time' | 'part-time' | 'internship'; // Preferred job type
  role_type?: string[]; // Preferred role types (array) (PM, SWE, SDE, ML, AI, etc.)
  years_of_experience?: string; // Years of experience (e.g., "1-2", "2-5")
  onboarding_completed?: boolean; // Whether user has completed onboarding
  resume_path?: string; // Path to resume file in Supabase Storage (DEPRECATED - use resumes table)
  resume_full_text?: string; // Full extracted text content from resume (DEPRECATED - use resumes table)
  resume_latex?: string; // LaTeX source code generated from resume
  structured_resume_data?: any; // JSON structured resume data (StructuredResumeData)
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
  structured_data?: any; // Structured resume data (StructuredResumeData) for template-based editing
  is_active?: boolean; // Whether this resume is active/available for use
  is_primary?: boolean; // Whether this resume is the primary/current resume for email generation
  created_at?: string;
  updated_at?: string;
}

/**
 * Check if a candidate has an active premium subscription
 * This function checks the candidates table subscription_tier and subscription_status fields
 * @param candidate - Candidate data with subscription fields from candidates table
 * @returns true if the candidate has an active premium subscription
 */
export function isSubscribed(candidate: {
  subscription_tier?: 'free' | 'premium';
  subscription_status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
}): boolean {
  const isPremium = (
    candidate.subscription_tier === 'premium' &&
    (candidate.subscription_status === 'active' || candidate.subscription_status === 'trialing')
  );
  
  // Log for debugging subscription issues
  if (candidate.subscription_tier === 'premium' && !isPremium) {
    console.warn(`[isSubscribed] Premium tier detected but status is not active/trialing:`, {
      subscription_tier: candidate.subscription_tier,
      subscription_status: candidate.subscription_status,
      result: isPremium
    });
  }
  
  return isPremium;
}

/**
 * Save or update a candidate in Supabase
 * @param candidate - Candidate data
 * @returns The saved candidate record with UUID id
 */
export async function saveCandidate(candidate: Partial<CandidateRow> & { email: string; name: string; skills: string }): Promise<CandidateRow> {
  const client = supabaseAdmin || supabase;

  // Normalize fields before saving
  const normalizedName = normalizeName(candidate.name);
  const normalizedEducationLevel = normalizeEducationLevel(candidate.education_level);
  const normalizedUniversity = normalizeUniversityName(candidate.university);

  const upsertData = {
    email: candidate.email,
    name: normalizedName || candidate.name, // Fallback to original if normalization returns null
    skills: candidate.skills,
    location: candidate.location,
    education_level: normalizedEducationLevel,
    university: normalizedUniversity,
    experience: candidate.experience,
    technical_projects: candidate.technical_projects,
    objectives: candidate.objectives,
    job_type: candidate.job_type,
    role_type: candidate.role_type,
    years_of_experience: candidate.years_of_experience,
    onboarding_completed: candidate.onboarding_completed,
    // resume_path and resume_full_text are deprecated; full text now lives in the resumes table.
    // Keep these fields untouched to prepare for dropping them from the schema.
    resume_latex: candidate.resume_latex,
    structured_resume_data: candidate.structured_resume_data,
    created_at: candidate.created_at || new Date().toISOString(),
  };

  console.log('[saveCandidate] Upserting candidate with structured_resume_data:', {
    email: upsertData.email,
    name: upsertData.name,
    has_structured_resume_data: !!upsertData.structured_resume_data,
    structured_resume_data_keys: upsertData.structured_resume_data ? Object.keys(upsertData.structured_resume_data) : [],
  });

  const { data, error } = await client
    .from('candidates')
    .upsert(upsertData, {
      onConflict: 'email',
    })
    .select()
    .single();

  if (error) {
    console.error('[saveCandidate] Error upserting candidate:', error);
    throw new Error(`Failed to save candidate: ${error.message}`);
  }

  console.log('[saveCandidate] Successfully upserted candidate:', {
    id: data.id,
    email: data.email,
    has_structured_resume_data: !!data.structured_resume_data,
  });

  return data as CandidateRow;
}

/**
 * Get a candidate by email
 * Explicitly selects subscription_tier and subscription_status from candidates table
 * Excludes large text fields (structured_resume_data, resume_latex) to reduce egress
 */
export async function getCandidate(email: string) {
  const client = supabaseAdmin || supabase;
  
  const { data, error } = await client
    .from('candidates')
    .select(`
      id,
      email,
      name,
      skills,
      location,
      education_level,
      university,
      experience,
      technical_projects,
      objectives,
      job_type,
      role_type,
      years_of_experience,
      onboarding_completed,
      subscription_tier,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_current_period_end,
      created_at
    `)
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
  keywords: string; // Tags/keywords for the startup (matches actual DB column)
  founder_emails?: string;
  founder_names?: string;
  founder_linkedin?: string;
  batch?: string;
  date_raised?: string;
  created_at?: string;
  // Additional YC-specific fields
  yc_link?: string;
  company_logo?: string;
  business_type?: string;
  team_size?: string;
  hiring_roles?: string; // Active job postings with descriptions
  round_type?: string;
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
    .from('startups3')
    .select('*')
    .eq('id', startup.id)
    .single();

  // If there's an error fetching and it's not "not found", throw it
  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to check existing startup: ${fetchError.message}`);
  }

  // Build the data object, merging with existing data to preserve founder info
  // Note: startups3 doesn't have 'round_type' column, so we skip it
  const dataToInsert: any = {
    id: startup.id,
    // Use provided values, or fall back to existing, or use defaults
    name: startup.name || existing?.name || 'Unknown',
    industry: startup.industry !== undefined ? startup.industry : (existing?.industry || ''),
    description: startup.description !== undefined ? startup.description : (existing?.description || ''),
    // Skip round_type - startups3 table doesn't have this column
    funding_amount: startup.funding_amount !== undefined ? startup.funding_amount : (existing?.funding_amount || ''),
    location: startup.location !== undefined ? startup.location : (existing?.location || ''),
    website: startup.website !== undefined ? startup.website : (existing?.website || ''),
    keywords: startup.keywords !== undefined ? startup.keywords : (existing?.keywords || ''),
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
    .from('startups3')
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
    .from('startups3')
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
    .from('startups3')
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
    .from('startups3')
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

  // Batch queries in chunks to avoid overwhelming Supabase
  // Process 20 startups at a time to prevent connection timeouts
  const BATCH_SIZE = 20;
  const batches: string[][] = [];
  
  for (let i = 0; i < validNames.length; i += BATCH_SIZE) {
    batches.push(validNames.slice(i, i + BATCH_SIZE));
  }

  // Process batches sequentially, but queries within each batch in parallel
  for (const batch of batches) {
    const lookupPromises = batch.map(async (name) => {
      try {
        // Add timeout wrapper to prevent hanging queries
        const timeoutPromise = new Promise<{ name: string; id: null }>((resolve) => {
          setTimeout(() => resolve({ name, id: null }), 5000); // 5 second timeout per query
        });

        const queryPromise = findStartupIdByName(name).then(id => ({ name, id }));
        
        const result = await Promise.race([queryPromise, timeoutPromise]);
        return result;
      } catch (error) {
        // Silently handle errors - don't log every timeout to avoid spam
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!errorMessage.includes('timeout') && !errorMessage.includes('ECONNRESET') && !errorMessage.includes('disconnect')) {
          console.warn(`Error looking up startup "${name}":`, errorMessage);
        }
        return { name, id: null };
      }
    });

    const batchResults = await Promise.allSettled(lookupPromises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.id) {
        resultMap.set(result.value.name, result.value.id);
      }
    });

    // Small delay between batches to avoid overwhelming Supabase
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

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

  // Filter out duplicate startup_ids to prevent constraint violations
  const uniqueMatches = matches.reduce((acc, match) => {
    const exists = acc.find(m => m.startup_id === match.startup_id);
    if (!exists) {
      acc.push(match);
    }
    return acc;
  }, [] as Array<{ startup_id: string; score: number }>);

  // Now insert the new matches
  const matchRows = uniqueMatches.map((match) => ({
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
    .select('id, candidate_id, name, file_name, resume_path, is_active, is_primary, updated_at, created_at')
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
  structured_data?: any; // Structured resume data (JSONB) for template-based editing
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

  const insertData = {
    ...resume,
    is_active: resume.is_active !== undefined ? resume.is_active : true, // Default to active
    is_primary: resume.is_primary !== undefined ? resume.is_primary : false, // Default to false
  };

  console.log('[createResume] Inserting resume data:', {
    candidate_id: insertData.candidate_id,
    name: insertData.name,
    file_name: insertData.file_name,
    resume_path: insertData.resume_path,
    resume_path_defined: insertData.resume_path !== undefined,
    resume_path_null: insertData.resume_path === null,
    is_active: insertData.is_active,
    is_primary: insertData.is_primary,
  });

  const { data, error } = await supabaseAdmin
    .from('resumes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[createResume] Error inserting resume:', error);
    throw new Error(`Failed to create resume: ${error.message}`);
  }

  console.log('[createResume] Successfully inserted resume:', data);

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
  structured_data: any; // Structured resume data (JSONB) for template-based editing
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
    .select('id, candidate_id, name, file_name, resume_path, resume_full_text, structured_data, is_active, is_primary, updated_at, created_at')
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
    .select('id, candidate_id, name, file_name, resume_path, resume_full_text, structured_data, is_active, is_primary, updated_at, created_at')
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
    .select('id, candidate_id, name, file_name, resume_path, resume_full_text, structured_data, is_active, is_primary, updated_at, created_at')
    .eq('candidate_id', candidateId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get primary resume: ${error.message}`);
  }

  return data;
}

// ==================== JOB FUNCTIONS ====================

export interface JobRow {
  id?: number; // BigInt primary key
  startup_id: string; // Foreign key to startups.id
  company_name: string;
  job_title: string;
  job_type: string; // 'fulltime', 'contract', 'internship', etc.
  location?: string;
  job_role?: string;
  posted_date?: string;
  job_url?: string;
  company_batch?: string;
  salary_range?: string;
  skills?: string;
  experience_level?: string;
  full_description?: string;
  created_at?: string;
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
