/**
 * @module @kb-labs/analytics-cli/rest/handlers/metrics-error-rate-handler
 * Handler for error rate metrics (line chart)
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

export async function handleMetricsErrorRate(input: MetricsQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {
    limit: 50000,
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

  // Group events by time and calculate error rate
  const timeGroups = new Map<string, { total: number; errors: number }>();
  
  for (const event of events) {
    const eventDate = new Date(event.ts);
    const timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
    
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, { total: 0, errors: 0 });
    }
    
    const group = timeGroups.get(timeKey)!;
    group.total++;
    
    if (event.type.includes('error') || event.type.includes('failed')) {
      group.errors++;
    }
  }

  const errorRatePoints = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x, group]) => {
      const rate = group.total > 0 ? (group.errors / group.total) * 100 : 0;
      return { x, y: rate };
    });

  return {
    series: [{
      name: 'Error Rate (%)',
      points: errorRatePoints,
    }],
  };
}




