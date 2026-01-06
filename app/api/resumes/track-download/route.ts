import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getCandidate } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured.');
    }

    const cookieStore = (await cookies()) as Awaited<ReturnType<typeof cookies>>;
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resumeId, downloadType } = await request.json();

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
    }

    // Validate download type
    const validTypes = ['preview', 'enhanced', 'original'];
    if (downloadType && !validTypes.includes(downloadType)) {
      return NextResponse.json({ error: 'Invalid download type' }, { status: 400 });
    }

    // Get candidate
    const candidate = await getCandidate(user.email);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Insert download tracking record
    const { error: insertError } = await supabase
      .from('resume_downloads')
      .insert({
        candidate_id: candidate.id,
        resume_id: resumeId,
        download_type: downloadType || 'original', // Default to 'original' if not specified
      });

    if (insertError) {
      console.error('Error tracking resume download:', insertError);
      return NextResponse.json(
        { error: 'Failed to track download' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resume download tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
