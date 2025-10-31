/**
 * Tests for AnalyticsEventV1 schema validation
 */

import { describe, it, expect } from 'vitest';
import { validateEvent, safeValidateEvent } from '../event-v1';

describe('AnalyticsEventV1 schema validation', () => {
  it('should validate a complete valid event', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      type: 'audit.run.finished',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/audit',
        version: '0.1.0',
      },
      runId: 'run_2025-10-31T18-07-40Z_audit',
      actor: {
        type: 'user',
        id: 'u_123',
      },
      ctx: {
        repo: 'kb-labs/umbrella',
        branch: 'main',
        commit: 'abc123',
      },
      payload: {
        pkg: '@kb-labs/devlink',
        ok: true,
        durationMs: 842,
      },
      hashMeta: {
        algo: 'hmac-sha256',
        saltId: 'default-2025-10',
      },
    };

    const result = validateEvent(event);
    expect(result).toEqual(event);
  });

  it('should validate minimal valid event', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      type: 'test.event',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
    };

    const result = validateEvent(event);
    expect(result).toEqual(event);
  });

  it('should reject invalid UUID', () => {
    const event = {
      id: 'not-a-uuid',
      schema: 'kb.v1',
      type: 'test.event',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
    };

    expect(() => validateEvent(event)).toThrow();
  });

  it('should reject invalid schema version', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v2',
      type: 'test.event',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
    };

    expect(() => validateEvent(event)).toThrow();
  });

  it('should reject invalid actor type', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      type: 'test.event',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
      actor: {
        type: 'invalid',
        id: 'u_123',
      },
    };

    expect(() => validateEvent(event)).toThrow();
  });

  it('should reject invalid timestamp format', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      type: 'test.event',
      ts: 'invalid-date',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
    };

    expect(() => validateEvent(event)).toThrow();
  });

  it('should reject missing required fields', () => {
    const event = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      // missing type, ts, ingestTs, source, runId
    };

    expect(() => validateEvent(event)).toThrow();
  });

  it('should use safeValidateEvent for non-throwing validation', () => {
    const validEvent = {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      schema: 'kb.v1',
      type: 'test.event',
      ts: '2025-10-31T18:07:43.123Z',
      ingestTs: '2025-10-31T18:07:43.456Z',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      runId: 'run_123',
    };

    const result = safeValidateEvent(validEvent);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validEvent);
    expect(result.error).toBeUndefined();
  });

  it('should return error in safeValidateEvent for invalid event', () => {
    const invalidEvent = {
      id: 'not-a-uuid',
      schema: 'kb.v1',
    };

    const result = safeValidateEvent(invalidEvent);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});

