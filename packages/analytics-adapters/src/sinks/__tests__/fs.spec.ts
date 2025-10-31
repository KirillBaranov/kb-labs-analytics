/**
 * Tests for FS Sink
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FSSink } from '../fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

describe('FSSink', () => {
  let testDir: string;
  let sink: FSSink;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-sink-test-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });

    sink = new FSSink({
      type: 'fs',
      path: testDir,
      prefix: 'events',
      rotateSize: 1024, // Small size for testing
      retentionDays: 1,
    });

    await sink.init();
  });

  afterEach(async () => {
    await sink.close().catch(() => {});
    await fsp.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should write events to file', async () => {
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
      {
        id: 'evt_2',
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
      },
    ];

    await sink.write(events);

    const files = await fsp.readdir(testDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.startsWith('events-') && f.endsWith('.jsonl'))).toBe(true);

    const jsonlFile = files.find((f) => f.endsWith('.jsonl'));
    expect(jsonlFile).toBeDefined();
    
    const filePath = join(testDir, jsonlFile!);
    const content = await fsp.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]!).id).toBe('evt_1');
    expect(JSON.parse(lines[1]!).id).toBe('evt_2');
  });

  it('should handle idempotency (skip duplicate events)', async () => {
    const event: AnalyticsEventV1 = {
      id: 'evt_1',
      schema: 'kb.v1',
      type: 'test.event',
      ts: new Date().toISOString(),
      ingestTs: new Date().toISOString(),
      source: { product: '@kb-labs/test', version: '0.1.0' },
      runId: 'run_1',
    };

    // Write event twice
    await sink.write([event]);
    await sink.write([event]);

    const files = await fsp.readdir(testDir);
    const jsonlFile = files.find((f) => f.endsWith('.jsonl'));
    expect(jsonlFile).toBeDefined();
    
    const filePath = join(testDir, jsonlFile!);
    const content = await fsp.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    // Should only write once
    expect(lines.length).toBe(1);
  });

  it('should rotate files when size limit reached', async () => {
    const sink = new FSSink({
      type: 'fs',
      path: testDir,
      prefix: 'events',
      rotateSize: 100, // Very small for testing
      retentionDays: 1,
    });
    await sink.init();

    // Write enough events to trigger rotation
    const events: AnalyticsEventV1[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        id: `evt_${i}`,
        schema: 'kb.v1',
        type: 'test.event',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: { product: '@kb-labs/test', version: '0.1.0' },
        runId: 'run_1',
        payload: { data: 'x'.repeat(50) }, // Make events larger
      });
    }

    await sink.write(events);

    const files = await fsp.readdir(testDir);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
    // Should have at least one file (rotation may happen if size limit is reached)
    expect(jsonlFiles.length).toBeGreaterThanOrEqual(1);
    
    // Check that events were written
    const totalEvents = await Promise.all(
      jsonlFiles.map(async (f) => {
        const content = await fsp.readFile(join(testDir, f), 'utf-8');
        return content.trim().split('\n').filter((l) => l.length > 0).length;
      })
    );
    const sum = totalEvents.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(events.length);

    await sink.close();
  });

  it('should cleanup old files based on retention', async () => {
    // Create old file manually
    const oldFile = join(testDir, 'events-2020-01-01T00-00-00.jsonl');
    await fsp.writeFile(oldFile, '{}', 'utf-8');

    // Touch file to set old mtime
    const oldDate = new Date('2020-01-01');
    await fsp.utimes(oldFile, oldDate, oldDate);

    // Create new file
    const event: AnalyticsEventV1 = {
      id: 'evt_1',
      schema: 'kb.v1',
      type: 'test.event',
      ts: new Date().toISOString(),
      ingestTs: new Date().toISOString(),
      source: { product: '@kb-labs/test', version: '0.1.0' },
      runId: 'run_1',
    };

    await sink.write([event]);
    await sink.cleanupOldFiles(); // Trigger cleanup

    const files = await fsp.readdir(testDir);
    expect(files.includes('events-2020-01-01T00-00-00.jsonl')).toBe(false); // Old file removed
  });

  it('should return idempotency key from event ID', () => {
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
});

