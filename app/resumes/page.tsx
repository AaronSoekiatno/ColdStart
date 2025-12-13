import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
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

  // Get candidate info to find resume
  const { data: candidate } = await supabase
    .from('candidates')
    .select('resume_path')
    .eq('email', user.email ?? '')
    .single();

  let resumeUrl: string | null = null;
  let fileName: string = '';

  // Generate signed URL for resume if it exists
  if (candidate?.resume_path) {
    const { data } = await supabaseAdmin.storage
      .from('resumes')
      .createSignedUrl(candidate.resume_path, 3600); // 1 hour expiry

    if (data?.signedUrl) {
      resumeUrl = data.signedUrl;
      // Extract filename from path
      const pathParts = candidate.resume_path.split('/');
      fileName = pathParts[pathParts.length - 1] || 'resume.pdf';
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />
      
      <main className="container mx-auto px-4 pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Resume</h1>
          <p className="text-gray-600">
            Manage all of your tailored resumes here!
          </p>
        </div>

        {resumeUrl ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ResumeCard fileName={fileName} resumeUrl={resumeUrl} />
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

