/**
 * Tests for PII Hashing Middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PIIHashMiddleware } from '../hash-pii';
import type { AnalyticsEventV1 } from '../../types';
import type { PIIConfig } from '../../types/config';

describe('PIIHashMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  const createEvent = (): AnalyticsEventV1 => ({
    id: '01234567-89ab-cdef-0123-456789abcdef',
    schema: 'kb.v1',
    type: 'test.event',
    ts: new Date().toISOString(),
    ingestTs: new Date().toISOString(),
    source: {
      product: '@kb-labs/test',
      version: '0.1.0',
    },
    runId: 'run_123',
    actor: {
      type: 'user',
      id: 'u_123',
      name: 'John Doe',
    },
    ctx: {
      repo: 'kb-labs/umbrella',
      branch: 'feature/new-feature',
      commit: 'abc123',
    },
  });

  it('should not hash when disabled', () => {
    const config: PIIConfig = {
      hash: { enabled: false },
      fields: ['actor.id'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    expect(processed.actor?.id).toBe('u_123');
    expect(processed.hashMeta).toBeUndefined();
  });

  it('should not hash when salt is not set', () => {
    delete process.env.KB_ANALYTICS_SALT;
    const config: PIIConfig = {
      hash: { enabled: true },
      fields: ['actor.id'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    expect(processed.actor?.id).toBe('u_123');
    expect(middleware.isEnabled()).toBe(false);
  });

  it('should hash configured fields', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    const config: PIIConfig = {
      hash: {
        enabled: true,
        saltId: 'default-2025-10',
      },
      fields: ['actor.id', 'actor.name'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    expect(processed.actor?.id).not.toBe('u_123');
    expect(processed.actor?.id).toMatch(/^[a-f0-9]{64}$/i);
    expect(processed.actor?.name).not.toBe('John Doe');
    expect(processed.actor?.name).toMatch(/^[a-f0-9]{64}$/i);
    expect(processed.ctx?.repo).toBe('kb-labs/umbrella'); // Not in fields list
    expect(processed.hashMeta?.algo).toBe('hmac-sha256');
    expect(processed.hashMeta?.saltId).toBe('default-2025-10');
  });

  it('should hash nested paths', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    const config: PIIConfig = {
      hash: {
        enabled: true,
        saltId: 'default-2025-10',
      },
      fields: ['ctx.repo', 'ctx.branch'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    expect(processed.ctx?.repo).not.toBe('kb-labs/umbrella');
    expect(processed.ctx?.repo).toMatch(/^[a-f0-9]{64}$/i);
    expect(processed.ctx?.branch).not.toBe('feature/new-feature');
    expect(processed.ctx?.branch).toMatch(/^[a-f0-9]{64}$/i);
    expect(processed.actor?.id).toBe('u_123'); // Not in fields list
  });

  it('should use pepper if provided', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    process.env.KB_ANALYTICS_PEPPER = 'test-pepper-456';
    const config: PIIConfig = {
      hash: {
        enabled: true,
        saltId: 'default-2025-10',
      },
      fields: ['actor.id'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    // Should produce different hash with pepper
    expect(processed.actor?.id).not.toBe('u_123');
    expect(processed.actor?.id).toMatch(/^[a-f0-9]{64}$/i);
  });

  it('should generate saltId if not provided', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    const config: PIIConfig = {
      hash: {
        enabled: true,
      },
      fields: ['actor.id'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    expect(processed.hashMeta?.saltId).toBeDefined();
    expect(processed.hashMeta?.saltId).toMatch(/^default-\d{4}-\d{2}$/);
  });

  it('should not modify original event', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    const config: PIIConfig = {
      hash: {
        enabled: true,
        saltId: 'default-2025-10',
      },
      fields: ['actor.id'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();
    const originalId = event.actor?.id;

    const processed = middleware.process(event);

    // Original should be unchanged
    expect(event.actor?.id).toBe(originalId);
    // Processed should be hashed
    expect(processed.actor?.id).not.toBe(originalId);
  });

  it('should detect if value is already hashed', () => {
    expect(PIIHashMiddleware.isHashed('abc123def456')).toBe(false);
    expect(PIIHashMiddleware.isHashed('a'.repeat(64))).toBe(true);
    expect(PIIHashMiddleware.isHashed('A'.repeat(64))).toBe(true);
    expect(PIIHashMiddleware.isHashed('123')).toBe(false);
    expect(PIIHashMiddleware.isHashed(null)).toBe(false);
    expect(PIIHashMiddleware.isHashed(undefined)).toBe(false);
  });

  it('should handle missing fields gracefully', () => {
    process.env.KB_ANALYTICS_SALT = 'test-salt-123';
    const config: PIIConfig = {
      hash: {
        enabled: true,
        saltId: 'default-2025-10',
      },
      fields: ['actor.nonExistent', 'ctx.missing'],
    };
    const middleware = new PIIHashMiddleware(config);
    const event = createEvent();

    const processed = middleware.process(event);

    // Should not crash and should preserve event structure
    expect(processed.actor?.id).toBe('u_123');
    expect(processed.hashMeta?.saltId).toBe('default-2025-10');
  });
});

