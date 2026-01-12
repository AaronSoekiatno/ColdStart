/**
 * Assessment Scoring Tests - Core Completion Requirements
 * 
 * INTEGRATION-FIRST APPROACH: RTL integration tests + AST analysis
 * 
 * Total: 30 points (Core Requirements)
 * - Locked State Removed: 5 points (static text checks)
 * - Data Fetching + Display: 20 points (integration - actually renders with correct data)
 * - High Performers: 5 points (integration - styling actually applied)
 * 
 * Additional 15 points for Error Handling & UX are tested in error-handling.test.tsx
 * Grand Total: 45 points across all assessment tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeCode, hasDataFetching, hasArrayMapping } from '../utils/ast-analyzer';

// Read the actual source file for analysis
const insightsPagePath = path.join(process.cwd(), 'app/insights/page.tsx');
const insightsPageContent = fs.existsSync(insightsPagePath)
    ? fs.readFileSync(insightsPagePath, 'utf-8')
    : '';

describe('Core Requirements (35 points)', () => {

    // ========================================
    // STATIC ANALYSIS TESTS (10 points)
    // ========================================

    describe('Locked State Removed (5 points)', () => {
        it('should not contain the lock emoji in source code', () => {
            expect(insightsPageContent).not.toContain('🔒');
        });

        it('should not have "Locked" in the page title', () => {
            expect(insightsPageContent.toLowerCase()).not.toMatch(/insights\s*(tab)?\s*locked/i);
        });

        it('should not display the locked placeholder message', () => {
            expect(insightsPageContent).not.toContain('Complete the mission to unlock');
        });
    });

    // ========================================
    // INTEGRATION TESTS (25 points)
    // ========================================

    describe('Data Fetching + Display (15 points)', () => {
        beforeEach(() => {
            // Reset fetch mock before each test
            vi.clearAllMocks();
            global.fetch = vi.fn();
        });

        it('should fetch data from the performance API and render it', async () => {
            // Mock successful API response
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [{
                    id: 1,
                    title: 'Test Script Alpha',
                    viral_score: 85,
                    views: 1000,
                    likes: 50,
                    shares: 25
                }]
            });

            // Dynamically import the page component
            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            // Verify API was called
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/insights/performance')
                );
            });

            // Verify data is rendered in the DOM
            await waitFor(() => {
                expect(screen.getByText(/Test Script Alpha/i)).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should display viral_score values in the DOM', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [{
                    id: 1,
                    title: 'Script',
                    viral_score: 92,
                    views: 500
                }]
            });

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            await waitFor(() => {
                // Look for the score value (92) in the document
                expect(screen.getByText(/92/)).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should display views values in the DOM', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [{
                    id: 1,
                    title: 'Script',
                    viral_score: 80,
                    views: 1500
                }]
            });

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            await waitFor(() => {
                // Look for the views value (1500) in the document
                expect(screen.getByText(/1500/)).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should use array mapping to display multiple items', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    { id: 1, title: 'Script One', viral_score: 80, views: 100 },
                    { id: 2, title: 'Script Two', viral_score: 90, views: 200 }
                ]
            });

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            await waitFor(() => {
                expect(screen.getByText(/Script One/i)).toBeInTheDocument();
                expect(screen.getByText(/Script Two/i)).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should have data fetching code structure', () => {
            // AST check: verify fetch/useEffect exists in code
            expect(hasDataFetching(insightsPageContent)).toBe(true);
        });
    });

    describe('High Performers Highlighted (10 points)', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            global.fetch = vi.fn();
        });

        it('should apply different styling to high performers vs normal items', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    { id: 1, title: 'High Performer', viral_score: 90, views: 1000 },
                    { id: 2, title: 'Normal Item', viral_score: 50, views: 100 }
                ]
            });

            const { default: InsightsPage } = await import('@/app/insights/page');
            const { container } = render(<InsightsPage />);

            await waitFor(() => {
                expect(screen.getByText(/High Performer/i)).toBeInTheDocument();
                expect(screen.getByText(/Normal Item/i)).toBeInTheDocument();
            }, { timeout: 3000 });

            // Find the elements
            const highElement = screen.getByText(/High Performer/i).closest('[class]');
            const normalElement = screen.getByText(/Normal Item/i).closest('[class]');

            // Verify they have different classes (indicating different styling)
            expect(highElement?.className).toBeTruthy();
            expect(normalElement?.className).toBeTruthy();
            expect(highElement?.className).not.toBe(normalElement?.className);
        });
    });
});
