import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',  // Faster than jsdom
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 10000,  // 10s default (was 120s)
        hookTimeout: 5000,   // 5s for setup/teardown
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true,  // Single thread for 1 vCPU
                minThreads: 1,
                maxThreads: 1        // Prevent thread contention
            }
        },
        // Disable cache to save memory
        cache: false,
        // Disable file watching in production container
        watch: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
