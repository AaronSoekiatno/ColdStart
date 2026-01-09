import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test file patterns
        include: ['tests/unit/**/*.test.js'],

        // Environment
        environment: 'node',

        // Globals (describe, it, expect available without imports)
        globals: true,

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['lib/**/*.js'],
            exclude: ['lib/supabase-schema.sql']
        },

        // Timeout for tests
        testTimeout: 10000,

        // Mock reset between tests
        mockReset: true,
        restoreMocks: true
    }
});
