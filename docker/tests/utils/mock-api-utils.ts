/**
 * Mock API Utilities for Error Handling Tests
 * 
 * Provides reusable API mocking utilities for testing error scenarios,
 * loading states, and network failures.
 */

import { mockPerformanceData } from '@/data/insights/seed-data';

/**
 * Mock API response for successful request
 */
export function mockApiSuccess(data: any = mockPerformanceData) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => data,
    };
}

/**
 * Mock API that returns 500 Internal Server Error
 */
export function mockApiError500() {
    return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Internal Server Error' }),
    };
}

/**
 * Mock API that returns 404 Not Found
 */
export function mockApiError404() {
    return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
    };
}

/**
 * Mock API that returns 401 Unauthorized
 */
export function mockApiError401() {
    return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Unauthorized' }),
    };
}

/**
 * Mock API with configurable delay (for loading state tests)
 * @param data - The data to return after delay
 * @param delayMs - Delay in milliseconds (default: 2000ms)
 */
export function mockApiWithDelay(data: any = mockPerformanceData, delayMs: number = 2000) {
    return new Promise(resolve =>
        setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: async () => data,
        }), delayMs)
    );
}

/**
 * Mock network failure (fetch throws an error)
 */
export function mockNetworkFailure(message: string = 'Network request failed') {
    return Promise.reject(new Error(message));
}

/**
 * Mock flaky API (random failures based on failure rate)
 * @param data - The data to return on success
 * @param failureRate - Probability of failure (0-1, default: 0.5)
 */
export function mockFlakyApi(data: any = mockPerformanceData, failureRate: number = 0.5) {
    if (Math.random() < failureRate) {
        return mockApiError500();
    }
    return mockApiSuccess(data);
}

/**
 * Mock API that times out after specified duration
 * @param timeoutMs - Timeout duration in milliseconds
 */
export function mockApiTimeout(timeoutMs: number = 30000) {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    );
}

/**
 * Create a mock fetch function that can be configured per test
 * @param responses - Array of responses to return in sequence
 */
export function createMockFetch(responses: any[]) {
    let callIndex = 0;
    return () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(response);
    };
}

/**
 * Test data for error handling scenarios
 */
export const testScenarios = {
    success: {
        description: 'Successful API response',
        mock: () => mockApiSuccess(),
    },
    error500: {
        description: 'Internal Server Error (500)',
        mock: () => mockApiError500(),
    },
    error404: {
        description: 'Not Found (404)',
        mock: () => mockApiError404(),
    },
    networkFailure: {
        description: 'Network failure (fetch throws)',
        mock: () => mockNetworkFailure(),
    },
    slowResponse: {
        description: 'Slow API response (2 seconds)',
        mock: () => mockApiWithDelay(mockPerformanceData, 2000),
    },
    timeout: {
        description: 'Request timeout',
        mock: () => mockApiTimeout(5000),
    },
};
