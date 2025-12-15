/**
 * @module @kb-labs/analytics-cli/rest/handlers/events-handler
 * Handler for listing analytics events
 */

import { findRepoRoot } from '@kb-labs/sdk';
import { join } from 'node:path';
import { getBestSink } from '../utils/sink-reader';
import { readEventsFromSQLite } from '../utils/sqlite-reader';
import { readEventsFromFS } from '../utils/fs-reader';
import { readEventsFromBuffer } from '../utils/buffer-reader';
import type { EventFilters } from '../utils/sink-reader';

type HandlerContext = {
  cwd?: string;
};

type EventsQuery = {
  type?: string;
  product?: string;
  workspace?: string;
  timeRange?: string;
  limit?: string;
  offset?: string;
};

export async function handleEvents(input: EventsQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {};
  
  if (input.type) {
    filters.type = input.type.includes(',') ? input.type.split(',').map(t => t.trim()) : input.type;
  }
  
  if (input.product) {
    filters.product = input.product.includes(',') ? input.product.split(',').map(p => p.trim()) : input.product;
  }
  
  if (input.workspace) {
    filters.workspace = input.workspace.includes(',') ? input.workspace.split(',').map(w => w.trim()) : input.workspace;
  }
  
  if (input.timeRange) {
    filters.timeRange = input.timeRange as 'today' | 'week' | 'month' | string;
  }
  
  if (input.limit) {
    const limit = Number.parseInt(input.limit, 10);
    if (!Number.isNaN(limit)) {
      filters.limit = limit;
    }
  }
  
  if (input.offset) {
    const offset = Number.parseInt(input.offset, 10);
    if (!Number.isNaN(offset)) {
      filters.offset = offset;
    }
  }

  // Get best sink and read events
  const sink = await getBestSink(cwd);
  const repoRoot = await findRepoRoot(cwd).catch(() => cwd);
  
  let events;
  
  if (sink?.type === 'sqlite' && sink.path) {
    events = await readEventsFromSQLite(sink.path, filters);
  } else if (sink?.type === 'fs' && sink.path) {
    events = await readEventsFromFS(sink.path, filters);
  } else {
    // Fallback to buffer
    const bufferDir = join(repoRoot, '.kb/analytics/buffer');
    events = await readEventsFromBuffer(bufferDir, filters);
  }

  // Format for table widget: { rows: Array<{ [key: string]: unknown }> }
  const rows = events.map(event => ({
    id: event.id,
    type: event.type,
    timestamp: event.ts,
    product: event.source.product,
    version: event.source.version,
    runId: event.runId,
    actor: event.actor ? `${event.actor.type}${event.actor.id ? `:${event.actor.id}` : ''}` : null,
    workspace: event.ctx?.workspace || null,
    repo: event.ctx?.repo || null,
    branch: event.ctx?.branch || null,
    payload: event.payload ? JSON.stringify(event.payload) : null,
  }));

  return {
    rows,
  };
}




