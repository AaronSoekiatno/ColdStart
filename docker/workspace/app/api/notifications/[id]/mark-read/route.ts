/**
 * POST /api/notifications/[id]/mark-read
 * Mark a notification as read
 *
 * 80% provided - Candidates implement service call (20%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { markNotificationAsRead } from '@/lib/notifications.service';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Get notification ID from URL params
  const { id } = await params;

  // TODO: Call markNotificationAsRead with schema name and notification ID
  // Hint: const result = await markNotificationAsRead(candidate.provisioned_schema_name, id);
  const result = await markNotificationAsRead(candidate.provisioned_schema_name, id);

  // TODO: Return the result as JSON
  // Hint: return NextResponse.json(result);
  return NextResponse.json(result);
}
