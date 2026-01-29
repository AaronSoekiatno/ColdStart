import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        restoreMocks: true,

        // Path alias
        alias: {
            '@': path.resolve(__dirname, './')
        },

        // Mock environment variables
        env: {
            NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key'
        }
    }
});


