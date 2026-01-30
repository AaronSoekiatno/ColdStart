import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Import verification services from the services directory
import { VerificationService, RepositoryData, AssessmentData } from '@/services/verification/verification';
import { GitHubService } from '@/services/verification/github';
import { RepositoryEvaluatorService } from '@/services/verification/repositoryEvaluator';
import { StorageService } from '@/services/verification/storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Validation schema
const runVerificationSchema = z.object({
  candidate_id: z.string().uuid(),
  repository_ids: z.array(z.string().uuid()).optional(),
  assessment_data: z.object({
    skillLevel: z.enum(['junior', 'mid', 'senior']).optional(),
    technicalScore: z.number().optional(),
    codingScore: z.number().optional(),
  }).optional(),
  skip_ai: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidate_id, repository_ids, assessment_data, skip_ai = false } = runVerificationSchema.parse(body);

    console.log(`[VERIFICATION] Starting verification for candidate ${candidate_id} (skip_ai: ${skip_ai})`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch candidate
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (!candidate.github_access_token || !candidate.github_username) {
      return NextResponse.json(
        { error: 'GitHub not connected for this candidate' },
        { status: 400 }
      );
    }

    // 2. Fetch repositories
    let repositoriesQuery = supabaseAdmin
      .from('github_repositories')
      .select('*')
      .eq('candidate_id', candidate_id);

    if (repository_ids && repository_ids.length > 0) {
      repositoriesQuery = repositoriesQuery.in('id', repository_ids);
    }

    const { data: repositories, error: repoError } = await repositoriesQuery;

    if (repoError || !repositories || repositories.length === 0) {
      return NextResponse.json(
        { error: 'No repositories found for candidate' },
        { status: 404 }
      );
    }

    console.log(`[VERIFICATION] Found ${repositories.length} repositories`);

    // 3. Process each repository
    const githubService = new GitHubService(candidate.github_access_token);
    const storageService = new StorageService(supabaseUrl, supabaseServiceKey);
    
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    const evaluator = new RepositoryEvaluatorService(anthropicApiKey, model);

    const repositoryData: RepositoryData[] = [];

    for (const repo of repositories) {
      try {
        console.log(`[VERIFICATION] Processing repository: ${repo.name}`);

        const [owner, repoName] = repo.full_name.split('/');
        const commits = await githubService.getCommitsByAuthor(
          owner,
          repoName,
          candidate.github_username
        );

        console.log(`[VERIFICATION] Found ${commits.length} commits for ${repo.name}`);

        // Check for existing extraction
        const { data: extraction } = await supabaseAdmin
          .from('github_code_extracts')
          .select('*')
          .eq('repository_id', repo.id)
          .eq('extraction_status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let evaluation;

        if (skip_ai) {
          console.log(`[VERIFICATION] Skipping AI evaluation for ${repo.name}`);
          evaluation = {
            codeQuality: { score: 5, justification: 'Evaluation skipped (skip_ai: true)' },
            completeness: { score: 5, justification: 'Evaluation skipped (skip_ai: true)' },
            engineeringPractices: { score: 5, justification: 'Evaluation skipped (skip_ai: true)' },
            complexity: { score: 5, justification: 'Evaluation skipped (skip_ai: true)' },
            originality: { score: 5, justification: 'Evaluation skipped (skip_ai: true)' },
            oneLiner: 'AI evaluation skipped by user request.',
            strengths: ['Repository activity metrics collected']
          };
        } else if (extraction?.storage_path) {
          console.log(`[VERIFICATION] Using existing extraction for ${repo.name}`);
          const extractedCode = await storageService.downloadCodeExtract(extraction.storage_path);

          const timePeriod = extraction.metadata?.date_range
            ? `${new Date(extraction.metadata.date_range.first_commit).toLocaleDateString()} to ${new Date(extraction.metadata.date_range.last_commit).toLocaleDateString()}`
            : 'Unknown period';

          evaluation = await evaluator.evaluateRepository(
            extractedCode,
            {
              name: repo.name,
              description: repo.description,
              languages: repo.languages as Record<string, number> | null,
              commit_count: extraction.metadata?.total_commits || commits.length,
              time_period: timePeriod,
              stars: repo.stargazers_count || 0,
              forks: repo.forks_count || 0,
            }
          );
        } else {
          console.log(`[VERIFICATION] No extraction available for ${repo.name}, using basic evaluation`);
          
          const minimalExtractedCode = {
            repo: repo.full_name,
            github_username: candidate.github_username,
            files: {},
            metadata: {
              total_commits: commits.length,
              total_lines_added: 0,
              files_count: 0,
              date_range: {
                first_commit: commits.length > 0 ? commits[commits.length - 1].commit.author.date : null,
                last_commit: commits.length > 0 ? commits[0].commit.author.date : null,
              },
            },
          };

          const timePeriod = commits.length > 0
            ? `${new Date(commits[commits.length - 1].commit.author.date).toLocaleDateString()} to ${new Date(commits[0].commit.author.date).toLocaleDateString()}`
            : 'Unknown period';

          evaluation = await evaluator.evaluateRepository(
            minimalExtractedCode,
            {
              name: repo.name,
              description: repo.description,
              languages: repo.languages as Record<string, number> | null,
              commit_count: commits.length,
              time_period: timePeriod,
              stars: repo.stargazers_count || 0,
              forks: repo.forks_count || 0,
            }
          );
        }

        repositoryData.push({
          id: repo.id,
          name: repo.name,
          commits,
          evaluation,
          metadata: {
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            commit_count: commits.length,
          },
        });
      } catch (error: any) {
        console.error(`[VERIFICATION] Error processing repository ${repo.name}:`, error.message || error);
        
        if (error.statusCode === 401 || error.status === 401) {
          console.error('[VERIFICATION] Critical error: GitHub credentials are invalid. Stopping verification.');
          return NextResponse.json(
            { error: 'GitHub credentials are invalid', details: error.message },
            { status: 401 }
          );
        }
      }
    }

    if (repositoryData.length === 0) {
      return NextResponse.json(
        { error: 'Failed to process any repositories' },
        { status: 500 }
      );
    }

    console.log(`[VERIFICATION] Successfully processed ${repositoryData.length} repositories`);

    // 4. Run verification
    const verificationService = new VerificationService();
    const verificationResult = await verificationService.verifyCandidateGitHub(
      candidate_id,
      repositoryData,
      assessment_data as AssessmentData | undefined
    );

    console.log(`[VERIFICATION] Verification complete: ${verificationResult.verificationStatus}`);

    // 5. Store verification results
    const dbPayload = {
      candidate_id,
      verification_status: verificationResult.verificationStatus,
      activity_window_passed: verificationResult.criteria.activityWindow.passed,
      activity_window_details: verificationResult.criteria.activityWindow,
      meaningful_projects_passed: verificationResult.criteria.meaningfulProjects.passed,
      meaningful_projects_details: verificationResult.criteria.meaningfulProjects,
      debugging_evidence_passed: verificationResult.criteria.debuggingEvidence.passed,
      debugging_evidence_details: verificationResult.criteria.debuggingEvidence,
      code_maintainability_passed: verificationResult.criteria.codeMaintainability.passed,
      code_maintainability_details: verificationResult.criteria.codeMaintainability,
      assessment_alignment_passed: verificationResult.criteria.assessmentAlignment.aligned,
      assessment_alignment_details: verificationResult.criteria.assessmentAlignment,
      total_criteria_passed: verificationResult.totalCriteriaPassed,
      total_criteria_checked: verificationResult.totalCriteriaChecked,
      verification_notes: verificationResult.verificationNotes,
      verified_at: verificationResult.verifiedAt.toISOString(),
    };

    const { data: verificationRecord, error: dbError } = await supabaseAdmin
      .from('github_verifications')
      .insert(dbPayload as any)
      .select()
      .single();

    if (dbError) {
      console.error('[VERIFICATION] Failed to save to database:', dbError);
      return NextResponse.json(
        {
          message: 'Verification completed (database save failed)',
          verification: verificationResult,
          db_error: dbError.message,
        },
        { status: 201 }
      );
    }

    console.log(`[VERIFICATION] Saved to database with ID: ${verificationRecord.id}`);

    return NextResponse.json(
      {
        message: 'Verification completed successfully',
        verification_id: verificationRecord.id,
        verification: verificationResult,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[VERIFICATION] Validation error:', error.issues);
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[VERIFICATION] Unexpected error:', error);
    console.error('[VERIFICATION] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[VERIFICATION] Error type:', typeof error);
    console.error('[VERIFICATION] Error constructor:', error?.constructor?.name);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        type: error?.constructor?.name || 'Unknown',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
