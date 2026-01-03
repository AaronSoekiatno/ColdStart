/**
 * Unit tests for session-cache.js
 * 
 * Tests LRU cache operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import cache from '../../lib/session-cache.js';

describe('session-cache', () => {
    beforeEach(() => {
        cache.clear();
    });

    describe('set() and get()', () => {
        it('should store and retrieve session data', () => {
            const sessionData = { id: 'session-1', status: 'active' };
            cache.set('session-1', sessionData);

            const retrieved = cache.get('session-1');
            expect(retrieved).toEqual(sessionData);
        });

        it('should return undefined for non-existent key', () => {
            expect(cache.get('non-existent')).toBeUndefined();
        });

        it('should overwrite existing data', () => {
            cache.set('session-1', { status: 'active' });
            cache.set('session-1', { status: 'completed' });

            expect(cache.get('session-1').status).toBe('completed');
        });

        it('should return the set data', () => {
            const data = { id: 'test' };
            const result = cache.set('session-1', data);
            expect(result).toEqual(data);
        });
    });

    describe('has()', () => {
        it('should return true for existing key', () => {
            cache.set('session-1', { id: 'session-1' });
            expect(cache.has('session-1')).toBe(true);
        });

        it('should return false for non-existent key', () => {
            expect(cache.has('non-existent')).toBe(false);
        });
    });

    describe('delete()', () => {
        it('should remove session from cache', () => {
            cache.set('session-1', { id: 'session-1' });
            cache.delete('session-1');

            expect(cache.has('session-1')).toBe(false);
            expect(cache.get('session-1')).toBeUndefined();
        });

        it('should handle non-existent key gracefully', () => {
            expect(() => cache.delete('non-existent')).not.toThrow();
        });
    });

    describe('clear()', () => {
        it('should remove all sessions', () => {
            cache.set('session-1', { id: 'session-1' });
            cache.set('session-2', { id: 'session-2' });
            cache.set('session-3', { id: 'session-3' });

            cache.clear();

            expect(cache.has('session-1')).toBe(false);
            expect(cache.has('session-2')).toBe(false);
            expect(cache.has('session-3')).toBe(false);
        });
    });

    describe('update()', () => {
        it('should update specific fields', () => {
            cache.set('session-1', {
                id: 'session-1',
                status: 'active',
                phase: 'KICK_OFF'
            });

            const updated = cache.update('session-1', { phase: 'BUILD' });

            expect(updated.id).toBe('session-1');
            expect(updated.status).toBe('active');
            expect(updated.phase).toBe('BUILD');
        });

        it('should return null for non-existent session', () => {
            expect(cache.update('non-existent', { status: 'active' })).toBeNull();
        });

        it('should add new fields', () => {
            cache.set('session-1', { id: 'session-1' });

            const updated = cache.update('session-1', { newField: 'value' });

            expect(updated.newField).toBe('value');
        });

        it('should persist updates to cache', () => {
            cache.set('session-1', { status: 'active' });
            cache.update('session-1', { status: 'completed' });

            const retrieved = cache.get('session-1');
            expect(retrieved.status).toBe('completed');
        });
    });

    describe('stats()', () => {
        it('should return cache statistics', () => {
            cache.set('session-1', { id: 'session-1' });
            cache.set('session-2', { id: 'session-2' });

            const stats = cache.stats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(500);
        });

        it('should track size correctly after operations', () => {
            cache.set('session-1', { id: 'session-1' });
            expect(cache.stats().size).toBe(1);

            cache.set('session-2', { id: 'session-2' });
            expect(cache.stats().size).toBe(2);

            cache.delete('session-1');
            expect(cache.stats().size).toBe(1);

            cache.clear();
            expect(cache.stats().size).toBe(0);
        });
    });

    describe('cache behavior', () => {
        it('should handle complex session objects', () => {
            const complexSession = {
                sessionId: 'test-123',
                candidateId: 'candidate-456',
                currentPhase: 'BUILD',
                phases: {
                    KICK_OFF: { status: 'completed', startTime: '2024-01-01T00:00:00Z' },
                    BUILD: { status: 'active', startTime: '2024-01-01T00:02:00Z' }
                },
                conversationHistory: [
                    { role: 'assistant', content: 'Hello' },
                    { role: 'user', content: 'Hi' }
                ]
            };

            cache.set('complex-session', complexSession);
            const retrieved = cache.get('complex-session');

            expect(retrieved).toEqual(complexSession);
            expect(retrieved.phases.BUILD.status).toBe('active');
            expect(retrieved.conversationHistory).toHaveLength(2);
        });
    });
});
