/**
 * Track Claude API usage and enforce cost limits per session
 */

export interface CostLimits {
  maxTokensPerRequest: number;
  maxTokensPerSession: number;
  maxRequestsPerSession: number;
}

export interface SessionUsage {
  sessionId: string;
  totalTokens: number;
  requestCount: number;
  lastRequestAt: Date;
}

// Default cost limits
export const DEFAULT_COST_LIMITS: CostLimits = {
  maxTokensPerRequest: 10000,   // ~10k tokens per request
  maxTokensPerSession: 100000,  // ~100k tokens per session
  maxRequestsPerSession: 50,     // Max 50 requests per session
};

// In-memory session tracking (could be moved to Redis/Supabase for production)
const sessionUsageMap = new Map<string, SessionUsage>();

/**
 * Track token usage for a session
 */
export function trackTokenUsage(
  sessionId: string,
  tokensUsed: number
): void {
  const existing = sessionUsageMap.get(sessionId);

  if (existing) {
    existing.totalTokens += tokensUsed;
    existing.requestCount += 1;
    existing.lastRequestAt = new Date();
  } else {
    sessionUsageMap.set(sessionId, {
      sessionId,
      totalTokens: tokensUsed,
      requestCount: 1,
      lastRequestAt: new Date(),
    });
  }
}

/**
 * Check if session can make another request
 */
export function checkSessionLimits(
  sessionId: string,
  estimatedTokens: number,
  limits: CostLimits = DEFAULT_COST_LIMITS
): { allowed: boolean; reason?: string } {
  const usage = sessionUsageMap.get(sessionId);

  if (!usage) {
    // First request - always allowed
    return { allowed: true };
  }

  // Check request count limit
  if (usage.requestCount >= limits.maxRequestsPerSession) {
    return {
      allowed: false,
      reason: `Session request limit reached (${limits.maxRequestsPerSession} requests)`,
    };
  }

  // Check token limit for this request
  if (estimatedTokens > limits.maxTokensPerRequest) {
    return {
      allowed: false,
      reason: `Request exceeds token limit (${estimatedTokens} > ${limits.maxTokensPerRequest})`,
    };
  }

  // Check total session token limit
  if (usage.totalTokens + estimatedTokens > limits.maxTokensPerSession) {
    return {
      allowed: false,
      reason: `Session token limit reached (${usage.totalTokens + estimatedTokens} > ${limits.maxTokensPerSession})`,
    };
  }

  return { allowed: true };
}

/**
 * Get current session usage
 */
export function getSessionUsage(sessionId: string): SessionUsage | null {
  return sessionUsageMap.get(sessionId) || null;
}

/**
 * Reset session usage (useful for testing or admin override)
 */
export function resetSessionUsage(sessionId: string): void {
  sessionUsageMap.delete(sessionId);
}

/**
 * Clean up old sessions (call periodically)
 */
export function cleanupOldSessions(maxAgeHours: number = 24): void {
  const now = new Date();
  const maxAge = maxAgeHours * 60 * 60 * 1000;

  for (const [sessionId, usage] of sessionUsageMap.entries()) {
    const age = now.getTime() - usage.lastRequestAt.getTime();
    if (age > maxAge) {
      sessionUsageMap.delete(sessionId);
    }
  }
}

/**
 * Estimate token count from text (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
