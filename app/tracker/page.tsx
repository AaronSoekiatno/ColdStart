import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { EmailTrackerClient } from '@/components/EmailTrackerClient';

interface SentEmailRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  match_score: number | null;
  sent_at: string;
  status: 'sent' | 'responded' | 'connected';
  archived: boolean;
  startup: {
    id: string;
    name: string;
    industry: string;
    location: string;
    website: string;
  } | null;
}

export default async function TrackerPage() {
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
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?signup=true&redirect=/tracker`);
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase service role key is not configured.');
  }

  // Get the candidate's UUID by email
  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (!candidate) {
    // No candidate record found, redirect to upload page
    redirect('/?error=no_resume');
  }

  // Load sent emails for this candidate
  const { data: rawSentEmails, error: emailsError } = await supabaseAdmin
    .from('sent_emails')
    .select('id, recipient_email, recipient_name, subject, body, match_score, sent_at, status, archived, startup_id')
    .eq('candidate_id', candidate.id)
    .order('sent_at', { ascending: false });

  if (emailsError) {
    throw new Error(`Failed to load email history: ${emailsError.message}`);
  }

  // Load all referenced startups
  const startupIds = Array.from(
    new Set(
      (rawSentEmails ?? [])
        .map((e) => e.startup_id)
        .filter((id): id is string => !!id)
    )
  );

  let startupsById: Record<string, {
    id: string;
    name: string;
    industry: string;
    location: string;
    website: string;
  }> = {};

  if (startupIds.length > 0) {
    const { data: startupRows, error: startupsError } = await supabaseAdmin
      .from('startups')
      .select('id, name, industry, location, website')
      .in('id', startupIds);

    if (startupsError) {
      throw new Error(`Failed to load startups: ${startupsError.message}`);
    }

    for (const s of startupRows ?? []) {
      startupsById[s.id] = {
        id: s.id,
        name: s.name,
        industry: s.industry,
        location: s.location,
        website: s.website,
      };
    }
  }

  // Join sent emails with startup data
  const sentEmails: SentEmailRecord[] = (rawSentEmails ?? []).map((email) => ({
    id: email.id,
    recipient_email: email.recipient_email,
    recipient_name: email.recipient_name,
    subject: email.subject,
    body: email.body,
    match_score: email.match_score,
    sent_at: email.sent_at,
    status: email.status ?? 'sent',
    archived: email.archived ?? false,
    startup: startupsById[email.startup_id] ?? null,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Email Tracker</h1>
        </div>

        <EmailTrackerClient sentEmails={sentEmails} />
      </main>
    </div>
  );
}

