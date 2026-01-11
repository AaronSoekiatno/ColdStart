/**
 * Assessment Scoring Tests - Build Verification
 * 
 * These tests verify the project actually builds and passes TypeScript checks.
 * Note: Next.js build includes TypeScript checking, so we only need one test.
 * 
 * Total: 15 points
 * - Build Succeeds (includes TypeScript validation): 15 points
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Build & Types (15 points)', () => {

    describe('Production Build (15 points)', () => {
        it('should build the Next.js application successfully with TypeScript validation', () => {
            try {
                // Next.js build automatically runs TypeScript checking
                // This single command validates both build and types
                execSync('yarn build', {
                    encoding: 'utf-8',
                    timeout: 120000, // 2 minutes
                    cwd: process.cwd(),
                    stdio: 'inherit' // Show build output in console
                });

                // If we got here without throwing, build succeeded
                expect(true).toBe(true);
            } catch (error: any) {
                // Only fail if the command actually failed (non-zero exit code)
                if (error.status !== 0) {
                    const errorMessage = error.message || 'Build failed';
                    console.error('Build failed:', errorMessage);
                    throw new Error(`Build failed with exit code ${error.status}`);
                }
            }
        }, 120000); // 2 minute timeout for this test

        it('should have a valid build output directory', () => {
            // After build succeeds, check for Next.js output
            const buildPath = path.join(process.cwd(), '.next');
            expect(fs.existsSync(buildPath)).toBe(true);
        });
    });
});
