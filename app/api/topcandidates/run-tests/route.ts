import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const maxDuration = 300; // 5 minutes timeout for full tests

/**
 * POST /api/topcandidates/run-tests
 * 
 * Triggers test execution in the candidate's container.
 * Supports 'quick' (skip build) and 'full' (include build) modes.
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, testType = 'quick' } = await request.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        // Authenticate
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll() { },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get session info to find container
        const { data: session } = await supabase
            .from('interview_sessions')
            .select('container_url, container_status, candidate_id')
            .eq('session_id', sessionId)
            .single();

        if (!session || !session.container_url) {
            return NextResponse.json({ error: 'Container not found or not running' }, { status: 404 });
        }

        // Determine execution method (Local Docker vs Fly.io)
        // We infer this based on the container URL or environment
        const isProduction = process.env.NODE_ENV === 'production' && !session.container_url.includes('localhost');

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        const testCommand = `/usr/local/bin/run-tests.sh ${testType}`;

        if (isProduction) {
            // Fly.io Execution (Placeholder - usually requires flyctl or Machines API exec)
            // For this MVP, we might need a specific implementation or assume local for now if not fully set up
            // Attempting to use flyctl via exec if installed, or error out
            try {
                const appName = session.container_url.replace('https://', '').replace('.fly.dev', '');
                // Note: This requires flyctl to be available and auth'd on the server
                const command = `fly machines exec --app ${appName} "${testCommand}"`;
                const result = await execAsync(command);
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (e: any) {
                console.error('Fly execution failed:', e);
                return NextResponse.json({ error: 'Remote execution failed', details: e.message }, { status: 500 });
            }
        } else {
            // Local Docker Execution
            try {
                // Find container by part of the name (candidate ID or just assuming standard naming)
                // We need the container ID or name. In local dev, it's often 'hermes-assessment-<candidate_id>'
                // For 'verify-production-build', it was 'hermes-prod-test'
                // Let's rely on finding it via docker ps filter if possible, or assume a convention

                // Use the candidate ID from session (or user email if id not reliable, but we have session.candidate_id)
                // Just searching for a container running the image might be risky if multiple exist.
                // Let's assume the local naming convention: hermes-assessment-<candidate_id>
                // But candidate_id might be UUID or 'prod-test-user'.
                // Let's try to grab it from the URL if it contains the ID, or just find *any* running assessment container for *this* session?
                // Actually, for local dev, we usually have one.

                // Better: Use `docker ps` to find container with label or name match?
                // Simpler: If we are in local dev, we likely know the container name format.
                // Let's assume 'hermes-assessment-' prefix + candidate_id, BUT candidate_id might be complex.

                // Fallback: If we can't determine, just exec on the most recent hermes-assessment container
                const getContainerIdCmd = `docker ps --filter "ancestor=hermes-assessment:latest" --format "{{.names}}" | head -n 1`;
                const { stdout: containerName } = await execAsync(getContainerIdCmd);

                if (!containerName.trim()) {
                    throw new Error('No local assessment container found');
                }

                const cleanName = containerName.trim();
                const command = `docker exec ${cleanName} ${testCommand}`;
                console.log(`Executing tests locally: ${command}`);

                const result = await execAsync(command);
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (e: any) {
                // docker exec returns non-zero if tests fail, but we want to capture that as "tests failed" not "server error"
                // execAsync throws on non-zero exit code
                if (e.stderr || e.stdout) {
                    stdout = e.stdout || '';
                    stderr = e.stderr || '';
                    exitCode = e.code || 1;
                } else {
                    console.error('Docker execution failed:', e);
                    return NextResponse.json({ error: 'Local execution failed', details: e.message }, { status: 500 });
                }
            }
        }

        // Capture results
        // We need to read the JSON file from the container to get structured data
        // Or we can parse the stdout if we printed it. 
        // run-tests.sh prints the JSON content at the end.
        // Let's look for the JSON blob in stdout.

        // Find the last JSON object in output
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        let testResults = null;
        let score = 0;

        if (jsonMatch) {
            try {
                testResults = JSON.parse(jsonMatch[0]);

                // Calculate score simple approximation
                // Total points logic is in the test files, not in JSON reporter directly usually?
                // Unless we use valid custom reporter.
                // Vitest JSON Output has 'numPassedTests', 'numTotalTests'.
                // We can approximate score or just store the raw results.
                // Let's store raw results.

                // If valid JSON, assume success in retrieval
            } catch (e) {
                console.warn('Failed to parse test results JSON');
            }
        }

        // Update database with results
        // Use admin_audit schema
        const { error: dbError } = await supabase
            .schema('admin_audit')
            .from('assessment_scores')
            .insert({
                session_id: sessionId,
                candidate_id: session.candidate_id, // Required by existing schema
                test_type: testType,
                test_results: testResults || { raw_output: stdout + stderr },
                total_score: testResults?.numPassedTests || 0, // Mapped to existing column
                max_score: testResults?.numTotalTests || 0,
            });

        if (dbError) {
            console.error('Failed to log results:', dbError);
        }

        return NextResponse.json({
            success: exitCode === 0,
            output: stdout,
            results: testResults
        });

    } catch (error) {
        console.error('Test execution error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
