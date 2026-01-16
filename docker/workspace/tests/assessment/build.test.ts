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
            try {
                // Run TypeScript compiler in no-emit mode (type checking only)
                // This is MUCH faster than full Next.js build (~5s vs 2min)
                // and catches the same issues that would break production build
                console.log('Running TypeScript type checking...');
                execSync('npx tsc --noEmit', {
                    encoding: 'utf-8',
                    timeout: 30000, // 30 seconds (plenty for type checking)
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
        }, 30000); // 30 second timeout

        it('should have valid tsconfig.json configuration', () => {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            expect(fs.existsSync(tsconfigPath)).toBe(true);

            // Verify it can be parsed
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            expect(tsconfig.compilerOptions).toBeDefined();
        });
    });
});
