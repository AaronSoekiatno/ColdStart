import { NextRequest, NextResponse } from 'next/server';
// COMMENTED OUT: Gmail API imports (not needed when not sending emails)
// import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateColdEmail, type EmailPersona } from '@/lib/email-generation';
import { getCandidate, getStartup, isSubscribed, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';

// COMMENTED OUT: OAuth client (not needed when not sending emails)
// const oauth2Client = new google.auth.OAuth2(
//   process.env.GOOGLE_CLIENT_ID,
//   process.env.GOOGLE_CLIENT_SECRET,
//   `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`
// );

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { startupId, matchScore, subject: customSubject, body: customBody, founderEmail: providedFounderEmail } = await request.json();

    if (!startupId || matchScore === undefined) {
      return NextResponse.json(
        { error: 'Missing startupId or matchScore' },
        { status: 400 }
      );
    }

    // COMMENTED OUT: Gmail connection check (not needed when not sending emails)
    // // Get user's email connection (OAuth tokens)
    // const { data: emailConnection, error: connectionError } = await supabase
    //   .from('user_email_connections')
    //   .select('*')
    //   .eq('user_email', user.email)
    //   .eq('provider', 'gmail')
    //   .single();

    // if (connectionError || !emailConnection) {
    //   return NextResponse.json(
    //     { error: 'Gmail not connected. Please connect your Gmail account first.' },
    //     { status: 400 }
    //   );
    // }

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

    // Check email send limits for free users (1 email per founder)
    if (!isPremium && candidate.id && providedFounderEmail) {
      const supabaseForCheck = createServerClient(
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

      const { data: existingEmail, error: checkError } = await supabaseForCheck
        .from('sent_emails')
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('recipient_email', providedFounderEmail)
        .limit(1)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing email:', checkError);
      }

      if (existingEmail) {
        return NextResponse.json(
          {
            error: 'Free plan allows only one email send per founder. Upgrade to Premium for unlimited sends.',
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
    }

    // Use provided founder email if available, otherwise guess
    let targetEmail: string;
    if (providedFounderEmail) {
      targetEmail = providedFounderEmail;
    } else {
      const { email: guessedEmail } = guessFounderEmailFromStartup(startup);
      if (!guessedEmail) {
        return NextResponse.json(
          {
            error:
              'Founder email not available for this startup and could not be guessed from first name + website.',
          },
          { status: 400 }
        );
      }
      targetEmail = guessedEmail;
    }

    // Use custom subject/body if provided, otherwise generate email
    let emailSubject: string;
    let emailBody: string;
    
    if (customSubject && customBody) {
      // User edited the email - use their custom version
      emailSubject = customSubject;
      emailBody = customBody;
    } else {
      // Get primary/current resume for resume_full_text
      const resume = await getPrimaryResumeForCandidate(candidate.id);
      
      // Extract founder name (use first founder if multiple)
      const founderName = startup.founder_names
        ? startup.founder_names.split(',')[0].trim()
        : undefined;

      // Extract links from resume_full_text if available (GitHub, portfolio, etc.)
      const extractLinksFromResume = (resumeText: string): Record<string, string> => {
        const links: Record<string, string> = {};
        const patterns = [
          { key: 'github', regex: /github\.com[\/\s]*[:/]?[\s]*([a-zA-Z0-9\-_]+(?:\/[a-zA-Z0-9\-_.]+)?)/gi },
          { key: 'portfolio', regex: /(?:portfolio|website|personal site)[\s:]+(https?:\/\/[^\s]+)/gi },
          { key: 'linkedin', regex: /linkedin\.com\/in[\/\s]*[:/]?[\s]*([a-zA-Z0-9\-_]+)/gi },
          { key: 'website', regex: /(?:http[s]?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi },
        ];
        for (const pattern of patterns) {
          const matches = resumeText.match(pattern.regex);
          if (matches && matches.length > 0) {
            let link = matches[0].replace(/^(?:github|portfolio|website|personal site|linkedin)[\s:]+/i, '').trim();
            if (link && !link.startsWith('http')) {
              if (pattern.key === 'github') {
                link = `https://github.com/${link.replace(/github\.com\/?/i, '').trim()}`;
              } else if (pattern.key === 'linkedin') {
                link = `https://linkedin.com/in/${link.replace(/linkedin\.com\/in\/?/i, '').trim()}`;
              } else {
                link = `https://${link}`;
              }
            }
            if (link) links[pattern.key] = link;
          }
        }
        return links;
      };

      // Generate email as before
      const generatedEmail = await generateColdEmail(
        {
          name: candidate.name,
          email: candidate.email,
          summary: candidate.summary,
          // Split skills string into non-empty, trimmed values
          skills: candidate.skills
            .split(', ')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0),
          resumeFullText: resume?.resume_full_text || undefined,
          // Extract links from resume_full_text if available (GitHub, portfolio, etc.)
          links: resume?.resume_full_text ? extractLinksFromResume(resume.resume_full_text) : undefined,
          // Additional Supabase candidate fields
          location: candidate.location || undefined,
          educationLevel: candidate.education_level || undefined,
          university: candidate.university || undefined,
          pastInternships: candidate.past_internships || undefined,
          technicalProjects: candidate.technical_projects || undefined,
        },
        {
          name: startup.name,
          industry: startup.industry,
          description: startup.description,
          fundingStage: startup.funding_stage,
          fundingAmount: startup.funding_amount,
          location: startup.location,
          website: startup.website,
          // Split tags string into non-empty, trimmed values
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
        { persona: 'direct-ask' as EmailPersona }
      );
      emailSubject = generatedEmail.subject;
      emailBody = generatedEmail.body;
    }

    // COMMENTED OUT: Gmail OAuth and email sending functionality
    // // Set up OAuth client with stored tokens
    // oauth2Client.setCredentials({
    //   access_token: emailConnection.access_token,
    //   refresh_token: emailConnection.refresh_token,
    // });

    // // Refresh token if expired
    // if (emailConnection.expires_at && new Date(emailConnection.expires_at) < new Date()) {
    //   try {
    //     const { credentials } = await oauth2Client.refreshAccessToken();
    //     oauth2Client.setCredentials(credentials);
    //     
    //     // Update stored token
    //     await supabase
    //       .from('user_email_connections')
    //       .update({
    //         access_token: credentials.access_token,
    //         expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
    //         updated_at: new Date().toISOString(),
    //       })
    //       .eq('user_email', user.email)
    //       .eq('provider', 'gmail');
    //   } catch (refreshError) {
    //     console.error('Token refresh failed:', refreshError);
    //     return NextResponse.json(
    //       { error: 'Gmail connection expired. Please reconnect your Gmail account.' },
    //       { status: 401 }
    //     );
    //   }
    // }

    // // Send email via Gmail API
    // const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // // Download resume from Supabase Storage if available
    // let resumeAttachment: { data: Buffer; filename: string; mimeType: string } | null = null;
    // if (candidate.resume_path) {
    //   try {
    //     const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    //     if (serviceRoleKey) {
    //       const supabaseAdmin = createClient(
    //         process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //         serviceRoleKey
    //       );

    //       const { data: resumeData, error: downloadError } = await supabaseAdmin.storage
    //         .from('resumes')
    //         .download(candidate.resume_path);

    //       if (!downloadError && resumeData) {
    //         const arrayBuffer = await resumeData.arrayBuffer();
    //         const buffer = Buffer.from(arrayBuffer);
            
    //         // Determine filename and MIME type from path
    //         const pathParts = candidate.resume_path.split('/');
    //         const filename = pathParts[pathParts.length - 1] || 'resume.pdf';
    //         const mimeType = filename.endsWith('.pdf') 
    //           ? 'application/pdf' 
    //           : filename.endsWith('.docx')
    //           ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    //           : 'application/octet-stream';

    //         resumeAttachment = {
    //           data: buffer,
    //           filename,
    //           mimeType,
    //         };
    //         console.log(`Resume attachment prepared: ${filename} (${buffer.length} bytes)`);
    //       } else {
    //         console.warn('Failed to download resume from Storage:', downloadError);
    //       }
    //     }
    //   } catch (error) {
    //     console.warn('Error downloading resume for attachment:', error);
    //     // Continue without attachment if download fails
    //   }
    // }

    // // Create email message with optional attachment
    // let message: string;
    
    // if (resumeAttachment) {
    //   // Multipart message with attachment
    //   const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    //   const attachmentBase64 = resumeAttachment.data.toString('base64');
    //   const attachmentEncoded = attachmentBase64.match(/.{1,76}/g)?.join('\n') || attachmentBase64;

    //   message = [
    //     `To: ${targetEmail}`,
    //     `Subject: ${emailSubject}`,
    //     `MIME-Version: 1.0`,
    //     `Content-Type: multipart/mixed; boundary="${boundary}"`,
    //     '',
    //     `--${boundary}`,
    //     `Content-Type: text/plain; charset=utf-8`,
    //     `Content-Transfer-Encoding: 7bit`,
    //     '',
    //     emailBody,
    //     '',
    //     `--${boundary}`,
    //     `Content-Type: ${resumeAttachment.mimeType}; name="${resumeAttachment.filename}"`,
    //     `Content-Disposition: attachment; filename="${resumeAttachment.filename}"`,
    //     `Content-Transfer-Encoding: base64`,
    //     '',
    //     attachmentEncoded,
    //     `--${boundary}--`,
    //   ].join('\n');
    // } else {
    //   // Simple text message without attachment
    //   message = [
    //     `To: ${targetEmail}`,
    //     `Subject: ${emailSubject}`,
    //     'Content-Type: text/plain; charset=utf-8',
    //     '',
    //     emailBody,
    //   ].join('\n');
    // }

    // const encodedMessage = Buffer.from(message)
    //   .toString('base64')
    //   .replace(/\+/g, '-')
    //   .replace(/\//g, '_')
    //   .replace(/=+$/, '');

    // await gmail.users.messages.send({
    //   userId: 'me',
    //   requestBody: {
    //     raw: encodedMessage,
    //   },
    // });

    // Save email history to database
    try {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey && candidate.id) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );

        // Get recipient name from founder_names field by matching the email
        let recipientName = null;
        if (startup.founder_names && providedFounderEmail) {
          // Parse founder_names and founder_emails to match them
          const founderNames = startup.founder_names.split(',').map((n: string) => n.trim());
          const founderEmails = startup.founder_emails?.split(',').map((e: string) => e.trim()) || [];
          const emailIndex = founderEmails.indexOf(providedFounderEmail);
          if (emailIndex !== -1 && founderNames[emailIndex]) {
            recipientName = founderNames[emailIndex];
          }
        }

        // Use upsert to update existing email or create new one
        // This prevents duplicates based on the unique constraint: (candidate_id, startup_id, recipient_email)
        await supabaseAdmin
          .from('sent_emails')
          .upsert({
            candidate_id: candidate.id,
            startup_id: startup.id,
            recipient_email: targetEmail,
            recipient_name: recipientName,
            subject: emailSubject,
            body: emailBody,
            match_score: matchScore,
            sent_at: new Date().toISOString(),
            // Reset status to 'sent' when updating
            status: 'sent',
            // Keep email in sent (not archived) when updating
            archived: false,
          }, {
            onConflict: 'candidate_id,startup_id,recipient_email'
          });

        console.log('Email history saved successfully');
      }
    } catch (historyError) {
      // Log error and fail the request if we can't save to database
      console.error('Failed to save email history:', historyError);
      return NextResponse.json(
        { error: 'Failed to save email to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email saved successfully. Navigate to tracker page.',
      redirectTo: '/tracker',
    });
  } catch (error) {
    console.error('Save email error:', error);
    
    // COMMENTED OUT: Gmail-specific error handling (not needed when not sending emails)
    // if (error instanceof Error) {
    //   // Handle specific Gmail API errors
    //   if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
    //     return NextResponse.json(
    //       { error: 'Gmail connection expired. Please reconnect your Gmail account.' },
    //       { status: 401 }
    //     );
    //   }
    //   
    //   if (error.message.includes('insufficient permission')) {
    //     return NextResponse.json(
    //       { error: 'Insufficient Gmail permissions. Please reconnect your Gmail account.' },
    //       { status: 403 }
    //     );
    //   }

    //   // If we used a guessed founder email and Gmail reports it invalid,
    //   // clear the stored founder_emails back to NULL so we don't reuse a bad guess.
    //   if (
    //     (error.message.toLowerCase().includes('invalid') ||
    //       error.message.toLowerCase().includes('address not found')) &&
    //     typeof request !== 'undefined'
    //   ) {
    //     try {
    //       const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    //       if (serviceRoleKey) {
    //         const { createClient } = await import('@supabase/supabase-js');
    //         const supabaseAdmin = createClient(
    //           process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //           serviceRoleKey
    //         );
    //         const { startupId } = await request.json();
    //         await supabaseAdmin
    //           .from('startups')
    //           .update({ founder_emails: null })
    //           .eq('id', startupId);
    //       }
    //     } catch (clearError) {
    //       console.error('Failed to clear invalid founder email:', clearError);
    //     }
    //   }
    // }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save email' },
      { status: 500 }
    );
  }
}

