/**
 * GET /api/notifications
 * Fetch all notifications for the authenticated candidate
 *
 * 80% provided - Candidates implement service call (20%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getUserNotifications } from '@/lib/notifications.service';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  // ====== AUTH BOILERPLATE (FULLY PROVIDED) ======
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // This is intentionally empty for server-side reading
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get candidate schema name from candidates table
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('candidates')
    .select('provisioned_schema_name')
    .eq('email', user.email)
    .single();

  if (candidateError || !candidate?.provisioned_schema_name) {
    return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
  }
  // ===============================================

  // TODO: Call getUserNotifications with the candidate's schema name
  // Hint: const result = await getUserNotifications(candidate.provisioned_schema_name);
  const result = await getUserNotifications(candidate.provisioned_schema_name);

  // TODO: Return the result as JSON
  // Hint: return NextResponse.json(result);
  return NextResponse.json(result);
}
