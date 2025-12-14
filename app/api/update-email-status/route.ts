import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase environment variables are not configured.' },
        { status: 500 }
      );
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
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase service role key is not configured.' },
        { status: 500 }
      );
    }

    // Get request body
    const body = await request.json();
    const { emailId, status, archived } = body;

    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required.' },
        { status: 400 }
      );
    }

    // Get the candidate's UUID by email
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found.' },
        { status: 404 }
      );
    }

    // Verify that this email belongs to this candidate
    const { data: emailRecord, error: emailCheckError } = await supabaseAdmin
      .from('sent_emails')
      .select('id')
      .eq('id', emailId)
      .eq('candidate_id', candidate.id)
      .single();

    if (emailCheckError || !emailRecord) {
      return NextResponse.json(
        { error: 'Email not found or does not belong to you.' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, any> = {};
    if (status !== undefined) {
      // Validate status
      if (!['sent', 'responded', 'connected'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: sent, responded, connected.' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (archived !== undefined) {
      updateData.archived = archived;
    }

    // Update the email
    const { error: updateError } = await supabaseAdmin
      .from('sent_emails')
      .update(updateData)
      .eq('id', emailId);

    if (updateError) {
      console.error('Failed to update email:', updateError);
      return NextResponse.json(
        { error: 'Failed to update email status.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully.',
    });
  } catch (error) {
    console.error('Update email status error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
