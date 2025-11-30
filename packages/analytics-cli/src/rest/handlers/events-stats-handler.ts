/**
 * @module @kb-labs/analytics-cli/rest/handlers/events-stats-handler
 * Handler for event statistics (top types, distribution by products)
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

type EventsStatsQuery = {
  timeRange?: string;
  type?: string;
  product?: string;
  workspace?: string;
};

export async function handleEventsStats(input: EventsStatsQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {
    limit: 10000, // Get enough events for stats
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

  // Calculate statistics
  const typeCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  
  for (const event of events) {
    // Count by type
    const typeCount = typeCounts.get(event.type) || 0;
    typeCounts.set(event.type, typeCount + 1);
    
    // Count by product
    const productCount = productCounts.get(event.source.product) || 0;
    productCounts.set(event.source.product, productCount + 1);
  }

  // Format for chart widgets
  // Pie chart: { series: Array<{ name: string; points: Array<{ x: string; y: number }> }> }
  // Bar chart: { series: Array<{ name: string; points: Array<{ x: string; y: number }> }> }
  
  // Top types for pie chart
  const topTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ x: name, y: count }));
  
  // Products for bar chart
  const products = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ x: name, y: count }));

  // Check if this is requested for InfoPanel widget (via query param or accept header)
  // For now, return chart format by default for backward compatibility
  // InfoPanel widgets should use a different route or we can add format query param
  
  // Return pie chart data (top types) - default format
  return {
    series: [{
      name: 'Event Types',
      points: topTypes,
    }],
  };
}

