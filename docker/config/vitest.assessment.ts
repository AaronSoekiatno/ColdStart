import { defineConfig } from 'vitest/config';
// @ts-ignore - Dependency available in container
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    cacheDir: '/workspace/.vitest-cache',
    test: {
        root: '/workspace',
        // Run tests from the secure location
        include: ['/usr/local/share/assessment/tests/**/*.test.{ts,tsx}'],
        environment: 'happy-dom',
        globals: true,
        // Use the setup file from the secure location
        setupFiles: ['/usr/local/share/assessment/tests/setup.ts'],
        testTimeout: 10000,
        hookTimeout: 5000,
        pool: 'threads',
        // @ts-ignore - Vitest types mismatch in local dev vs container
        poolOptions: {
            threads: {
                singleThread: true,
                minThreads: 1,
                maxThreads: 1
            }
        },
        watch: false,
    },
    resolve: {
        alias: {
            // Map '@' to the workspace root where candidate code lives
            '@': '/workspace',
        },
    },
});
