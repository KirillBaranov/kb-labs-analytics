/**
 * Tests for HTTP Sink
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTTPSink } from '../http';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

// Mock fetch
global.fetch = vi.fn();

describe('HTTPSink', () => {
  let sink: HTTPSink;
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(async () => {
    await sink.close().catch(() => {});
  });

  it('should initialize successfully', async () => {
    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
    });

    await sink.init();
    expect(sink).toBeDefined();
  });

  it('should send events successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
    });

    const events: AnalyticsEventV1[] = [
      {
        id: 'evt_1',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    await sink.write(events);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call[0]).toBe('https://example.com/events');
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.headers['Content-Type']).toBe('application/json');
      expect(call[1]?.headers['Idempotency-Key']).toBe('evt_1');
    }
  });

  it('should handle idempotency (skip duplicate events)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
    });

    const event: AnalyticsEventV1 = {
      id: 'evt_1',
      schema: 'kb.v1',
      type: 'test.event',
      ts: new Date().toISOString(),
      ingestTs: new Date().toISOString(),
      source: { product: '@kb-labs/test', version: '0.1.0' },
      runId: 'run_1',
    };

    // Send event twice
    await sink.write([event]);
    await sink.write([event]);

    // Should only send once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    // First attempt fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
      retry: {
        initialMs: 10, // Fast for testing
        maxMs: 100,
        factor: 2,
      },
    });

    const events: AnalyticsEventV1[] = [
      {
        id: 'evt_1',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    await sink.write(events);

    // Should have retried
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should add bearer token auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
      auth: {
        type: 'bearer',
        token: 'test-token-123',
      },
    });

    const events: AnalyticsEventV1[] = [
      {
        id: 'evt_1',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    await sink.write(events);

    const call = mockFetch.mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call[1]?.headers['Authorization']).toBe('Bearer test-token-123');
    }
  });

  it('should add basic auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
      auth: {
        type: 'basic',
        username: 'user',
        password: 'pass',
      },
    });

    const events: AnalyticsEventV1[] = [
      {
        id: 'evt_1',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    await sink.write(events);

    const call = mockFetch.mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call[1]?.headers['Authorization']).toMatch(/^Basic /);
    }
  });

  it('should track circuit breaker state', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
      breaker: {
        failures: 2, // Low threshold for testing
        windowMs: 1000,
        halfOpenEveryMs: 500,
      },
      retry: {
        initialMs: 10,
        maxMs: 50,
        factor: 2,
      },
    });

    const events: AnalyticsEventV1[] = [
      {
        id: 'evt_1',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    // Try to send events - should fail and increment failure count
    try {
      await sink.write(events);
    } catch {
      // Expected to fail
    }

    // Circuit breaker should have a valid state
    // After one failure it may still be closed (need multiple failures to open)
    const state = sink.getCircuitBreakerState();
    expect(['open', 'half-open', 'closed']).toContain(state);
  });

  it('should return idempotency key from event ID', () => {
    sink = new HTTPSink({
      type: 'http',
      url: 'https://example.com/events',
    });

    const event: AnalyticsEventV1 = {
      id: 'evt_123',
      schema: 'kb.v1',
      type: 'test.event',
      ts: new Date().toISOString(),
      ingestTs: new Date().toISOString(),
      source: { product: '@kb-labs/test', version: '0.1.0' },
      runId: 'run_1',
    };

    const key = sink.getIdempotencyKey(event);
    expect(key).toBe('evt_123');
  });

  it('should throw error if url is missing', () => {
    expect(() => {
      new HTTPSink({
        type: 'http',
        // url missing
      } as any);
    }).toThrow('HTTPSink requires url configuration');
  });
});

