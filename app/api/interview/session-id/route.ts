import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/interview/session-id
 * 
 * DEPRECATED: This endpoint previously looked up sessions by repo_url/repo_name.
 * Since repo_url and repo_name have been removed from interview_sessions,
 * sessions should be looked up directly by sessionId.
 * 
 * The sessionId is stored in .hermes/config.json in the assessment repository.
 * 
 * This endpoint is kept for backwards compatibility but will return an error.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Use sessionId directly from .hermes/config.json',
      hint: 'The sessionId is stored in .hermes/config.json in your assessment repository'
    },
    { status: 410 } // 410 Gone - resource is no longer available
  );
}
