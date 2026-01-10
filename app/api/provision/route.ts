import { NextResponse } from 'next/server';

/**
 * GET /api/provision
 *
 * DEPRECATED: This endpoint is no longer used.
 * Candidates must complete onboarding and use /api/topcandidates/provision instead.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated. Please complete onboarding at https://joinhermes.co to start the assessment.',
      redirect: 'https://joinhermes.co',
    },
    { status: 410 } // 410 Gone
  );
}
