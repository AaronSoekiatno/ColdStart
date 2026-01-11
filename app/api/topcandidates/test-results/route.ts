import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/topcandidates/test-results?sessionId=...
 * 
 * Retrieves the last test execution results for the given session.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

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

        // Get latest test result from admin_audit
        const { data: result, error: dbError } = await supabase
            .from('assessment_scores')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Use schema admin_audit
        // Note: The above query uses 'public' schema by default unless configured or using rpc.
        // Client library usually defaults to public. We need to specify schema.
        // However, the JS client doesn't easily switch schema for a single query in the same client instance if initialized with default.
        // We can use `.schema('admin_audit')` if available or we might need to rely on the fact we created the table there.

        // Correction: supabase-js supports .schema() modifier.
        const { data: adminResult } = await supabase
            .schema('admin_audit')
            .from('assessment_scores')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!adminResult) {
            return NextResponse.json({ results: null });
        }

        return NextResponse.json({ results: adminResult.test_results, timestamp: adminResult.created_at });

    } catch (error) {
        console.error('Error fetching test results:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
