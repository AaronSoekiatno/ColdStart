import { NextRequest, NextResponse } from 'next/server';

// Rate limiting: Track failed attempts by IP
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Get valid access codes from environment variable
// Format: ASSESSMENT_ACCESS_CODES="CODE1,CODE2,CODE3"
function getValidAccessCodes(): string[] {
  const codesEnv = process.env.ASSESSMENT_ACCESS_CODES;
  
  if (!codesEnv) {
    console.warn('⚠️  ASSESSMENT_ACCESS_CODES environment variable not set. Using fallback codes.');
    // Fallback codes for development only
    return process.env.NODE_ENV === 'development' 
      ? ['DEV-TEST-CODE']
      : [];
  }
  
  return codesEnv.split(',').map(code => code.trim().toUpperCase());
}

function getClientIP(request: NextRequest): string {
  // Try to get real IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback to a default (not ideal, but prevents crashes)
  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = failedAttempts.get(ip);
  
  if (!attempts) {
    return false;
  }
  
  // Check if lockout period has expired
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    failedAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const attempts = failedAttempts.get(ip);
  
  if (!attempts) {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    attempts.count += 1;
    attempts.lastAttempt = now;
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    
    // Check rate limiting
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Too many failed attempts. Please try again in 15 minutes.',
          rateLimited: true 
        },
        { status: 429 }
      );
    }
    
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Access code is required' },
        { status: 400 }
      );
    }

    // Normalize the code (uppercase, trim whitespace)
    const normalizedCode = code.trim().toUpperCase();
    
    // Get valid codes from environment
    const validCodes = getValidAccessCodes();
    
    if (validCodes.length === 0) {
      console.error('❌ No valid access codes configured!');
      return NextResponse.json(
        { valid: false, error: 'Access code system not configured' },
        { status: 503 }
      );
    }

    // Check if code is valid
    const isValid = validCodes.includes(normalizedCode);

    if (isValid) {
      // Clear any failed attempts on success
      clearFailedAttempts(clientIP);
      
      // TODO: In production, you should also:
      // 1. Log the successful access to database
      // 2. Track which user used which code
      // 3. Check expiration dates from database
      // 4. Limit number of uses per code
      // 5. Send notification to admin on code usage

      return NextResponse.json(
        { valid: true, message: 'Access granted' },
        { status: 200 }
      );
    }

    // Record failed attempt
    recordFailedAttempt(clientIP);
    
    return NextResponse.json(
      { valid: false, error: 'Invalid access code' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Error verifying access code:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
