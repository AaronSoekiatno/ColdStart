import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';
import { destroyFlyMachine } from '@/lib/container-orchestration/flyio';

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
        const { sessionId, testType = 'quick', destroyAfter = false } = await request.json();
        console.log('[API run-tests] Request received:', { sessionId, testType, destroyAfter, env: process.env.NODE_ENV });

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
        // Check if container is on Fly.io based on URL (works in both dev and prod)
        const isFlyIo = session.container_url.includes('fly.dev');

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        const testCommand = `/usr/local/bin/run-tests.sh ${testType}`;

        if (isFlyIo) {
            // Fly.io Execution via SSH
            const appName = session.container_url.replace('https://', '').replace('.fly.dev', '');
            console.log(`[API run-tests] Executing on Fly.io app: ${appName}`);
            
            // Use flyctl ssh console to execute the test script
            const command = `flyctl ssh console -a ${appName} -C "${testCommand}"`;
            console.log(`[API run-tests] Command: ${command}`);
            
            try {
                const result = await execAsync(command, { 
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 280000
                });
                stdout = result.stdout;
                stderr = result.stderr;
                console.log(`[API run-tests] Fly.io execution completed`);
            } catch (e: any) {
                console.error('[API run-tests] Fly.io execution failed:', e);
                if (e.stdout || e.stderr) {
                    stdout = e.stdout || '';
                    stderr = e.stderr || '';
                    exitCode = e.code || 1;
                } else {
                    // Critical failure (e.g. timeout or SSH connection error)
                    stderr = e.message || 'Unknown SSH error';
                    exitCode = 1;
                }
            }
        } else {
            // Local Docker Execution
            try {
                let cleanName = '';
                if (session.candidate_id) {
                    const specificContainerName = `hermes-assessment-${session.candidate_id}`;
                    const checkCmd = `docker ps --filter "name=${specificContainerName}" --format "{{.Names}}"`;
                    try {
                        const { stdout: searchOut } = await execAsync(checkCmd);
                        const names = searchOut.trim().split('\n');
                        if (names.some(n => n === specificContainerName || n === `/${specificContainerName}`)) {
                             cleanName = specificContainerName;
                        } else if (searchOut.trim()) {
                             cleanName = searchOut.trim().split('\n')[0];
                        }
                    } catch (e) { }
                }

                if (!cleanName) {
                    const getContainerIdCmd = `docker ps --filter "ancestor=hermes-assessment:latest" --format "{{.Names}}" | head -n 1`;
                    const { stdout: containerName } = await execAsync(getContainerIdCmd);
                    cleanName = containerName.trim();
                }

                if (!cleanName) throw new Error('No local assessment container found');

                console.log(`[API run-tests] Target Container: ${cleanName}`);
                const command = `docker exec ${cleanName} ${testCommand}`;
                const result = await execAsync(command);
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (e: any) {
                if (e.stderr || e.stdout) {
                    stdout = e.stdout || '';
                    stderr = e.stderr || '';
                    exitCode = e.code || 1;
                } else {
                    stderr = e.message || 'Unknown Docker error';
                    exitCode = 1;
                }
            }
        }

        // Capture results
        // We need to read the JSON file from the container to get structured data
        // Or we can parse the stdout if we printed it. 
        // run-tests.sh prints the JSON content at the end.
        // Let's look for the JSON blob in stdout.

        // Find the JSON block between delimiters
        console.log('[API run-tests] Raw stdout from container:', stdout);
        
        // Match content between ___JSON_START___ and ___JSON_END___
        const jsonMatch = stdout.match(/___JSON_START___([\s\S]*?)___JSON_END___/);
        let testResults = null;
        let score = 0;

        if (jsonMatch && jsonMatch[1]) {
            try {
                testResults = JSON.parse(jsonMatch[1].trim());
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

        // Handle post-test cleanup if requested (e.g., on final submission)
        if (destroyAfter) {
            console.log(`[API run-tests] destroyAfter=true, triggering cleanup for sessionId: ${sessionId}`);
            try {
                // 1. If it's a Fly.io app, destroy it
                if (isFlyIo && session.container_url) {
                    const appName = session.container_url.replace('https://', '').replace('.fly.dev', '');
                    await destroyFlyMachine(appName);
                    console.log(`[API run-tests] Destroyed Fly.io app: ${appName}`);
                } 
                // 2. If it's a local Docker container, destroy it
                else if (!isFlyIo && session.candidate_id) {
                    const specificContainerName = `hermes-assessment-${session.candidate_id}`;
                    try {
                        await execAsync(`docker rm -f ${specificContainerName}`);
                        console.log(`[API run-tests] Destroyed local Docker container: ${specificContainerName}`);
                    } catch (dockerError) {
                        console.warn('[API run-tests] Failed to destroy local Docker container:', dockerError);
                    }
                }

                // 3. Update database status to 'stopped'
                const { error: stopError } = await adminSupabase
                    .from('interview_sessions')
                    .update({
                        container_status: 'stopped',
                        container_stopped_at: new Date().toISOString(),
                    })
                    .eq('session_id', sessionId);
                
                if (stopError) {
                    console.error('[API run-tests] Failed to update session status to stopped:', stopError);
                } else {
                    console.log(`[API run-tests] Successfully updated session status to stopped`);
                }
            } catch (cleanupError) {
                console.error('[API run-tests] Failed to cleanup container during run-tests:', cleanupError);
                // We don't fail the response because the tests already ran
            }
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
