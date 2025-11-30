/**
 * @module @kb-labs/analytics-cli/rest/handlers/usage-products-handler
 * Handler for usage by products (bar chart)
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

type UsageQuery = {
  timeRange?: string;
  type?: string;
  product?: string;
  workspace?: string;
};

export async function handleUsageProducts(input: UsageQuery, ctx: HandlerContext = {}) {
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

  // Count by product
  const productCounts = new Map<string, number>();
  
  for (const event of events) {
    const productCount = productCounts.get(event.source.product) || 0;
    productCounts.set(event.source.product, productCount + 1);
  }

  const products = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ x: name, y: count }));

  return {
    series: [{
      name: 'Usage by Product',
      points: products,
    }],
  };
}




