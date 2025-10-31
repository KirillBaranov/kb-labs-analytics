/**
 * Tests for WAL Buffer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WalBuffer } from '../../buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import type { AnalyticsEventV1 } from '../../types';

describe('WalBuffer', () => {
  let bufferDir: string;
  let buffer: WalBuffer;

  beforeEach(async () => {
    bufferDir = join(tmpdir(), `wal-buffer-test-${Date.now()}`);
    buffer = new WalBuffer(bufferDir, {
      segmentBytes: 1024, // Small for testing
      segmentMaxAgeMs: 5000, // 5s for testing
      fsyncOnRotate: false, // Faster for tests
    });
    await buffer.init();
  });

  afterEach(async () => {
    await buffer.close().catch(() => {});
    await fsp.rm(bufferDir, { recursive: true, force: true }).catch(() => {});
  });

  const createEvent = (id: string, type: string = 'test.event'): AnalyticsEventV1 => ({
    id,
    schema: 'kb.v1',
    type,
    ts: new Date().toISOString(),
    ingestTs: new Date().toISOString(),
    source: {
      product: '@kb-labs/test',
      version: '0.1.0',
    },
    runId: `run_${id}`,
  });

  it('should append events to segment', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    const appended = await buffer.append(event);
    expect(appended).toBe(true);

    const segment = buffer.getCurrentSegment();
    expect(segment).not.toBeNull();
    expect(segment?.eventCount).toBe(1);
  });

  it('should deduplicate events by id', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    const appended1 = await buffer.append(event);
    const appended2 = await buffer.append(event);

    expect(appended1).toBe(true);
    expect(appended2).toBe(false); // Duplicate

    const segment = buffer.getCurrentSegment();
    expect(segment?.eventCount).toBe(1);
  });

  it('should rotate segment when size limit reached', async () => {
    const smallBuffer = new WalBuffer(bufferDir, {
      segmentBytes: 100, // Very small
      segmentMaxAgeMs: 60000,
      fsyncOnRotate: false,
    });
    await smallBuffer.init();

    // Add enough events to trigger rotation
    for (let i = 0; i < 10; i++) {
      const event = createEvent(`01234567-89ab-cdef-0123-456789abcd${i.toString(16)}`);
      await smallBuffer.append(event);
    }

    const segments = await smallBuffer.listSegments();
    expect(segments.length).toBeGreaterThan(0);

    await smallBuffer.close();
  });

  it('should create index file for segment', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    await buffer.append(event);

    const segment = buffer.getCurrentSegment();
    expect(segment).not.toBeNull();
    expect(segment?.indexPath).toBeDefined();

    const indexContent = await fsp.readFile(segment!.indexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBe(1);
    expect(index[0].eventId).toBe(event.id);
  });

  it('should read segment events', async () => {
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1');
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2');

    await buffer.append(event1);
    await buffer.append(event2);

    const segment = buffer.getCurrentSegment();
    expect(segment).not.toBeNull();

    const segmentPath = segment?.path;
    expect(segmentPath).toBeDefined();
    
    const events = await buffer.readSegment(segmentPath!);
    expect(events.length).toBe(2);
    const event0 = events[0];
    const event1_result = events[1];
    expect(event0).toBeDefined();
    expect(event1_result).toBeDefined();
    expect(event0!.id).toBe(event1.id);
    expect(event1_result!.id).toBe(event2.id);
  });

  it('should track deduplication stats', async () => {
    const stats1 = buffer.getDedupStats();
    expect(stats1.size).toBe(0);

    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    await buffer.append(event);

    const stats2 = buffer.getDedupStats();
    expect(stats2.size).toBe(1);

    // Try to append duplicate
    await buffer.append(event);

    const stats3 = buffer.getDedupStats();
    expect(stats3.size).toBe(1); // Still 1 (deduplicated)
  });

  it('should clear deduplication cache', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    await buffer.append(event);

    expect(buffer.getDedupStats().size).toBe(1);

    buffer.clearDedupCache();

    expect(buffer.getDedupStats().size).toBe(0);
  });

  it('should list all segments', async () => {
    // Create multiple segments by rotating
    const smallBuffer = new WalBuffer(bufferDir, {
      segmentBytes: 100,
      segmentMaxAgeMs: 60000,
      fsyncOnRotate: false,
    });
    await smallBuffer.init();

    // Add events to trigger rotation
    for (let i = 0; i < 5; i++) {
      const event = createEvent(`01234567-89ab-cdef-0123-456789abcd${i.toString(16)}`);
      await smallBuffer.append(event);
    }

    const segments = await smallBuffer.listSegments();
    expect(segments.length).toBeGreaterThan(0);

    await smallBuffer.close();
  });
});

