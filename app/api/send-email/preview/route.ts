import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateColdEmail, type EmailPersona } from '@/lib/email-generation';
import { getCandidate, getStartup, isSubscribed, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';

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

    const { startupId, matchScore, persona } = await request.json();

    if (!startupId || matchScore === undefined) {
      return NextResponse.json(
        { error: 'Missing startupId or matchScore' },
        { status: 400 }
      );
    }

    // Get candidate and startup data
    const candidate = await getCandidate(user.email);
    const startup = await getStartup(startupId);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    if (!startup) {
      return NextResponse.json(
        { error: 'Startup not found' },
        { status: 404 }
      );
    }

    // Check if user is premium
    const isPremium = isSubscribed(candidate);

    // Email persona selection is premium-only feature
    let emailPersona: EmailPersona = 'direct-ask'; // Default for free users
    if (persona) {
      if (!isPremium && persona !== 'direct-ask') {
        // Free users can only use 'direct-ask' - force it to default
        emailPersona = 'direct-ask';
      } else {
        // Validate persona value
        const validPersonas: EmailPersona[] = ['direct-ask', 'genuine-fan', 'value-first'];
        if (validPersonas.includes(persona as EmailPersona)) {
          emailPersona = persona as EmailPersona;
        }
      }
    }

    // Check email generation limits for free users
    // Free: 3 email generations per day, only 1 per company
    // Premium: Unlimited
    if (!isPremium && candidate.id) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayGenerations, error: genCheckError } = await supabase
        .from('sent_emails')
        .select('id, startup_id, sent_at')
        .eq('candidate_id', candidate.id)
        .gte('sent_at', todayStart.toISOString())
        .lte('sent_at', todayEnd.toISOString());

      if (genCheckError) {
        console.error('Error checking email generation limits:', genCheckError);
      } else {
        // Check daily limit (3 per day for free)
        if (todayGenerations && todayGenerations.length >= 3) {
          return NextResponse.json(
            {
              error: 'Free plan allows 3 email generations per day. Upgrade to Premium for unlimited generations.',
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }

        // Check per-company limit (1 per company for free)
        const alreadyGeneratedForCompany = todayGenerations?.some(
          (email) => email.startup_id === startup.id
        );

        if (alreadyGeneratedForCompany) {
          return NextResponse.json(
            {
              error: 'Free plan allows only one email generation per company per day. Upgrade to Premium for unlimited generations.',
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }
      }
    }

    // Decide which email address to use (real or guessed)
    const { email: targetEmail } = guessFounderEmailFromStartup(startup);

    if (!targetEmail) {
      return NextResponse.json(
        {
          error:
            'Founder email not available for this startup and could not be guessed from first name + website.',
        },
        { status: 400 }
      );
    }

    // Get primary/current resume for resume_full_text
    const resume = await getPrimaryResumeForCandidate(candidate.id);

    // Extract founder name (use first founder if multiple)
    const founderName = startup.founder_names
      ? startup.founder_names.split(',')[0].trim()
      : undefined;

    // Generate email (but do NOT send it)
    // Gemini will intelligently extract links from resume text
    const generatedEmail = await generateColdEmail(
      {
        name: candidate.name,
        email: candidate.email,
        skills: candidate.skills
          .split(', ')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
        resumeFullText: resume?.resume_full_text || undefined,
        // Additional Supabase candidate fields
        location: candidate.location || undefined,
        educationLevel: candidate.education_level || undefined,
        university: candidate.university || undefined,
        pastInternships: candidate.experience || undefined,
        technicalProjects: candidate.technical_projects || undefined,
        jobType: candidate.job_type || undefined,
      },
      {
        name: startup.name,
        industry: startup.industry,
        description: startup.description,
        fundingStage: startup.funding_stage,
        fundingAmount: startup.funding_amount,
        location: startup.location,
        website: startup.website,
        tags: startup.tags
          ?.split(', ')
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0),
        founderName: founderName,
        // Additional Supabase startup fields
        batch: startup.batch || undefined,
        jobOpenings: startup.job_openings || undefined,
        founderEmails: startup.founder_emails || undefined,
        founderLinkedIn: startup.founder_linkedin || undefined,
      },
      { score: matchScore },
            { persona: emailPersona }
    );

    return NextResponse.json({
      success: true,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
      to: targetEmail,
    });
  } catch (error) {
    console.error('Preview email error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email preview' },
      { status: 500 }
    );
  }
}


