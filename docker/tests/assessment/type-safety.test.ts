/**
 * Assessment Scoring Tests - Type Safety Quality
 * 
 * These tests detect excessive 'any' type usage to prevent "Red Code".
 * Using 'any' everywhere bypasses TypeScript's type checking.
 * 
 * Penalty: -5 points if excessive any usage detected
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

describe('Type Safety Quality (-5 penalty if violated)', () => {

    describe('TypeScript Strict Configuration', () => {
        it('should have strict mode or noImplicitAny enabled', () => {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');

            if (!fs.existsSync(tsconfigPath)) {
                // If no tsconfig, skip this check
                return;
            }

            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            const compilerOptions = tsconfig.compilerOptions || {};

            const hasStrictMode = compilerOptions.strict === true;
            const hasNoImplicitAny = compilerOptions.noImplicitAny === true;

            // Pass if either strict mode or noImplicitAny is enabled
            expect(hasStrictMode || hasNoImplicitAny).toBe(true);
        });
    });

    describe('Minimal Any Type Usage', () => {
        it('should have minimal explicit any types in insights implementation', () => {
            // Focus on the insights implementation since that's what they're building
            const insightsFiles = [
                path.join(process.cwd(), 'app/insights/page.tsx'),
                path.join(process.cwd(), 'app/api/insights/performance/route.ts'),
                path.join(process.cwd(), 'app/api/insights/generate-summary/route.ts'),
            ];

            let totalAnyCount = 0;
            const fileDetails: Array<{ file: string; count: number }> = [];

            for (const file of insightsFiles) {
                if (!fs.existsSync(file)) {
                    continue;
                }

                const content = fs.readFileSync(file, 'utf-8');

                // Match explicit any type annotations
                // Patterns: : any, <any>, any[], Array<any>, Record<string, any>
                const anyPattern = /:\s*any\b|<any>|any\[\]|Array<any>|Record<[^,]+,\s*any>/g;
                const matches = content.match(anyPattern) || [];

                if (matches.length > 0) {
                    fileDetails.push({
                        file: path.basename(file),
                        count: matches.length
                    });
                    totalAnyCount += matches.length;
                }
            }

            // Allow up to 3 instances across all files
            // This accommodates legitimate uses like error handling
            if (totalAnyCount > 3) {
                const details = fileDetails
                    .map(f => `${f.file}: ${f.count} instance(s)`)
                    .join(', ');
                throw new Error(
                    `Excessive 'any' type usage detected (${totalAnyCount} instances). ` +
                    `This bypasses TypeScript's type safety. Details: ${details}. ` +
                    `Limit: 3 instances across all files.`
                );
            }

            expect(totalAnyCount).toBeLessThanOrEqual(3);
        });
    });
});
