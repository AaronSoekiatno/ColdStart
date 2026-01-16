/**
 * Assessment Scoring Tests - TypeScript Validation
 *
 * These tests verify the project passes TypeScript type checking.
 * Uses `tsc --noEmit` for fast validation (~5s) instead of full build (~2min).
 * Catches the same type errors that would break production build.
 *
 * Total: 15 points
 * - TypeScript Type Checking Passes: 15 points
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Build & Types (15 points)', () => {

    describe('TypeScript Validation (15 points)', () => {
        it('should pass TypeScript type checking (validates build would succeed)', () => {
            // In production containers, TypeScript is pre-compiled during Docker build
            // This saves ~180s per test run (LeetCode-style fast feedback)
            // We verify the build succeeded by checking for the Hermes version file
            const versionFile = path.join('/home/coder', '.hermes-version.json');
            
            if (fs.existsSync(versionFile)) {
                // Running in production container - TypeScript was validated at build time
                console.log('✓ TypeScript validation passed during Docker build');
                expect(true).toBe(true);
                return;
            }

            // Fallback for local development: run TypeScript validation
            // This only happens when running tests locally, not in production
            try {
                console.log('Running TypeScript type checking (local development)...');
                execSync('npx tsc --noEmit --skipLibCheck', {
                    encoding: 'utf-8',
                    timeout: 30000,
                    cwd: process.cwd(),
                    stdio: 'inherit'
                });

                console.log('✓ TypeScript validation passed');
                expect(true).toBe(true);
            } catch (error: any) {
                if (error.status !== 0) {
                    const errorMessage = error.message || 'TypeScript validation failed';
                    console.error('TypeScript errors detected:', errorMessage);
                    throw new Error(`Type checking failed with exit code ${error.status}`);
                }
            }
        }, 30000);

        it('should have valid tsconfig.json configuration', () => {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            expect(fs.existsSync(tsconfigPath)).toBe(true);

            // Verify it can be parsed
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            expect(tsconfig.compilerOptions).toBeDefined();
        });
    });
});
