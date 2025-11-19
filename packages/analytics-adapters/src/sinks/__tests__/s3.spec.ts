/**
 * Tests for S3 Sink
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S3Sink } from '../s3';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

const mockSend = vi.fn();

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

describe('S3Sink', () => {
  let sink: S3Sink;
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up test AWS credentials
    process.env = {
      ...originalEnv,
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    };
    mockSend.mockReset();
  });

  afterEach(async () => {
    if (sink) {
      await sink.close().catch(() => {});
    }
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
      region: 'us-east-1',
    });

    await sink.init();
    expect(sink).toBeDefined();
  });

  it('should throw error if bucket is missing', () => {
    expect(() => {
      new S3Sink({
        type: 's3',
        // bucket missing
      } as any);
    }).toThrow('S3Sink requires bucket configuration');
  });

  it('should throw error if credentials are missing', () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    expect(() => {
      new S3Sink({
        type: 's3',
        bucket: 'test-bucket',
        // credentials missing
      });
    }).toThrow('S3Sink requires AWS credentials');
  });

  it('should use credentials from config', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
      accessKeyId: 'config-key',
      secretAccessKey: 'config-secret',
    });

    await sink.init();
    expect(sink).toBeDefined();
  });

  it('should write events successfully', async () => {
    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
      keyPrefix: 'events/',
    });

    await sink.init();

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

    mockSend.mockResolvedValue({ ok: true });

    await sink.write(events);

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
      }),
    );
  });

  it('should return idempotency key from event ID', () => {
    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
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

  it('should use custom key prefix', () => {
    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
      keyPrefix: 'custom/prefix/',
    });

    expect(sink).toBeDefined();
  });

  it('should use custom endpoint', () => {
    sink = new S3Sink({
      type: 's3',
      bucket: 'test-bucket',
      endpoint: 'https://s3.custom.com',
    });

    expect(sink).toBeDefined();
  });
});

