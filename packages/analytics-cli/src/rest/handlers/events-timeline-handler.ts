/**
 * @module @kb-labs/analytics-cli/rest/handlers/events-timeline-handler
 * Handler for event timeline (time series)
 */

import { findRepoRoot } from '@kb-labs/core';
import { join } from 'node:path';
import { getBestSink } from '../utils/sink-reader.js';
import { readEventsFromSQLite } from '../utils/sqlite-reader.js';
import { readEventsFromFS } from '../utils/fs-reader.js';
import { readEventsFromBuffer } from '../utils/buffer-reader.js';
import type { EventFilters } from '../utils/sink-reader.js';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';

type HandlerContext = {
  cwd?: string;
};

type EventsTimelineQuery = {
  timeRange?: string;
  type?: string;
  product?: string;
  workspace?: string;
  groupBy?: string; // 'hour' | 'day' | 'week'
};

export async function handleEventsTimeline(input: EventsTimelineQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {
    limit: 50000, // Get enough events for timeline
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

  const groupBy = input.groupBy || 'hour';

  // Get best sink and read events
  const sink = await getBestSink(cwd);
  const repoRoot = await findRepoRoot(cwd).catch(() => cwd);
  
  let events: AnalyticsEventV1[];
  
  if (sink?.type === 'sqlite' && sink.path) {
    events = await readEventsFromSQLite(sink.path, filters);
  } else if (sink?.type === 'fs' && sink.path) {
    events = await readEventsFromFS(sink.path, filters);
  } else {
    // Fallback to buffer
    const bufferDir = join(repoRoot, '.kb/analytics/buffer');
    events = await readEventsFromBuffer(bufferDir, filters);
  }

  // Group events by time
  const timeGroups = new Map<string, number>();
  
  for (const event of events) {
    const eventDate = new Date(event.ts);
    let timeKey: string;
    
    if (groupBy === 'hour') {
      timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
    } else if (groupBy === 'day') {
      timeKey = eventDate.toISOString().slice(0, 10) + 'T00:00:00Z';
    } else if (groupBy === 'week') {
      const weekStart = new Date(eventDate);
      weekStart.setDate(eventDate.getDate() - eventDate.getDay());
      weekStart.setHours(0, 0, 0, 0);
      timeKey = weekStart.toISOString().slice(0, 10) + 'T00:00:00Z';
    } else {
      timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
    }
    
    const count = timeGroups.get(timeKey) || 0;
    timeGroups.set(timeKey, count + 1);
  }

  // Convert to sorted array of points
  const points = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x, y]) => ({ x, y }));

  // Format for line chart: { series: Array<{ name: string; points: Array<{ x: string | number; y: number }> }> }
  return {
    series: [{
      name: 'Events',
      points,
    }],
  };
}




