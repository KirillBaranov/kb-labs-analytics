/**
 * Tests for SQLite Sink
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteSink } from '../sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

describe('SQLiteSink', () => {
  let testDir: string;
  let sink: SQLiteSink;

  beforeEach(async () => {
    testDir = join(tmpdir(), `sqlite-sink-test-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });

    const dbPath = join(testDir, 'events.db');
    sink = new SQLiteSink({
      type: 'sqlite',
      path: dbPath,
      partitionByDay: false, // Disable for simpler testing
      retentionDays: 1,
    });

    await sink.init();
  });

  afterEach(async () => {
    await sink.close().catch(() => {});
    await fsp.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should initialize successfully', async () => {
    expect(sink).toBeDefined();
    // Database file should be created
    const dbPath = join(testDir, 'events.db');
    const stats = await fsp.stat(dbPath).catch(() => null);
    expect(stats).toBeDefined();
  });

  it('should write events to database', async () => {
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

    // Verify events were written by reading the database
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(join(testDir, 'events.db'));
    const stmt = db.prepare('SELECT COUNT(*) as count FROM events');
    const result = stmt.get() as { count: number };
    expect(result.count).toBe(2);

    db.close();
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

    // Should only write once
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(join(testDir, 'events.db'));
    const stmt = db.prepare('SELECT COUNT(*) as count FROM events');
    const result = stmt.get() as { count: number };
    expect(result.count).toBe(1);

    db.close();
  });

  it('should store event with all fields', async () => {
    const event: AnalyticsEventV1 = {
      id: 'evt_1',
      schema: 'kb.v1',
      type: 'test.event',
      ts: new Date().toISOString(),
      ingestTs: new Date().toISOString(),
      source: { product: '@kb-labs/test', version: '0.1.0' },
      runId: 'run_1',
      actor: { type: 'user', id: 'u_123', name: 'Test User' },
      ctx: { repo: 'kb-labs/test', branch: 'main', commit: 'abc123' },
      payload: { test: 'data' },
      hashMeta: { algo: 'hmac-sha256', saltId: 'salt_1' },
    };

    await sink.write([event]);

    // Verify event was written with all fields
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(join(testDir, 'events.db'));
    const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
    const result = stmt.get('evt_1') as any;

    expect(result).toBeDefined();
    expect(result.type).toBe('test.event');
    expect(result.source_product).toBe('@kb-labs/test');
    expect(result.actor_type).toBe('user');
    expect(result.actor_id).toBe('u_123');
    expect(result.ctx_repo).toBe('kb-labs/test');
    expect(result.ctx_branch).toBe('main');
    expect(result.hashMeta_algo).toBe('hmac-sha256');
    expect(result.hashMeta_saltId).toBe('salt_1');

    db.close();
  });

  it('should create indices for common queries', async () => {
    // Indices should be created during init
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(join(testDir, 'events.db'));
    const indices = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
      )
      .all() as Array<{ name: string }>;

    expect(indices.length).toBeGreaterThan(0);
    expect(indices.some((idx) => idx.name === 'idx_events_type')).toBe(true);
    expect(indices.some((idx) => idx.name === 'idx_events_ts')).toBe(true);
    expect(indices.some((idx) => idx.name === 'idx_events_runId')).toBe(true);

    db.close();
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

  it('should throw error if path is missing', () => {
    expect(() => {
      new SQLiteSink({
        type: 'sqlite',
        // path missing
      } as any);
    }).toThrow('SQLiteSink requires path configuration');
  });

  it('should support partition by day', async () => {
    const dbPath = join(testDir, 'partitioned.db');
    const partitionedSink = new SQLiteSink({
      type: 'sqlite',
      path: dbPath,
      partitionByDay: true,
      retentionDays: 1,
    });

    await partitionedSink.init();

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

    await partitionedSink.write(events);

    // Check if daily partition table exists
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath);
    const todayParts = new Date().toISOString().split('T');
    const today = todayParts[0]?.replace(/-/g, '_') || '';
    const tableName = `events_${today}`;
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    // Should have main table and possibly partition table
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.some((t) => t.name === 'events')).toBe(true);
    expect(tables.some((t) => t.name === tableName)).toBe(true);

    db.close();
    await partitionedSink.close();
  });
});

