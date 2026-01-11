/**
 * Assessment Scoring Tests - Error Handling & UX
 * 
 * FORCING PRODUCTION-READY CODE: Tests that verify candidates handle
 * error states, loading states, and edge cases properly.
 * 
 * Total: 15 points
 * - Flaky API (500 Error): 5 points
 * - Loading State: 5 points
 * - Network Failure: 3 points
 * - Error Boundary (Bonus): 2 points
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import {
    mockApiError500,
    mockApiWithDelay,
    mockNetworkFailure,
    mockApiSuccess,
} from '../utils/mock-api-utils';
import { mockPerformanceData } from '@/data/insights/seed-data';
import {
    hasErrorStateManagement,
    hasLoadingStateManagement,
    hasTryCatchBlock,
} from '../utils/ast-analyzer';

// Read the actual source file for AST analysis
const insightsPagePath = path.join(process.cwd(), 'app/insights/page.tsx');
const insightsPageContent = fs.existsSync(insightsPagePath)
    ? fs.readFileSync(insightsPagePath, 'utf-8')
    : '';

describe('Error Handling & UX (15 points)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // FLAKY API - 500 ERROR HANDLING (5 points)
    // ========================================

    describe('Flaky API - 500 Error (5 points)', () => {
        it('should display error message when API returns 500', async () => {
            // Mock 500 error response
            (global.fetch as any).mockResolvedValueOnce(mockApiError500());

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            // Verify error message appears in the DOM
            await waitFor(() => {
                // Look for common error message patterns
                const errorPatterns = [
                    /failed to load/i,
                    /error/i,
                    /something went wrong/i,
                    /unable to load/i,
                    /couldn't load/i,
                ];

                const hasError = errorPatterns.some(pattern => {
                    try {
                        return screen.getByText(pattern);
                    } catch {
                        return false;
                    }
                });

                expect(hasError).toBe(true);
            }, { timeout: 3000 });
        });

        it('should not crash when API returns 500', async () => {
            // Mock 500 error response
            (global.fetch as any).mockResolvedValueOnce(mockApiError500());

            const { default: InsightsPage } = await import('@/app/insights/page');

            // Should render without throwing an error
            expect(() => render(<InsightsPage />)).not.toThrow();
        });

        it('should have error state management in code', () => {
            // AST check: verify useState with error-related variable exists
            expect(hasErrorStateManagement(insightsPageContent)).toBe(true);
        });
    });

    // ========================================
    // LOADING STATE VERIFICATION (5 points)
    // ========================================

    describe('Loading State (5 points)', () => {
        it('should show loading indicator while fetching', async () => {
            // Mock delayed response (simulates slow API)
            (global.fetch as any).mockImplementation(() =>
                mockApiWithDelay(mockPerformanceData, 2000)
            );

            const { default: InsightsPage } = await import('@/app/insights/page');
            const { container } = render(<InsightsPage />);

            // Check for loading state immediately (before data loads)
            // Accept various loading indicator patterns
            const loadingIndicators = [
                // Text-based
                screen.queryByText(/loading/i),
                screen.queryByText(/please wait/i),
                // Test ID based
                container.querySelector('[data-testid="loading"]'),
                container.querySelector('[data-testid="spinner"]'),
                container.querySelector('[data-testid="skeleton"]'),
                // Class-based (common spinner classes)
                container.querySelector('.animate-spin'),
                container.querySelector('.spinner'),
                container.querySelector('.loading'),
                container.querySelector('.skeleton'),
                // Role-based
                container.querySelector('[role="status"]'),
                container.querySelector('[aria-busy="true"]'),
            ];

            const hasLoadingIndicator = loadingIndicators.some(el => el !== null);
            expect(hasLoadingIndicator).toBe(true);
        });

        it('should hide loading state after data loads', async () => {
            // Mock successful response
            (global.fetch as any).mockResolvedValueOnce(mockApiSuccess());

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            // Wait for data to load
            await waitFor(() => {
                // Look for any content from the mock data
                const contentFound = mockPerformanceData.some(item => {
                    try {
                        return screen.getByText(new RegExp(item.title, 'i'));
                    } catch {
                        return false;
                    }
                });
                expect(contentFound).toBe(true);
            }, { timeout: 3000 });

            // Loading indicator should be gone
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        it('should have loading state management in code', () => {
            // AST check: verify useState with loading-related variable exists
            expect(hasLoadingStateManagement(insightsPageContent)).toBe(true);
        });
    });

    // ========================================
    // NETWORK FAILURE HANDLING (3 points)
    // ========================================

    describe('Network Failure (3 points)', () => {
        it('should handle network errors gracefully (no crash)', async () => {
            // Mock network failure (fetch throws)
            (global.fetch as any).mockImplementation(() => mockNetworkFailure());

            const { default: InsightsPage } = await import('@/app/insights/page');

            // Should not crash when rendering
            expect(() => render(<InsightsPage />)).not.toThrow();
        });

        it('should display error message on network failure', async () => {
            // Mock network failure
            (global.fetch as any).mockImplementation(() => mockNetworkFailure());

            const { default: InsightsPage } = await import('@/app/insights/page');
            render(<InsightsPage />);

            // Verify error message appears
            await waitFor(() => {
                const errorPatterns = [
                    /failed/i,
                    /error/i,
                    /network/i,
                    /unavailable/i,
                    /offline/i,
                    /try again/i,
                ];

                const hasError = errorPatterns.some(pattern => {
                    try {
                        return screen.getByText(pattern);
                    } catch {
                        return false;
                    }
                });

                expect(hasError).toBe(true);
            }, { timeout: 3000 });
        });

        it('should have try-catch or error handling in code', () => {
            // AST check: verify try-catch exists or .catch() is used
            expect(hasTryCatchBlock(insightsPageContent)).toBe(true);
        });
    });

    // ========================================
    // ERROR BOUNDARY DETECTION (2 points - BONUS)
    // ========================================

    describe('Error Boundary (2 points - Bonus)', () => {
        it('should use ErrorBoundary component or equivalent', () => {
            // Check for ErrorBoundary import or usage
            const hasErrorBoundary =
                insightsPageContent.includes('ErrorBoundary') ||
                insightsPageContent.includes('error-boundary') ||
                insightsPageContent.includes('componentDidCatch') ||
                insightsPageContent.includes('getDerivedStateFromError');

            // This is a bonus test - we expect it to fail for most implementations
            // but reward candidates who go the extra mile
            expect(hasErrorBoundary).toBe(true);
        });
    });
});
