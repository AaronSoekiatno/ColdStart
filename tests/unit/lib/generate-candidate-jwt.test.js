/**
 * Unit tests for candidate JWT generation and verification
 *
 * JWT tokens gate candidate assessment access. Security-critical.
 *
 * Tested from: lib/generate-candidate-jwt.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateCandidateJWT, verifyCandidateJWT } from '../../../lib/generate-candidate-jwt.ts';
import * as jwt from 'jsonwebtoken';

describe('Candidate JWT Generation and Verification', () => {
  const TEST_SECRET = 'test-jwt-secret-key-for-testing';
  const TEST_CANDIDATE_ID = 'candidate-123';
  const TEST_SCHEMA_NAME = 'candidate_abc123';

  beforeEach(() => {
    // Set JWT secret for tests
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
  });

  describe('generateCandidateJWT', () => {
    it('should generate valid JWT token', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // JWT should have 3 parts separated by dots
      const parts = token.split('.');
      expect(parts.length).toBe(3);
    });

    it('should include candidate_id in payload', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token);

      expect(decoded.candidate_id).toBe(TEST_CANDIDATE_ID);
      expect(decoded.sub).toBe(TEST_CANDIDATE_ID);
    });

    it('should include schema in payload', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token);

      expect(decoded.schema).toBe(TEST_SCHEMA_NAME);
    });

    it('should include role in payload', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token);

      expect(decoded.role).toBe('authenticated');
    });

    it('should include iat (issued at) timestamp', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const afterTime = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token);

      expect(decoded.iat).toBeGreaterThanOrEqual(beforeTime);
      expect(decoded.iat).toBeLessThanOrEqual(afterTime);
    });

    it('should include exp (expiration) timestamp', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeTruthy();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should default to 24 hour expiration', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token);

      const expectedExp = decoded.iat + (24 * 60 * 60);
      expect(decoded.exp).toBe(expectedExp);
    });

    it('should accept custom expiration hours', () => {
      const customHours = 48;
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, customHours);
      const decoded = jwt.decode(token);

      const expectedExp = decoded.iat + (customHours * 60 * 60);
      expect(decoded.exp).toBe(expectedExp);
    });

    it('should throw error if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;

      expect(() => {
        generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      }).toThrow('JWT secret not found');
    });

    it('should use SUPABASE_JWT_SECRET if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      expect(token).toBeTruthy();

      // Verify it was signed with the SUPABASE_JWT_SECRET
      const decoded = jwt.verify(token, TEST_SECRET);
      expect(decoded.candidate_id).toBe(TEST_CANDIDATE_ID);
    });

    it('should prefer SUPABASE_JWT_SECRET over JWT_SECRET', () => {
      const primarySecret = 'primary-secret';
      const fallbackSecret = 'fallback-secret';

      process.env.SUPABASE_JWT_SECRET = primarySecret;
      process.env.JWT_SECRET = fallbackSecret;

      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      // Should be signed with SUPABASE_JWT_SECRET
      expect(() => jwt.verify(token, primarySecret)).not.toThrow();
      expect(() => jwt.verify(token, fallbackSecret)).toThrow();
    });

    it('should throw error if candidateId is empty', () => {
      expect(() => {
        generateCandidateJWT('', TEST_SCHEMA_NAME);
      }).toThrow('candidateId and schemaName are required');
    });

    it('should throw error if schemaName is empty', () => {
      expect(() => {
        generateCandidateJWT(TEST_CANDIDATE_ID, '');
      }).toThrow('candidateId and schemaName are required');
    });

    it('should throw error if candidateId is null', () => {
      expect(() => {
        generateCandidateJWT(null, TEST_SCHEMA_NAME);
      }).toThrow('candidateId and schemaName are required');
    });

    it('should throw error if schemaName is null', () => {
      expect(() => {
        generateCandidateJWT(TEST_CANDIDATE_ID, null);
      }).toThrow('candidateId and schemaName are required');
    });

    it('should use HS256 algorithm', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded.header.alg).toBe('HS256');
    });

    it('should generate different tokens for different candidates', () => {
      const token1 = generateCandidateJWT('candidate-1', 'schema_1');
      const token2 = generateCandidateJWT('candidate-2', 'schema_2');

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);

      expect(decoded1.candidate_id).toBe('candidate-1');
      expect(decoded2.candidate_id).toBe('candidate-2');
      expect(decoded1.schema).toBe('schema_1');
      expect(decoded2.schema).toBe('schema_2');
    });
  });

  describe('verifyCandidateJWT', () => {
    it('should verify valid token', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      const decoded = verifyCandidateJWT(token);

      expect(decoded.candidate_id).toBe(TEST_CANDIDATE_ID);
      expect(decoded.schema).toBe(TEST_SCHEMA_NAME);
      expect(decoded.role).toBe('authenticated');
    });

    it('should extract all payload fields', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      const decoded = verifyCandidateJWT(token);

      expect(decoded.sub).toBe(TEST_CANDIDATE_ID);
      expect(decoded.candidate_id).toBe(TEST_CANDIDATE_ID);
      expect(decoded.schema).toBe(TEST_SCHEMA_NAME);
      expect(decoded.role).toBe('authenticated');
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
    });

    it('should throw error for expired token', () => {
      // Generate token that expires immediately (0 hours)
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, -1);

      expect(() => {
        verifyCandidateJWT(token);
      }).toThrow('Invalid token');
    });

    it('should throw error for tampered token', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      // Tamper with the token by changing a character
      const tamperedToken = token.slice(0, -1) + 'X';

      expect(() => {
        verifyCandidateJWT(tamperedToken);
      }).toThrow('Invalid token');
    });

    it('should throw error for token signed with wrong secret', () => {
      const wrongSecret = 'wrong-secret';

      // Create token with wrong secret
      const payload = {
        sub: TEST_CANDIDATE_ID,
        candidate_id: TEST_CANDIDATE_ID,
        schema: TEST_SCHEMA_NAME,
        role: 'authenticated'
      };

      const token = jwt.sign(payload, wrongSecret, { algorithm: 'HS256' });

      expect(() => {
        verifyCandidateJWT(token);
      }).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        verifyCandidateJWT('not.a.valid.jwt.token');
      }).toThrow('Invalid token');
    });

    it('should throw error for empty token', () => {
      expect(() => {
        verifyCandidateJWT('');
      }).toThrow('Invalid token');
    });

    it('should throw error if JWT_SECRET is not configured', () => {
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;

      const token = 'some-token';

      expect(() => {
        verifyCandidateJWT(token);
      }).toThrow('JWT secret not configured');
    });

    it('should verify token with SUPABASE_JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      const decoded = verifyCandidateJWT(token);

      expect(decoded.candidate_id).toBe(TEST_CANDIDATE_ID);
    });
  });

  describe('Integration scenarios', () => {
    it('should generate and verify token successfully', () => {
      const candidateId = 'test-candidate-456';
      const schemaName = 'candidate_test456';

      // Generate token
      const token = generateCandidateJWT(candidateId, schemaName);

      // Verify token
      const decoded = verifyCandidateJWT(token);

      expect(decoded.candidate_id).toBe(candidateId);
      expect(decoded.schema).toBe(schemaName);
      expect(decoded.role).toBe('authenticated');
    });

    it('should handle full token lifecycle', () => {
      // Generate token
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, 1);

      // Verify immediately (should pass)
      expect(() => verifyCandidateJWT(token)).not.toThrow();

      // Decode and check expiration
      const decoded = jwt.decode(token);
      expect(decoded.exp - decoded.iat).toBe(60 * 60); // 1 hour in seconds
    });

    it('should generate consistent tokens for same candidate with same timestamp', () => {
      // JWTs with same candidate, schema, and timestamp (within same second) will be identical
      const token1 = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const token2 = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      // Tokens generated in same second should be identical (since iat is in seconds)
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);

      expect(decoded1.candidate_id).toBe(decoded2.candidate_id);
      expect(decoded1.schema).toBe(decoded2.schema);
      expect(decoded1.iat).toBe(decoded2.iat);
    });

    it('should support different schema names for same candidate', () => {
      const schema1 = 'candidate_prod_123';
      const schema2 = 'candidate_staging_123';

      const token1 = generateCandidateJWT(TEST_CANDIDATE_ID, schema1);
      const token2 = generateCandidateJWT(TEST_CANDIDATE_ID, schema2);

      const decoded1 = verifyCandidateJWT(token1);
      const decoded2 = verifyCandidateJWT(token2);

      expect(decoded1.schema).toBe(schema1);
      expect(decoded2.schema).toBe(schema2);
      expect(decoded1.candidate_id).toBe(decoded2.candidate_id);
    });

    it('should generate tokens with custom expiration', () => {
      const shortToken = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, 1);
      const longToken = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, 48);

      const shortDecoded = jwt.decode(shortToken);
      const longDecoded = jwt.decode(longToken);

      const shortExp = shortDecoded.exp - shortDecoded.iat;
      const longExp = longDecoded.exp - longDecoded.iat;

      expect(shortExp).toBe(1 * 60 * 60); // 1 hour
      expect(longExp).toBe(48 * 60 * 60); // 48 hours
    });
  });

  describe('Security considerations', () => {
    it('should not expose secret in token', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token, { complete: true });

      // Verify secret is not in payload or header
      expect(JSON.stringify(decoded)).not.toContain(TEST_SECRET);
    });

    it('should reject token after expiration', () => {
      // Create a token that expires in -1 hours (already expired)
      const expiredToken = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME, -1);

      expect(() => {
        verifyCandidateJWT(expiredToken);
      }).toThrow('Invalid token');
    });

    it('should use strong algorithm (HS256)', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded.header.alg).toBe('HS256');
    });

    it('should reject token with modified payload', () => {
      const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA_NAME);

      // Decode, modify, and re-encode (without proper signing)
      const decoded = jwt.decode(token);
      decoded.role = 'admin'; // Attempt privilege escalation

      const parts = token.split('.');
      const modifiedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64');
      const modifiedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      expect(() => {
        verifyCandidateJWT(modifiedToken);
      }).toThrow('Invalid token');
    });
  });
});
