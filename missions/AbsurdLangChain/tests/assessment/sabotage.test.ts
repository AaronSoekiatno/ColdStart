/**
 * Assessment Scoring Tests - Sabotage Detection
 * 
 * These tests detect if candidates have removed critical infrastructure
 * to make the assessment easier.
 * 
 * Penalty: -10 points if SQL index is removed
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Sabotage Detection', () => {

    describe('SQL Index Check (-10 penalty if missing)', () => {
        it('should have CREATE INDEX in migration files', () => {
            const migrationsPath = path.join(process.cwd(), 'supabase/migrations');

            // Check if migrations directory exists
            if (!fs.existsSync(migrationsPath)) {
                // No migrations directory - this might be expected if not using Supabase
                // Don't fail, just skip
                return;
            }

            // Find all SQL files in migrations
            const sqlFiles = fs.readdirSync(migrationsPath)
                .filter(file => file.endsWith('.sql'));

            // Check if any SQL file contains CREATE INDEX
            let hasIndex = false;
            for (const file of sqlFiles) {
                const content = fs.readFileSync(path.join(migrationsPath, file), 'utf-8');
                if (content.includes('CREATE INDEX')) {
                    hasIndex = true;
                    break;
                }
            }

            expect(hasIndex).toBe(true);
        });
    });
});
