import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getResumesForCandidate, getCandidate, isSubscribed, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { ResumeList } from '@/components/features/resumes/ResumeList';
import { ResumePageContent } from '@/components/features/resumes/ResumePageContent';

export default async function ResumePage() {
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
      setAll() { },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?signup=true&redirect=/resumes`);
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase service role key is not configured.');
  }

  // Store in const so TypeScript knows it's not null
  const adminClient = supabaseAdmin;

  // Get candidate info to find resumes
  let candidate = await getCandidate(user.email ?? '');

  // If candidate not found immediately, retry with exponential backoff
  // This handles database replication delays after onboarding
  if (!candidate) {
    await new Promise(resolve => setTimeout(resolve, 500));
    candidate = await getCandidate(user.email ?? '');
  }

  if (!candidate) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    candidate = await getCandidate(user.email ?? '');
  }

  // If still no candidate after retries, redirect to onboarding instead of home
  // This prevents redirect loops
  if (!candidate) {
    redirect('/onboarding');
  }

  // Check if user is premium
  const isPremium = isSubscribed(candidate);

  // Check if user is a new sign-up (created within last 7 days)
  const isNewUser = candidate.created_at
    ? (Date.now() - new Date(candidate.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  // Get all active resumes for this candidate
  const resumes = await getResumesForCandidate(candidate.id);

  // Get the primary resume to identify which one is current
  const primaryResume = await getPrimaryResumeForCandidate(candidate.id);
  const primaryResumeId = primaryResume?.id;

  // Generate signed URLs for all resumes
  // Note: We don't use the download parameter here because we want inline preview
  // The original filename is preserved in the database and displayed in the UI
  const resumesWithUrls = await Promise.all(
    resumes.map(async (resume) => {
      let resumeUrl: string | null = null;
      if (resume.resume_path) {
        // Use proxy API with cache busting to reduce egress
        // Include updated_at timestamp to invalidate cache when resume changes
        const timestamp = resume.updated_at
          ? new Date(resume.updated_at).getTime()
          : Date.now();

        resumeUrl = `/api/resumes/proxy?path=${encodeURIComponent(resume.resume_path)}&v=${timestamp}`;
      }
      return {
        ...resume,
        resumeUrl,
        fileName: resume.file_name || 'resume.pdf', // Original filename from database
      };
    })
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />

      <main className="container mx-auto px-3 sm:px-4 pt-16 sm:pt-20 md:pt-24 lg:pt-32 pb-4 sm:pb-6 max-w-6xl">
        <ResumePageContent
          resumes={resumesWithUrls.map((resume) => ({
            id: resume.id,
            fileName: resume.fileName,
            resumeUrl: resume.resumeUrl || null,
            name: resume.name,
            isPrimary: resume.id === primaryResumeId,
            // Consider a resume "enhanced" if it has been explicitly marked in the resumes table
            hasEnhancedVersion: !!(resume as any).has_been_enhanced,
          }))}
          isPremium={isPremium}
          isNewUser={isNewUser}
          primaryResumeId={primaryResumeId || undefined}
        />
      </main>
    </div>
  );
}

