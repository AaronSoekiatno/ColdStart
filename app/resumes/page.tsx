import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getResumesForCandidate, getCandidate, isSubscribed, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { ResumeCard } from '@/components/ResumeCard';

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
      setAll() {},
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

  // Get candidate info to find resumes
  const candidate = await getCandidate(user.email ?? '');
  
  if (!candidate) {
    redirect(`/?signup=true&redirect=/resumes`);
  }

  // Check if user is premium
  const isPremium = isSubscribed(candidate);

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
        const { data } = await supabaseAdmin.storage
          .from('resumes')
          .createSignedUrl(resume.resume_path, 3600); // Inline preview, no download parameter

        if (data?.signedUrl) {
          resumeUrl = data.signedUrl;
        }
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
      
      <main className="container mx-auto px-4 pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Resumes</h1>
          <p className="text-gray-600">
            Manage all of your tailored resumes here!
          </p>
        </div>

        {resumesWithUrls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumesWithUrls.map((resume) => (
              <ResumeCard 
                key={resume.id}
                fileName={resume.fileName} 
                resumeUrl={resume.resumeUrl || null}
                resumeName={resume.name}
                isPrimary={resume.id === primaryResumeId}
                resumeId={resume.id}
                isPremium={isPremium}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">
              No resumes found. Upload your resume to get started!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

