import * as jwt from 'jsonwebtoken';

/**
 * Generate a schema-specific JWT token for a candidate.
 * This token includes claims that allow the candidate to access their private schema.
 * 
 * @param candidateId - The candidate's UUID
 * @param schemaName - The Postgres schema name (e.g., "candidate_abc123")
 * @param expiresInHours - Token expiration in hours (default: 24)
 * @returns Signed JWT token string
 */
export function generateCandidateJWT(
  candidateId: string,
  schemaName: string,
  expiresInHours: number = 24
): string {
  // Check both SUPABASE_JWT_SECRET and JWT_SECRET for flexibility
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error(
      'JWT secret not found. Please set SUPABASE_JWT_SECRET or JWT_SECRET environment variable. ' +
      'Get it from: Supabase Dashboard > Settings > API > JWT Secret'
    );
  }

  if (!candidateId || !schemaName) {
    throw new Error('candidateId and schemaName are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (expiresInHours * 60 * 60);

  const payload = {
    sub: candidateId,
    candidate_id: candidateId,
    schema: schemaName,
    role: 'authenticated',
    iat: now,
    exp: expiresAt,
  };

  try {
    const token = jwt.sign(payload, jwtSecret, {
      algorithm: 'HS256',
    });

    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate JWT token: ${errorMessage}`);
  }
}

