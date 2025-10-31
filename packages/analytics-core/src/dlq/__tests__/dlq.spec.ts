/**
 * Tests for Dead-Letter Queue
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeadLetterQueue } from '../../dlq';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import type { AnalyticsEventV1 } from '../../types';

describe('DeadLetterQueue', () => {
  let dlqDir: string;
  let dlq: DeadLetterQueue;

  beforeEach(async () => {
    dlqDir = join(tmpdir(), `dlq-test-${Date.now()}`);
    dlq = new DeadLetterQueue(dlqDir);
    await dlq.init();
  });

  afterEach(async () => {
    await dlq.close().catch(() => {});
    await fsp.rm(dlqDir, { recursive: true, force: true }).catch(() => {});
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

  it('should add failed event to DLQ', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    const error = new Error('Test error');

    await dlq.add(event, error);

    const files = await dlq.listFiles();
    expect(files.length).toBe(1);

    const entries = await dlq.readEntries(files[0]!);
    expect(entries.length).toBe(1);
    expect(entries[0]?.event.id).toBe(event.id);
    expect(entries[0]?.error).toBe('Test error');
  });

  it('should filter entries by eventId', async () => {
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1');
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2');

    await dlq.add(event1, 'Error 1');
    await dlq.add(event2, 'Error 2');

    const files = await dlq.listFiles();
    const entries = await dlq.readEntries(files[0]!, {
      eventId: event1.id,
    });

    expect(entries.length).toBe(1);
    expect(entries[0]?.event.id).toBe(event1.id);
  });

  it('should filter entries by eventType', async () => {
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1', 'test.type1');
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2', 'test.type2');

    await dlq.add(event1, 'Error 1');
    await dlq.add(event2, 'Error 2');

    const files = await dlq.listFiles();
    const entries = await dlq.readEntries(files[0]!, {
      eventType: 'test.type1',
    });

    expect(entries.length).toBe(1);
    expect(entries[0]?.event.type).toBe('test.type1');
  });

  it('should filter entries by runId', async () => {
    const runId = 'run_123';
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1');
    event1.runId = runId;
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2');
    event2.runId = 'run_456';

    await dlq.add(event1, 'Error 1');
    await dlq.add(event2, 'Error 2');

    const files = await dlq.listFiles();
    const entries = await dlq.readEntries(files[0]!, {
      runId,
    });

    expect(entries.length).toBe(1);
    expect(entries[0]?.event.runId).toBe(runId);
  });

  it('should filter entries by errorContains', async () => {
    await dlq.add(createEvent('01234567-89ab-cdef-0123-456789abc1'), 'Network error');
    await dlq.add(createEvent('01234567-89ab-cdef-0123-456789abc2'), 'Validation error');

    const files = await dlq.listFiles();
    const entries = await dlq.readEntries(files[0]!, {
      errorContains: 'Network',
    });

    expect(entries.length).toBe(1);
    expect(entries[0]?.error).toContain('Network');
  });

  it('should replay events from DLQ', async () => {
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1');
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2');

    await dlq.add(event1, 'Error 1');
    await dlq.add(event2, 'Error 2');

    const files = await dlq.listFiles();
    const events = await dlq.replay(files[0]!);

    expect(events.length).toBe(2);
    expect(events[0]?.id).toBe(event1.id);
    expect(events[1]?.id).toBe(event2.id);
  });

  it('should replay filtered events', async () => {
    const event1 = createEvent('01234567-89ab-cdef-0123-456789abc1', 'test.type1');
    const event2 = createEvent('01234567-89ab-cdef-0123-456789abc2', 'test.type2');

    await dlq.add(event1, 'Error 1');
    await dlq.add(event2, 'Error 2');

    const files = await dlq.listFiles();
    const events = await dlq.replay(files[0]!, {
      eventType: 'test.type1',
    });

    expect(events.length).toBe(1);
    expect(events[0]?.id).toBe(event1.id);
  });

  it('should get DLQ stats', async () => {
    await dlq.add(createEvent('01234567-89ab-cdef-0123-456789abc1'), 'Error 1');
    await dlq.add(createEvent('01234567-89ab-cdef-0123-456789abc2'), 'Error 2');

    const stats = await dlq.getStats();

    expect(stats.totalFiles).toBe(1);
    expect(stats.totalEntries).toBe(2);
  });

  it('should remove DLQ file', async () => {
    const event = createEvent('01234567-89ab-cdef-0123-456789abcdef');
    await dlq.add(event, 'Error');

    const files = await dlq.listFiles();
    expect(files.length).toBe(1);

    await dlq.removeFile(files[0]!);

    const filesAfter = await dlq.listFiles();
    expect(filesAfter.length).toBe(0);
  });
});

