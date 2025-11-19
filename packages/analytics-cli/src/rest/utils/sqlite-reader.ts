/**
 * @module @kb-labs/analytics-cli/rest/utils/sqlite-reader
 * Read events from SQLite sink
 */

import { existsSync } from 'node:fs';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';
import type { EventFilters } from './sink-reader.js';

interface SqliteDatabase {
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
    get(...args: unknown[]): unknown;
  };
  close(): void;
}

/**
 * Read events from SQLite database
 */
export async function readEventsFromSQLite(
  dbPath: string,
  filters: EventFilters = {}
): Promise<AnalyticsEventV1[]> {
  if (!existsSync(dbPath)) {
    return [];
  }

  const { default: BetterSqlite } = await import('better-sqlite3');
  const db = new BetterSqlite(dbPath) as unknown as SqliteDatabase;

  try {
    // Parse time range
    let fromTime: string | undefined;
    let toTime: string | undefined;

    if (filters.timeRange) {
      if (typeof filters.timeRange === 'string') {
        const now = new Date();
        const to = new Date(now);
        let from: Date;
        
        switch (filters.timeRange) {
          case 'today':
            from = new Date(now);
            from.setHours(0, 0, 0, 0);
            break;
          case 'week':
            from = new Date(now);
            from.setDate(from.getDate() - 7);
            break;
          case 'month':
            from = new Date(now);
            from.setMonth(from.getMonth() - 1);
            break;
          default:
            from = new Date(now);
            from.setDate(from.getDate() - 7);
        }
        fromTime = from.toISOString();
        toTime = to.toISOString();
      } else {
        fromTime = filters.timeRange.from;
        toTime = filters.timeRange.to;
      }
    }

    // Build WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (fromTime) {
      conditions.push('ts >= ?');
      params.push(fromTime);
    }
    if (toTime) {
      conditions.push('ts <= ?');
      params.push(toTime);
    }

    // Handle type filter
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      if (types.length > 0) {
        conditions.push(`type IN (${types.map(() => '?').join(', ')})`);
        params.push(...types);
      }
    }

    // Handle product filter
    if (filters.product) {
      const products = Array.isArray(filters.product) ? filters.product : [filters.product];
      if (products.length > 0) {
        conditions.push(`source_product IN (${products.map(() => '?').join(', ')})`);
        params.push(...products);
      }
    }

    // Handle workspace filter
    if (filters.workspace) {
      const workspaces = Array.isArray(filters.workspace) ? filters.workspace : [filters.workspace];
      if (workspaces.length > 0) {
        conditions.push(`ctx_workspace IN (${workspaces.map(() => '?').join(', ')})`);
        params.push(...workspaces);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 1000;
    const offset = filters.offset || 0;

    // Query events
    const sql = `
      SELECT 
        id, schema, type, ts, ingestTs,
        source_product as "source.product",
        source_version as "source.version",
        runId,
        actor_type as "actor.type",
        actor_id as "actor.id",
        actor_name as "actor.name",
        ctx_repo as "ctx.repo",
        ctx_branch as "ctx.branch",
        ctx_commit as "ctx.commit",
        ctx_workspace as "ctx.workspace",
        payload,
        hashMeta_algo as "hashMeta.algo",
        hashMeta_saltId as "hashMeta.saltId"
      FROM events
      ${whereClause}
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params, limit, offset) as Array<Record<string, unknown>>;

    // Transform rows to AnalyticsEventV1
    return rows.map(row => {
      const event: AnalyticsEventV1 = {
        id: String(row.id),
        schema: 'kb.v1',
        type: String(row.type),
        ts: String(row.ts),
        ingestTs: String(row.ingestTs),
        source: {
          product: String(row['source.product'] || ''),
          version: String(row['source.version'] || ''),
        },
        runId: String(row.runId),
      };

      if (row['actor.type']) {
        event.actor = {
          type: row['actor.type'] as 'user' | 'agent' | 'ci',
          id: row['actor.id'] ? String(row['actor.id']) : undefined,
          name: row['actor.name'] ? String(row['actor.name']) : undefined,
        };
      }

      if (row['ctx.repo'] || row['ctx.branch'] || row['ctx.commit'] || row['ctx.workspace']) {
        event.ctx = {};
        if (row['ctx.repo']) event.ctx.repo = String(row['ctx.repo']);
        if (row['ctx.branch']) event.ctx.branch = String(row['ctx.branch']);
        if (row['ctx.commit']) event.ctx.commit = String(row['ctx.commit']);
        if (row['ctx.workspace']) event.ctx.workspace = String(row['ctx.workspace']);
      }

      if (row.payload) {
        try {
          event.payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        } catch {
          // Ignore parse errors
        }
      }

      if (row['hashMeta.algo'] && row['hashMeta.saltId']) {
        event.hashMeta = {
          algo: 'hmac-sha256',
          saltId: String(row['hashMeta.saltId']),
        };
      }

      return event;
    });
  } finally {
    db.close();
  }
}

/**
 * Count events in SQLite database
 */
export async function countEventsFromSQLite(
  dbPath: string,
  filters: EventFilters = {}
): Promise<number> {
  if (!existsSync(dbPath)) {
    return 0;
  }

  const { default: BetterSqlite } = await import('better-sqlite3');
  const db = new BetterSqlite(dbPath) as unknown as SqliteDatabase;

  try {
    // Parse time range (same logic as readEventsFromSQLite)
    let fromTime: string | undefined;
    let toTime: string | undefined;

    if (filters.timeRange) {
      if (typeof filters.timeRange === 'string') {
        const now = new Date();
        const to = new Date(now);
        let from: Date;
        
        switch (filters.timeRange) {
          case 'today':
            from = new Date(now);
            from.setHours(0, 0, 0, 0);
            break;
          case 'week':
            from = new Date(now);
            from.setDate(from.getDate() - 7);
            break;
          case 'month':
            from = new Date(now);
            from.setMonth(from.getMonth() - 1);
            break;
          default:
            from = new Date(now);
            from.setDate(from.getDate() - 7);
        }
        fromTime = from.toISOString();
        toTime = to.toISOString();
      } else {
        fromTime = filters.timeRange.from;
        toTime = filters.timeRange.to;
      }
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (fromTime) {
      conditions.push('ts >= ?');
      params.push(fromTime);
    }
    if (toTime) {
      conditions.push('ts <= ?');
      params.push(toTime);
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      if (types.length > 0) {
        conditions.push(`type IN (${types.map(() => '?').join(', ')})`);
        params.push(...types);
      }
    }

    if (filters.product) {
      const products = Array.isArray(filters.product) ? filters.product : [filters.product];
      if (products.length > 0) {
        conditions.push(`source_product IN (${products.map(() => '?').join(', ')})`);
        params.push(...products);
      }
    }

    if (filters.workspace) {
      const workspaces = Array.isArray(filters.workspace) ? filters.workspace : [filters.workspace];
      if (workspaces.length > 0) {
        conditions.push(`ctx_workspace IN (${workspaces.map(() => '?').join(', ')})`);
        params.push(...workspaces);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) as count FROM events ${whereClause}`;
    const stmt = db.prepare(sql);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  } finally {
    db.close();
  }
}




