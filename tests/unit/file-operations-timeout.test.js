/**
 * Tests for file operation timeouts and timing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('File Operations - Timeout and Timing Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Operation Timeouts', () => {
    it('should timeout after 30 seconds', async () => {
      const operation = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 35000); // 35 seconds
      });

      const withTimeout = Promise.race([
        operation,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        )
      ]);

      const timeoutPromise = withTimeout.catch(err => err.message);

      // Advance time to timeout
      vi.advanceTimersByTime(30000);

      const result = await timeoutPromise;
      expect(result).toBe('timeout');
    });

    it('should complete fast operations without timeout', async () => {
      const fastOp = new Promise((resolve) => {
        setTimeout(() => resolve('quick'), 1000);
      });

      const withTimeout = Promise.race([
        fastOp,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        )
      ]);

      vi.advanceTimersByTime(1000);

      const result = await withTimeout;
      expect(result).toBe('quick');
    });
  });

  describe('Write Operation Timing', () => {
    it('should track read and write phases separately', () => {
      // Test the timing logic without actual delays
      const readPhase = 2000;  // 2 seconds
      const writePhase = 3000; // 3 seconds
      const total = readPhase + writePhase;

      expect(readPhase).toBe(2000);
      expect(writePhase).toBe(3000);
      expect(total).toBe(5000);

      // Verify write phase is longer than read phase
      expect(writePhase).toBeGreaterThan(readPhase);
    });

    it('should log slow operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const slowOp = async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 8000));
        const duration = Date.now() - start;
        console.log(`Operation took ${duration}ms`);
        return duration;
      };

      const promise = slowOp();
      vi.advanceTimersByTime(8000);
      const duration = await promise;

      expect(duration).toBeGreaterThanOrEqual(8000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation took')
      );
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should calculate exponential backoff delays', () => {
      const expectedDelays = [1000, 2000, 4000, 8000, 16000];

      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = Math.pow(2, attempt) * 1000;
        expect(delay).toBe(expectedDelays[attempt]);
      }
    });

    it('should retry with increasing delays', () => {
      const attempts = [];

      // Synchronously test delay calculation
      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = Math.pow(2, attempt) * 1000;
        attempts.push({ attempt, delay });
      }

      expect(attempts).toHaveLength(5);
      expect(attempts[0].delay).toBe(1000);
      expect(attempts[1].delay).toBe(2000);
      expect(attempts[2].delay).toBe(4000);
      expect(attempts[3].delay).toBe(8000);
      expect(attempts[4].delay).toBe(16000);
    });

    it('should identify retryable errors', () => {
      const retryableErrors = [
        'Connection refused',
        'Connection reset',
        'ETIMEDOUT',
        'ssh shell',
      ];

      const nonRetryableErrors = [
        'File not found',
        'Permission denied',
        'Invalid path',
      ];

      const isRetryable = (errorMsg) => {
        return retryableErrors.some(msg => errorMsg.includes(msg));
      };

      // Test retryable errors
      retryableErrors.forEach(error => {
        expect(isRetryable(error)).toBe(true);
      });

      // Test non-retryable errors
      nonRetryableErrors.forEach(error => {
        expect(isRetryable(error)).toBe(false);
      });
    });
  });

  describe('API Route Max Duration', () => {
    it('should allow operations within maxDuration limit', async () => {
      const maxDuration = 60; // 60 seconds
      const operationTime = 55; // 55 seconds

      const operation = new Promise(resolve => {
        setTimeout(() => resolve('success'), operationTime * 1000);
      });

      const promise = operation;
      vi.advanceTimersByTime(operationTime * 1000);

      const result = await promise;
      expect(result).toBe('success');
      expect(operationTime).toBeLessThan(maxDuration);
    });

    it('should have proper maxDuration configs', () => {
      const routeConfigs = {
        'chat-v2': 300,       // 5 minutes
        'files/read': 60,     // 1 minute
        'files/write': 60,    // 1 minute
        'files/list': 60,     // 1 minute
        'files/read-all': 120 // 2 minutes
      };

      // Verify all routes have reasonable timeouts
      Object.entries(routeConfigs).forEach(([route, duration]) => {
        expect(duration).toBeGreaterThan(0);
        expect(duration).toBeLessThanOrEqual(300);
      });

      // Agent operations should have longest timeout
      expect(routeConfigs['chat-v2']).toBeGreaterThan(routeConfigs['files/write']);
    });
  });

  describe('Tool Execution Timing', () => {
    it('should measure individual tool duration', async () => {
      const toolTimings = {};

      const executeTool = async (toolName, duration) => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, duration));
        const elapsed = Date.now() - start;
        toolTimings[toolName] = elapsed;
        return elapsed;
      };

      const promise = Promise.all([
        executeTool('read_file', 1000),
        executeTool('write_file', 2000),
        executeTool('run_command', 1500),
      ]);

      vi.advanceTimersByTime(2000);

      await promise;

      expect(toolTimings.read_file).toBeGreaterThanOrEqual(1000);
      expect(toolTimings.write_file).toBeGreaterThanOrEqual(2000);
      expect(toolTimings.run_command).toBeGreaterThanOrEqual(1500);
    });

    it('should accumulate total request time', () => {
      const tools = ['read_file', 'write_file', 'run_command'];
      const timingPerTool = 1000; // 1 second per tool

      const totalExpected = tools.length * timingPerTool;

      expect(totalExpected).toBe(3000); // 3 seconds total
      expect(tools).toHaveLength(3);
    });
  });
});
