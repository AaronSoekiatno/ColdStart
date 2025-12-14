import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateColdEmailStream, type EmailTone } from '@/lib/email-generation';
import { getCandidate, getStartup, isSubscribed, getPrimaryResumeForCandidate } from '@/lib/supabase';
import { guessFounderEmailFromStartup } from '@/lib/founder-email';

/**
 * Extract links (GitHub, portfolio, etc.) from resume text
 */
function extractLinksFromResume(resumeText: string): Record<string, string> {
  const links: Record<string, string> = {};
  
  // Common patterns for links in resumes
  const patterns = [
    { key: 'github', regex: /github\.com[\/\s]*[:/]?[\s]*([a-zA-Z0-9\-_]+(?:\/[a-zA-Z0-9\-_.]+)?)/gi },
    { key: 'portfolio', regex: /(?:portfolio|website|personal site)[\s:]+(https?:\/\/[^\s]+)/gi },
    { key: 'linkedin', regex: /linkedin\.com\/in[\/\s]*[:/]?[\s]*([a-zA-Z0-9\-_]+)/gi },
    { key: 'website', regex: /(?:http[s]?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi },
  ];

  for (const pattern of patterns) {
    const matches = resumeText.match(pattern.regex);
    if (matches && matches.length > 0) {
      // Extract the first match and clean it up
      let link = matches[0];
      // Remove common prefixes
      link = link.replace(/^(?:github|portfolio|website|personal site|linkedin)[\s:]+/i, '');
      link = link.trim();
      // Ensure it has a protocol
      if (link && !link.startsWith('http')) {
        if (pattern.key === 'github') {
          link = `https://github.com/${link.replace(/github\.com\/?/i, '').trim()}`;
        } else if (pattern.key === 'linkedin') {
          link = `https://linkedin.com/in/${link.replace(/linkedin\.com\/in\/?/i, '').trim()}`;
        } else {
          link = `https://${link}`;
        }
      }
      if (link) {
        links[pattern.key] = link;
      }
    }
  }

  return links;
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { startupId, matchScore, tone } = await request.json();

    if (!startupId || matchScore === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing startupId or matchScore' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get candidate and startup data
    const candidate = await getCandidate(user.email);
    const startup = await getStartup(startupId);

    if (!candidate) {
      return new Response(
        JSON.stringify({ error: 'Candidate profile not found. Please upload your resume first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!startup) {
      return new Response(
        JSON.stringify({ error: 'Startup not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is premium
    const isPremium = isSubscribed(candidate);

    // Email tone changes are premium-only feature
    let emailTone: EmailTone | undefined = undefined;
    if (tone) {
      if (!isPremium) {
        return new Response(
          JSON.stringify({
            error: 'Email tone customization is a Premium feature. Upgrade to Premium to change email tone.',
            upgradeRequired: true,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Validate tone value
      const validTones: EmailTone[] = ['professional', 'classy', 'informative', 'ambitious', 'conversational'];
      if (validTones.includes(tone as EmailTone)) {
        emailTone = tone as EmailTone;
      }
    }

    // Check if we already have a generated email for this candidate-startup pair (one-to-one mapping)
    // We check cached emails FIRST so users can view previously generated emails even if they've hit the limit
    const { data: existingGeneratedEmail, error: fetchError } = await supabase
      .from('generated_emails')
      .select('subject, body, recipient_email, email_tone')
      .eq('candidate_id', candidate.id)
      .eq('startup_id', startupId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing generated email:', fetchError);
    }

    // Check if we should use cached email or regenerate
    // Regenerate if: tone is provided AND different from stored tone (premium users changing tone)
    // Otherwise, return cached email if it exists
    const storedTone = existingGeneratedEmail?.email_tone || null;
    const requestedTone = emailTone || null;
    
    // Regenerate if tone is explicitly provided (for premium users) and differs from stored tone
    // This handles premium users changing tone after initial generation
    // Note: We only regenerate if emailTone is provided (premium user) and it's different
    const shouldRegenerate = existingGeneratedEmail && 
      emailTone !== undefined && 
      storedTone !== requestedTone;
    
    const shouldUseCached = existingGeneratedEmail && !shouldRegenerate;

    // If we have an existing generated email with matching tone, return it immediately (no streaming needed)
    // Note: Cached emails don't count toward the limit, so we bypass limit check for cached emails
    if (shouldUseCached) {
      console.log('[Generated Email] Found existing email in database with matching tone, returning stored version (Gemini will NOT be called)');
      
      // Generate signed URL for resume preview (get primary/current resume)
      // Note: No download parameter - we want inline display for iframe, not download
      let resumeUrl = null;
      const resume = await getPrimaryResumeForCandidate(candidate.id);
      if (resume?.resume_path) {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );

          const { data } = await supabaseAdmin.storage
            .from('resumes')
            .createSignedUrl(resume.resume_path, 3600); // Inline display for iframe

          if (data?.signedUrl) {
            resumeUrl = data.signedUrl;
          }
        }
      }

      // Return existing email as a stream (but all at once since we already have it)
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          
          // Send metadata
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'metadata', 
              targetEmail: existingGeneratedEmail.recipient_email || '', 
              resumeUrl 
            })}\n\n`)
          );

          // Send the existing email body as a single chunk
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: existingGeneratedEmail.body })}\n\n`)
          );

          // Send done event with final subject and body
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'done', 
              subject: existingGeneratedEmail.subject, 
              body: existingGeneratedEmail.body 
            })}\n\n`)
          );

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // CRITICAL: Check email generation limits for free users BEFORE generating NEW email
    // This MUST happen BEFORE any email generation logic starts (resume fetching, Gemini API calls, etc.)
    // Free: 3 email generations per day (counts NEW generations, not cached retrievals or regenerations)
    // Premium: Unlimited
    // Note: We only check limits when generating NEW emails (not cached retrievals or tone regenerations)
    const isNewEmail = !existingGeneratedEmail; // True if this is a completely new email (not cached, not regeneration)
    
    if (!isPremium && candidate.id && isNewEmail) {
      // CRITICAL: Check limit BEFORE any generation logic
      // This prevents any email generation from starting if limit is exceeded
      // Calculate today's date range in UTC using server time
      // This ensures consistent timezone handling regardless of where the server is located
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      // Count how many emails were created TODAY (not updated - we use created_at)
      // Each unique candidate-startup pair counts as one generation
      // Use a more explicit query to ensure we get accurate count
      const { data: todayEmails, count: todayGenerationCount, error: countError } = await supabase
        .from('generated_emails')
        .select('id, created_at', { count: 'exact' })
        .eq('candidate_id', candidate.id)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());

      // Use count if available, otherwise fall back to data length
      const actualCount = todayGenerationCount ?? (todayEmails?.length ?? 0);

      console.log('[Limit Check] Email generation limit check:', {
        candidateId: candidate.id,
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        currentTime: now.toISOString(),
        count: actualCount,
        limit: 3,
        willBlock: actualCount >= 3,
        error: countError?.message,
      });

      if (countError) {
        console.error('[Limit Check] Error checking email generation limits:', countError);
        // On error, be conservative - don't block users due to DB errors, but log it
      } else {
        // Check daily limit (3 per day for free) - block if count is >= 3
        // This means: 0, 1, 2 emails = allowed; 3+ emails = blocked
        if (actualCount >= 3) {
          console.warn('[Limit Check] BLOCKING - Limit exceeded:', {
            count: actualCount,
            limit: 3,
            candidateId: candidate.id,
          });
          
          // Return error as SSE event so frontend can handle it properly
          const errorStream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: 'Free plan allows 3 email generations per day. Upgrade to Premium for unlimited generations.',
                  upgradeRequired: true,
                })}\n\n`)
              );
              controller.close();
            },
          });

          return new Response(errorStream, {
            status: 403,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } else {
          console.log('[Limit Check] ALLOWING - Within limit:', {
            count: actualCount,
            limit: 3,
            remaining: 3 - actualCount,
          });
        }
      }
    }

    // Generate a new email if:
    // 1. No existing email found (first time for this user-startup pair)
    // 2. Existing email found but tone changed (premium user regenerating with new tone)
    if (shouldRegenerate) {
      console.log('[Generated Email] Tone change detected - regenerating email with new tone via Gemini API');
    } else {
      console.log('[Generated Email] No existing email found, generating new email with Gemini (first time for this user-startup pair)');
    }

    // Decide which email address to use (real or guessed)
    const { email: targetEmail } = guessFounderEmailFromStartup(startup);

    if (!targetEmail) {
      return new Response(
        JSON.stringify({
          error:
            'Founder email not available for this startup and could not be guessed from first name + website.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL for resume preview (get primary/current resume)
    // Note: No download parameter - we want inline display for iframe, not download
    let resumeUrl = null;
    const resume = await getPrimaryResumeForCandidate(candidate.id);
    if (resume?.resume_path) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );

        const { data } = await supabaseAdmin.storage
          .from('resumes')
          .createSignedUrl(resume.resume_path, 3600); // Inline display for iframe

        if (data?.signedUrl) {
          resumeUrl = data.signedUrl;
        }
      }
    }

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'metadata', targetEmail, resumeUrl })}\n\n`)
          );

          // Extract founder name (use first founder if multiple)
          const founderName = startup.founder_names
            ? startup.founder_names.split(',')[0].trim()
            : undefined;

          // Stream the email generation
          let fullText = '';
          const emailStream = generateColdEmailStream(
            {
              name: candidate.name,
              email: candidate.email,
              summary: candidate.summary,
              skills: candidate.skills
                .split(', ')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0),
              resumeFullText: resume?.resume_full_text || undefined,
              // Extract links from resume_full_text if available (GitHub, portfolio, etc.)
              links: resume?.resume_full_text ? extractLinksFromResume(resume.resume_full_text) : undefined,
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
              scrapedContext: undefined, // Can be added later if scraped intel is stored in database
            },
            { score: matchScore },
            { tone: emailTone }
          );

          for await (const chunk of emailStream) {
            fullText += chunk;
            // Send each chunk as it arrives
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`)
            );
          }

          // Parse the final JSON response
          let subject = '';
          let body = '';
          
          try {
            // Clean and parse JSON
            let cleaned = fullText.trim();
            if (cleaned.startsWith('```json')) {
              cleaned = cleaned.slice(7);
            } else if (cleaned.startsWith('```')) {
              cleaned = cleaned.slice(3);
            }
            if (cleaned.endsWith('```')) {
              cleaned = cleaned.slice(0, -3);
            }
            cleaned = cleaned.trim();

            const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
            if (typeof parsed.subject === 'string') {
              subject = parsed.subject.trim();
            }
            if (typeof parsed.body === 'string') {
              body = parsed.body.trim();
            }
          } catch (parseError) {
            // Fallback: treat the whole response as the body
            body = fullText.trim();
            subject = `Intro: ${candidate.name} → ${startup.name} (internship interest)`;
          }

          // Save generated email to database (upsert - replace if exists for same candidate-startup pair)
          // When tone changes, this upsert will replace the old email with the new one
          // The unique constraint on (candidate_id, startup_id) ensures only one email per user-startup pair
          const nowISO = new Date().toISOString();
          
          // Check if this is a new email or an update to existing email
          const isNewEmail = !existingGeneratedEmail;
          
          // Double-check limit before saving if this is a NEW email (not an update)
          // This prevents race conditions where limit might have been exceeded between check and save
          if (!isPremium && isNewEmail && candidate.id) {
            const now = new Date();
            const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
            const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
            
            const { count: finalCount, error: finalCheckError } = await supabase
              .from('generated_emails')
              .select('*', { count: 'exact', head: true })
              .eq('candidate_id', candidate.id)
              .gte('created_at', todayStart.toISOString())
              .lte('created_at', todayEnd.toISOString());
            
            const finalActualCount = finalCount ?? 0;
            
            console.log('[Save Email] Final limit check before saving:', {
              isNewEmail,
              count: finalActualCount,
              limit: 3,
            });
            
            if (!finalCheckError && finalActualCount >= 3) {
              console.error('[Save Email] BLOCKED - Limit exceeded during save, preventing save:', {
                count: finalActualCount,
                limit: 3,
              });
              // Don't save the email - limit was exceeded
              // The email was already streamed to the user, but we won't persist it
              // This is a fallback safety check - ideally the initial check should have caught this
            } else {
              // Proceed with save
              const upsertData: any = {
                candidate_id: candidate.id,
                startup_id: startupId,
                email_tone: emailTone || null,
                subject,
                body,
                match_score: matchScore,
                recipient_email: targetEmail,
                updated_at: nowISO,
              };
              
              // Only set created_at explicitly if this is a NEW email
              // For updates (regenerations with new tone), created_at should remain unchanged
              // This ensures limit counting works correctly - regenerations don't count as new generations
              if (isNewEmail) {
                upsertData.created_at = nowISO;
                console.log('[Save Email] Saving NEW email with created_at:', nowISO);
              } else {
                console.log('[Save Email] Updating existing email (created_at preserved)');
              }
              
              const { error: saveError } = await supabase
                .from('generated_emails')
                .upsert(upsertData, {
                  onConflict: 'candidate_id,startup_id',
                });

              if (saveError) {
                console.error('Error saving generated email to database:', saveError);
                // Don't fail the request, just log the error
              } else {
                if (shouldRegenerate) {
                  console.log('[Generated Email] Successfully updated email in database with new tone');
                } else {
                  console.log('[Generated Email] Successfully saved email to database (first time for this user-startup pair)');
                }
              }
            }
          } else {
            // Premium user or updating existing email - save normally (no limit check needed)
            const upsertData: any = {
              candidate_id: candidate.id,
              startup_id: startupId,
              email_tone: emailTone || null,
              subject,
              body,
              match_score: matchScore,
              recipient_email: targetEmail,
              updated_at: nowISO,
            };
            
            // Only set created_at for new emails
            if (isNewEmail) {
              upsertData.created_at = nowISO;
            }
            
            const { error: saveError } = await supabase
              .from('generated_emails')
              .upsert(upsertData, {
                onConflict: 'candidate_id,startup_id',
              });

            if (saveError) {
              console.error('Error saving generated email to database:', saveError);
            } else {
              if (shouldRegenerate) {
                console.log('[Generated Email] Successfully updated email in database with new tone');
              } else {
                console.log('[Generated Email] Successfully saved email to database (first time for this user-startup pair)');
              }
            }
          }

          // Send final result
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', subject, body })}\n\n`)
          );
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Preview email stream error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate email preview' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
