import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';  // SWC is ~20x faster than Babel
import path from 'path';

export default defineConfig({
    plugins: [react()],
    cacheDir: '.vitest-cache',  // Vite cache directory (includes Vitest cache)
    test: {
        include: ['tests/**/*.test.{ts,tsx}'],  // Only run assessment tests, not node_modules
        environment: 'happy-dom',  // Faster than jsdom
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 10000,  // 10s default
        hookTimeout: 5000,   // 5s for setup/teardown
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true,  // Single thread for 1 vCPU
                minThreads: 1,
                maxThreads: 1
            }
        },
        watch: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
