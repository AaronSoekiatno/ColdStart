/**
 * @deprecated This endpoint is deprecated. Use /api/interview/start instead.
 * 
 * The provisioning_token flow has been removed in favor of session-based authentication
 * for the IDE-based assessment implementation.
 * 
 * This endpoint is kept for backwards compatibility but will return a 410 Gone status.
 */
export default async function handler(req, res) {
  return res.status(410).json({
    error: 'This endpoint has been deprecated',
    message: 'The provisioning_token flow is no longer supported. Please use /api/interview/start with session-based authentication instead.',
    deprecated: true,
  });
}


