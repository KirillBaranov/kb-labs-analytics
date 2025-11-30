/**
 * SQLite Sink - Store events in SQLite database
 */

import { promises as fsp } from 'node:fs';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-contracts';
import type { SinkConfig } from '@kb-labs/analytics-contracts';

type SqliteStatement = {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown;
};

interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): unknown;
  pragma(sql: string): unknown;
  transaction<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
  ): (...args: TArgs) => TReturn;
  close(): void;
}

export interface SQLiteSinkConfig extends SinkConfig {
  type: 'sqlite';
  path?: string; // Database file path (required)
  partitionByDay?: boolean; // Partition tables by day (default: true)
  retentionDays?: number; // Retention policy (days, default: 30)
  idempotencyKey?: string; // Column name for idempotency (default: "id")
}

/**
 * SQLite Sink - Store events in SQLite database
 */
export class SQLiteSink {
  private config: {
    type: 'sqlite';
    id?: string;
    path: string;
    partitionByDay: boolean;
    retentionDays: number;
    idempotencyKey: string;
  };
  private db: SqliteDatabase | null = null;
  private writtenEvents = new Set<string>(); // Track written event IDs for idempotency

  constructor(config: SQLiteSinkConfig) {
    if (!config.path) {
      throw new Error('SQLiteSink requires path configuration');
    }

    this.config = {
      type: 'sqlite',
      id: config.id as string | undefined,
      path: config.path as string,
      partitionByDay: (config.partitionByDay as boolean | undefined) ?? true,
      retentionDays: (config.retentionDays as number | undefined) || 30,
      idempotencyKey: (config.idempotencyKey as string | undefined) || 'id',
    };
  }

  /**
   * Initialize sink
   */
  async init(): Promise<void> {
    // Ensure database directory exists
    const dbPath = this.config.path;
    const lastSlash = dbPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dbDir = dbPath.substring(0, lastSlash);
      await fsp.mkdir(dbDir, { recursive: true });
    }

    // Open database connection
    const { default: BetterSqlite } = await import('better-sqlite3');
    this.db = new BetterSqlite(this.config.path) as unknown as SqliteDatabase;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Create main events table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        schema TEXT NOT NULL,
        type TEXT NOT NULL,
        ts TEXT NOT NULL,
        ingestTs TEXT NOT NULL,
        source_product TEXT NOT NULL,
        source_version TEXT NOT NULL,
        runId TEXT NOT NULL,
        actor_type TEXT,
        actor_id TEXT,
        actor_name TEXT,
        ctx_repo TEXT,
        ctx_branch TEXT,
        ctx_commit TEXT,
        ctx_workspace TEXT,
        payload TEXT,
        hashMeta_algo TEXT,
        hashMeta_saltId TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create indices for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
      CREATE INDEX IF NOT EXISTS idx_events_runId ON events(runId);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `);

    // Create partitioned tables if needed
    if (this.config.partitionByDay) {
      await this.createDailyPartition(new Date());
    }
  }

  /**
   * Write events to SQLite
   */
  async write(events: AnalyticsEventV1[]): Promise<void> {
    if (events.length === 0 || !this.db) {
      return;
    }

    // Filter out already written events (idempotency)
    const newEvents: AnalyticsEventV1[] = [];
    for (const event of events) {
      const eventId = event.id;
      if (!this.writtenEvents.has(eventId)) {
        newEvents.push(event);
        this.writtenEvents.add(eventId);
      }
    }

    if (newEvents.length === 0) {
      return; // All events already written
    }

    // Prepare insert statement
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        id, schema, type, ts, ingestTs,
        source_product, source_version, runId,
        actor_type, actor_id, actor_name,
        ctx_repo, ctx_branch, ctx_commit, ctx_workspace,
        payload, hashMeta_algo, hashMeta_saltId
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    // Insert events in a transaction
    const insertMany = this.db.transaction((events: AnalyticsEventV1[]) => {
      for (const event of events) {
        stmt.run(
          event.id,
          event.schema,
          event.type,
          event.ts,
          event.ingestTs,
          event.source.product,
          event.source.version,
          event.runId,
          event.actor?.type,
          event.actor?.id,
          event.actor?.name,
          event.ctx?.repo,
          event.ctx?.branch,
          event.ctx?.commit,
          event.ctx?.workspace,
          event.payload ? JSON.stringify(event.payload) : null,
          event.hashMeta?.algo,
          event.hashMeta?.saltId
        );
      }
    });

    insertMany(newEvents);

    // Cleanup old data if needed
    await this.cleanupOldData();
  }

  /**
   * Create daily partition table
   */
  private async createDailyPartition(date: Date): Promise<void> {
    if (!this.db) {
      return;
    }

    const dateParts = date.toISOString().split('T');
    const dateStr = dateParts[0]; // YYYY-MM-DD
    if (!dateStr) {
      return;
    }
    const tableName = `events_${dateStr.replace(/-/g, '_')}`;

    // Check if partition exists
    const checkTable = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `);
    const exists = checkTable.get(tableName);

    if (!exists) {
      // Create partition table with same schema as main table
      this.db.exec(`
        CREATE TABLE ${tableName} (
          id TEXT PRIMARY KEY,
          schema TEXT NOT NULL,
          type TEXT NOT NULL,
          ts TEXT NOT NULL,
          ingestTs TEXT NOT NULL,
          source_product TEXT NOT NULL,
          source_version TEXT NOT NULL,
          runId TEXT NOT NULL,
          actor_type TEXT,
          actor_id TEXT,
          actor_name TEXT,
          ctx_repo TEXT,
          ctx_branch TEXT,
          ctx_commit TEXT,
          ctx_workspace TEXT,
          payload TEXT,
          hashMeta_algo TEXT,
          hashMeta_saltId TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Create indices for partition
      this.db.exec(`
        CREATE INDEX idx_${tableName}_type ON ${tableName}(type);
        CREATE INDEX idx_${tableName}_ts ON ${tableName}(ts);
        CREATE INDEX idx_${tableName}_runId ON ${tableName}(runId);
      `);
    }
  }

  /**
   * Cleanup old data based on retention policy
   */
  private async cleanupOldData(): Promise<void> {
    if (!this.db || !this.config.partitionByDay) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // Delete old partition tables
    const getPartitions = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'events_%'
      ORDER BY name
    `);
    const partitions = getPartitions.all() as Array<{ name: string }>;

    for (const partition of partitions) {
      const tableName = partition.name;
      // Extract date from table name (events_YYYY_MM_DD)
      const match = tableName.match(/events_(\d{4})_(\d{2})_(\d{2})/);
      if (match && match[1] && match[2] && match[3]) {
        const [, year, month, day] = match;
        const partitionDate = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10)
        );

        if (partitionDate < cutoffDate) {
          // Drop old partition
          this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
        }
      }
    }

    // Also cleanup main events table
    const deleteOld = this.db.prepare(`
      DELETE FROM events WHERE created_at < ?
    `);
    deleteOld.run(cutoffDate.toISOString());
  }

  /**
   * Get idempotency key for event
   */
  getIdempotencyKey(event: AnalyticsEventV1): string {
    return event.id;
  }

  /**
   * Close sink
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

