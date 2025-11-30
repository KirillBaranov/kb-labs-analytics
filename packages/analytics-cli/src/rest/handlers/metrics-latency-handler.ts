/**
 * @module @kb-labs/analytics-cli/rest/handlers/metrics-latency-handler
 * Handler for latency metrics (line chart)
 */

import { findRepoRoot } from '@kb-labs/core';
import { join } from 'node:path';
import { getBestSink } from '../utils/sink-reader';
import { readEventsFromSQLite } from '../utils/sqlite-reader';
import { readEventsFromFS } from '../utils/fs-reader';
import { readEventsFromBuffer } from '../utils/buffer-reader';
import type { EventFilters } from '../utils/sink-reader';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

type HandlerContext = {
  cwd?: string;
};

type MetricsQuery = {
  timeRange?: string;
  type?: string;
  product?: string;
  workspace?: string;
};

export async function handleMetricsLatency(input: MetricsQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {
    limit: 10000,
  };
  
  if (input.timeRange) {
    filters.timeRange = input.timeRange as 'today' | 'week' | 'month' | string;
  }
  
  if (input.type) {
    filters.type = input.type.includes(',') ? input.type.split(',').map(t => t.trim()) : input.type;
  }
  
  if (input.product) {
    filters.product = input.product.includes(',') ? input.product.split(',').map(p => p.trim()) : input.product;
  }
  
  if (input.workspace) {
    filters.workspace = input.workspace.includes(',') ? input.workspace.split(',').map(w => w.trim()) : input.workspace;
  }

  // Get events
  const sink = await getBestSink(cwd);
  const repoRoot = await findRepoRoot(cwd).catch(() => cwd);
  
  let events: AnalyticsEventV1[];
  
  if (sink?.type === 'sqlite' && sink.path) {
    events = await readEventsFromSQLite(sink.path, filters);
  } else if (sink?.type === 'fs' && sink.path) {
    events = await readEventsFromFS(sink.path, filters);
  } else {
    const bufferDir = join(repoRoot, '.kb/analytics/buffer');
    events = await readEventsFromBuffer(bufferDir, filters);
  }

  // Group events by time for latency calculation
  const timeGroups = new Map<string, number[]>();
  
  for (const event of events) {
    const eventDate = new Date(event.ts);
    const timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
    
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, []);
    }
    
    if (event.payload && typeof event.payload === 'object') {
      const payload = event.payload as Record<string, unknown>;
      const duration = payload.durationMs || payload.duration || payload.latencyMs || payload.latency;
      if (typeof duration === 'number') {
        timeGroups.get(timeKey)!.push(duration);
      }
    }
  }

  const latencyPoints = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x, latencies]) => {
      const avg = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
      return { x, y: avg };
    });

  return {
    series: [{
      name: 'Latency (ms)',
      points: latencyPoints,
    }],
  };
}




