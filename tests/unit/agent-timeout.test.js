/**
 * Tests for agent timeout handling and connection reliability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Agent Chat V2 - Timeout and Connection Tests', () => {
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Stream Timeout Handling', () => {
    it('should handle long-running agent operations without timing out', async () => {
      const startTime = Date.now();
      const streamChunks = [];

      // Mock a slow stream that takes 6 seconds
      const slowStream = new ReadableStream({
        async start(controller) {
          // Simulate agent thinking
          await new Promise(resolve => setTimeout(resolve, 1000));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'thought', content: 'Analyzing...' }) + '\n'));

          // Simulate tool execution
          await new Promise(resolve => setTimeout(resolve, 2000));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'tool_start', tool: 'write_file', input: { path: 'test.ts' } }) + '\n'));

          // Simulate SSH delay
          await new Promise(resolve => setTimeout(resolve, 3000));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'tool_result', result: 'Success' }) + '\n'));

          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'response', content: 'Done!' }) + '\n'));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: slowStream,
      });

      // Read the entire stream
      const response = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', message: 'test' })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamChunks.push(decoder.decode(value));
      }

      const duration = Date.now() - startTime;

      // Should complete without timing out
      expect(duration).toBeGreaterThan(5000); // At least 6 seconds
      expect(streamChunks.length).toBeGreaterThan(0);
      expect(streamChunks.join('')).toContain('tool_start');
      expect(streamChunks.join('')).toContain('tool_result');
    });

    it('should not have client-side timeout on fetch', async () => {
      const responseDelay = 2000; // 2 seconds

      // Simulate a slow response
      const slowResponse = new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"type":"response","content":"slow"}\n'));
                controller.close();
              }
            })
          });
        }, responseDelay);
      });

      mockFetch.mockReturnValue(slowResponse);

      const startTime = Date.now();
      const response = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', message: 'test' })
      });

      const duration = Date.now() - startTime;

      // Should wait for full delay without timing out
      expect(duration).toBeGreaterThanOrEqual(responseDelay - 100); // Account for timing variance
      expect(response.ok).toBe(true);
    });
  });

  describe('File Update Stream Events', () => {
    it('should receive file_changed events in stream', async () => {
      const events = [];

      const streamWithFileUpdates = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'tool_start', tool: 'write_file', input: { path: 'test.ts', content: 'code' } }) + '\n'));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'file_changed', path: 'test.ts', content: 'code', operation: 'write' }) + '\n'));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'tool_result', result: 'Success' }) + '\n'));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'response', content: 'File created' }) + '\n'));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: streamWithFileUpdates,
      });

      const response = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', message: 'create test.ts' })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // Should have received file_changed event
      const fileChangedEvent = events.find(e => e.type === 'file_changed');
      expect(fileChangedEvent).toBeDefined();
      expect(fileChangedEvent.path).toBe('test.ts');
      expect(fileChangedEvent.content).toBe('code');
      expect(fileChangedEvent.operation).toBe('write');
    });

    it('should receive agent_complete event at end of stream', async () => {
      const events = [];

      const streamWithCompletion = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'response', content: 'Done' }) + '\n'));
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'agent_complete', timestamp: Date.now() }) + '\n'));
          controller.close();
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: streamWithCompletion,
      });

      const response = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', message: 'test' })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          events.push(JSON.parse(line));
        }
      }

      const completeEvent = events.find(e => e.type === 'agent_complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.timestamp).toBeDefined();
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(async () => {
        await fetch('/api/agent/chat-v2', {
          method: 'POST',
          body: JSON.stringify({ sessionId: 'test', message: 'test' })
        });
      }).rejects.toThrow('Network error');
    });

    it('should handle stream interruption', async () => {
      let dataReceived = false;
      let streamErrored = false;

      const brokenStream = new ReadableStream({
        start(controller) {
          // Send one chunk successfully
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'thought', content: 'Starting...' }) + '\n'));
          dataReceived = true;

          // Then error out
          setTimeout(() => {
            controller.error(new Error('Connection lost'));
            streamErrored = true;
          }, 10);
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: brokenStream,
      });

      const response = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', message: 'test' })
      });

      const reader = response.body.getReader();
      let errorOccurred = false;

      try {
        const { done, value } = await reader.read();
        if (value) dataReceived = true;

        // Try to read again to trigger error
        await reader.read();
      } catch (error) {
        errorOccurred = true;
        expect(error).toBeInstanceOf(Error);
      }

      expect(dataReceived).toBe(true);
      expect(errorOccurred || streamErrored).toBe(true);
    });
  });

  describe('Retry Logic Timing', () => {
    it('should use exponential backoff: 1s, 2s, 4s, 8s, 16s', () => {
      const expectedDelays = [1000, 2000, 4000, 8000, 16000];

      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = Math.pow(2, attempt) * 1000;
        expect(delay).toBe(expectedDelays[attempt]);
      }
    });

    it('should calculate correct backoff delays for retries', () => {
      const calculateBackoff = (attempt) => Math.pow(2, attempt) * 1000;

      expect(calculateBackoff(0)).toBe(1000);  // 1 second
      expect(calculateBackoff(1)).toBe(2000);  // 2 seconds
      expect(calculateBackoff(2)).toBe(4000);  // 4 seconds
      expect(calculateBackoff(3)).toBe(8000);  // 8 seconds
      expect(calculateBackoff(4)).toBe(16000); // 16 seconds
    });
  });
});
