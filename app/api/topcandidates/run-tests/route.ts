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
        console.log('[API run-tests] Request received:', { sessionId, testType, env: process.env.NODE_ENV });

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
        let session;

        if (process.env.NODE_ENV === 'development' && sessionId === 'local-dev-session') {
            session = {
                container_url: 'http://localhost:8080',
                container_status: 'running',
                candidate_id: 'local-dev-user'
            };
        } else if (process.env.NODE_ENV === 'development' && sessionId === 'local-dev-docker') {
            session = {
                container_url: 'http://localhost:8080',
                container_status: 'running',
                candidate_id: 'b206aa10-64b0-4e37-9a1a-2d6fc92f14f3'
            };
        } else {
            const { data: dbSession } = await supabase
                .from('interview_sessions')
                .select('container_url, container_status, candidate_id')
                .eq('session_id', sessionId)
                .single();
            session = dbSession;
        }

        console.log('[API run-tests] Resolved session:', session);

        if (!session || !session.container_url) {
            // Fallback for local development if DB has session but no container provisions
            if (process.env.NODE_ENV === 'development') {
                console.log('Using local dev fallback for container');
                session = {
                    ...(session || {}),
                    container_url: 'http://localhost:8080',
                    container_status: 'running',
                    candidate_id: session?.candidate_id || 'local-dev-user'
                };
            } else {
                return NextResponse.json({ error: 'Container not found or not running' }, { status: 404 });
            }
        }

        // Mock execution for local dev verification (when Docker is unavailable or for testing UI)
        if (session.candidate_id === 'local-dev-user') {
            console.log('Returning MOCK results for local-dev-user');
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

            const mockResults = {
                numTotalTestSuites: 2,
                numPassedTestSuites: 1,
                numFailedTestSuites: 1,
                numTotalTests: 4,
                numPassedTests: 3,
                numFailedTests: 1,
                testResults: [
                    {
                        name: '/workspace/tests/assessment/completion.test.tsx',
                        status: 'passed',
                        startTime: Date.now(),
                        endTime: Date.now() + 500,
                        assertionResults: [
                            { 
                                title: 'should render the assessment interface', 
                                status: 'passed', 
                                ancestorTitles: ['Completion'] 
                            },
                            { 
                                title: 'should allow text input', 
                                status: 'passed', 
                                ancestorTitles: ['Completion'] 
                            }
                        ]
                    },
                    {
                        name: '/workspace/tests/assessment/error-handling.test.tsx',
                        status: 'failed',
                        startTime: Date.now(),
                        endTime: Date.now() + 800,
                        assertionResults: [
                            { 
                                title: 'should display error message on API failure', 
                                status: 'passed', 
                                ancestorTitles: ['Error Handling'] 
                            },
                            { 
                                title: 'should retry failed requests', 
                                status: 'failed', 
                                ancestorTitles: ['Error Handling'],
                                failureMessages: ['Expected retry button to be visible']
                            }
                        ]
                    }
                ],
                success: false
            };

            // Log to DB anyway for verification
            const { error: dbError } = await supabase
                .schema('admin_audit')
                .from('assessment_scores')
                .insert({
                    session_id: sessionId,
                    candidate_id: session.candidate_id,
                    test_type: testType,
                    test_results: mockResults,
                    total_score: mockResults.numPassedTests,
                    max_score: mockResults.numTotalTests,
                });

            return NextResponse.json({
                success: true,
                output: 'Simulated test execution output...\nTest suite failed.',
                results: mockResults
            });
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
                let cleanName = '';
                // Try to find container by specific name first (most reliable)
                if (session.candidate_id) {
                    const specificContainerName = `hermes-assessment-${session.candidate_id}`;
                    // Try exact name match first
                    const checkCmd = `docker ps --filter "name=${specificContainerName}" --format "{{.Names}}"`;
                    try {
                        console.log(`[API run-tests] Searching for container: ${checkCmd}`);
                        const { stdout } = await execAsync(checkCmd);
                        console.log(`[API run-tests] Search result: "${stdout}"`);
                        
                        // Parse output to find exact match if multiple returned
                        const names = stdout.trim().split('\n');
                        if (names.some(n => n === specificContainerName || n === `/${specificContainerName}`)) {
                             cleanName = specificContainerName;
                        } else if (stdout.trim()) {
                             cleanName = stdout.trim().split('\n')[0]; // Take first match
                        }
                    } catch (e: any) {
                        console.error('[API run-tests] Docker search failed:', e);
                    }
                }

                // Fallback: If no specific container found, exec on the most recent hermes-assessment container
                if (!cleanName) {
                    console.log('[API run-tests] specific search failed, trying generic...');
                    const getContainerIdCmd = `docker ps --filter "ancestor=hermes-assessment:latest" --format "{{.Names}}" | head -n 1`;
                    const { stdout: containerName } = await execAsync(getContainerIdCmd);
                    cleanName = containerName.trim();
                }
                
                // SUPER FALLBACK for local dev: if we know the ID, just try to use it directly
                // This covers cases where 'docker ps' filtering is flaky but the container exists
                if (!cleanName && session.candidate_id === 'b206aa10-64b0-4e37-9a1a-2d6fc92f14f3') {
                     console.log('[API run-tests] Using HARDCODED container name for local dev fallback');
                     cleanName = 'hermes-assessment-b206aa10-64b0-4e37-9a1a-2d6fc92f14f3';
                }

                if (!cleanName) {
                    throw new Error('No local assessment container found');
                }

                console.log(`[API run-tests] Target Container: ${cleanName}`);
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
        console.log('[API run-tests] Raw stdout from container:', stdout);
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
        // Use admin_audit schema - REQUIRES SERVICE ROLE KEY or RPC
        // We use an RPC function 'log_test_result' to bypass schema restrictions safely
        const { createClient } = await import('@supabase/supabase-js');
        const adminSupabase = createClient(
             process.env.NEXT_PUBLIC_SUPABASE_URL!,
             process.env.SUPABASE_SERVICE_ROLE_KEY || '',
             {
                 auth: {
                     autoRefreshToken: false,
                     persistSession: false
                 }
             }
        );

        const { error: dbError } = await adminSupabase.rpc('log_test_result', {
            p_session_id: sessionId,
            p_candidate_id: session.candidate_id,
            p_test_type: testType,
            p_test_results: testResults || { raw_output: stdout + stderr },
            p_total_score: testResults?.numPassedTests || 0,
            p_max_score: testResults?.numTotalTests || 0
        });

        if (dbError) {
            console.error('Failed to log results via RPC:', dbError);
            console.warn('NOTE: You may need to apply migration 049_add_test_logging_rpc.sql');
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
