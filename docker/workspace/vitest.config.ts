import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 120000, // 2 minutes for build tests
        hookTimeout: 30000,   // 30 seconds for setup/teardown
        cache: false, // Disable cache to avoid permission issues
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
