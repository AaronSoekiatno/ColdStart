/**
 * Vitest setup file for jsdom environment
 * Provides mocks for browser APIs not available in jsdom
 */

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        // Store callback for potential testing
        this.callback = callback;
    }

    private callback: ResizeObserverCallback;

    observe() {
        // Mock observe - do nothing in tests
    }

    unobserve() {
        // Mock unobserve - do nothing in tests
    }

    disconnect() {
        // Mock disconnect - do nothing in tests
    }
};

// Mock IntersectionObserver (if needed in future)
global.IntersectionObserver = class IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
    }

    private callback: IntersectionObserverCallback;

    observe() {
        // Mock observe - do nothing in tests
    }

    unobserve() {
        // Mock unobserve - do nothing in tests
    }

    disconnect() {
        // Mock disconnect - do nothing in tests
    }

    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
};
