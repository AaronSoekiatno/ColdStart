import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * GET /api/provision
 *
 * Provisions credentials for new candidates.
 * Called automatically by yarn postinstall via auto-setup.js in the assessment repo.
 *
 * Returns:
 * - CANDIDATE_ID: Unique identifier for the candidate
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Anon key for prompt logging (safe to distribute, respects RLS)
 */
export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Server not configured: missing Supabase credentials' },
      { status: 500 }
    );
  }

  // Generate a unique candidate ID
  const candidateId = `candidate-${randomUUID()}`;

  return NextResponse.json({
    CANDIDATE_ID: candidateId,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseAnonKey, // Actually the anon key - safe to distribute
  });
}
