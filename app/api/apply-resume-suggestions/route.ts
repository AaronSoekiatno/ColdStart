import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { applyResumeSuggestions, generateUpdatedResumePDF } from '@/lib/apply-suggestions-to-pdf';
import { structuredResumeToPlainText } from '@/lib/structured-resume-to-text';
import type { StructuredResumeData } from '@/types/resume';

interface Suggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { acceptedSuggestions, updatedStructuredResumeData } = await request.json();

    if (!acceptedSuggestions || !Array.isArray(acceptedSuggestions)) {
      return NextResponse.json(
        { error: 'Invalid suggestions data' },
        { status: 400 }
      );
    }

    // Get candidate data
    const candidate = await getCandidate(user.email);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found' },
        { status: 404 }
      );
    }

    // Get the primary (current) resume for this candidate to source resume_full_text
    const primaryResume = candidate.id
      ? await getPrimaryResumeForCandidate(candidate.id)
      : null;

    let pdfBytes: Uint8Array;

    if (updatedStructuredResumeData) {
      // Use the updated structured resume from the client (matches on-screen template)
      const updatedText = structuredResumeToPlainText(updatedStructuredResumeData as StructuredResumeData);
      pdfBytes = await generateUpdatedResumePDF(updatedText, candidate.name);
    } else {
      // Legacy path: apply suggestions against stored full-text resume
      // Now sourced from the resumes table instead of candidates.resume_full_text
      const resumeText = primaryResume?.resume_full_text;

      if (!resumeText) {
        return NextResponse.json(
          { error: 'Resume text not available. Please re-upload your resume.' },
          { status: 400 }
        );
      }

      pdfBytes = await applyResumeSuggestions(
        resumeText,
        acceptedSuggestions,
        candidate.name
      );
    }

    // Convert Uint8Array to Buffer for NextResponse
    const buffer = Buffer.from(pdfBytes);

    // Return the PDF file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${candidate.name.replace(/\s+/g, '_')}_Updated_Resume.pdf"`,
      },
    });
  } catch (error) {
    console.error('Apply resume suggestions error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to apply suggestions',
      },
      { status: 500 }
    );
  }
}
