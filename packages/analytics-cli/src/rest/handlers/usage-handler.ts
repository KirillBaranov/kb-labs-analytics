/**
 * @module @kb-labs/analytics-cli/rest/handlers/usage-handler
 * Handler for usage metrics (by products, workspaces, users)
 */

import { findRepoRoot } from '@kb-labs/sdk';
import { join } from 'node:path';
import { getBestSink } from '../utils/sink-reader';
import { readEventsFromSQLite } from '../utils/sqlite-reader';
import { readEventsFromFS } from '../utils/fs-reader';
import { readEventsFromBuffer } from '../utils/buffer-reader';
import type { EventFilters } from '../utils/sink-reader';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-contracts';

type HandlerContext = {
  cwd?: string;
};

type UsageQuery = {
  timeRange?: string;
  type?: string;
  product?: string;
  workspace?: string;
};

export async function handleUsage(input: UsageQuery, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  
  // Parse query parameters
  const filters: EventFilters = {
    limit: 50000, // Get enough events for usage stats
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

  // Calculate usage statistics
  const productCounts = new Map<string, number>();
  const workspaceCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  const userActivity = new Map<string, Map<string, number>>(); // user -> time -> count

  for (const event of events) {
    // Count by product
    const productCount = productCounts.get(event.source.product) || 0;
    productCounts.set(event.source.product, productCount + 1);

    // Count by workspace
    if (event.ctx?.workspace) {
      const workspaceCount = workspaceCounts.get(event.ctx.workspace) || 0;
      workspaceCounts.set(event.ctx.workspace, workspaceCount + 1);
    }

    // Count by user
    if (event.actor?.id) {
      const userId = event.actor.id;
      const userCount = userCounts.get(userId) || 0;
      userCounts.set(userId, userCount + 1);

      // Track user activity over time
      const eventDate = new Date(event.ts);
      const timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
      
      if (!userActivity.has(userId)) {
        userActivity.set(userId, new Map());
      }
      const userTimeMap = userActivity.get(userId)!;
      const timeCount = userTimeMap.get(timeKey) || 0;
      userTimeMap.set(timeKey, timeCount + 1);
    }
  }

  // Format for bar charts (products and workspaces)
  const products = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ x: name, y: count }));

  const workspaces = Array.from(workspaceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ x: name, y: count }));

  // Format for line chart (user activity over time)
  // Aggregate all user activity by time
  const allUserActivity = new Map<string, number>();
  for (const [userId, timeMap] of userActivity.entries()) {
    for (const [timeKey, count] of timeMap.entries()) {
      const total = allUserActivity.get(timeKey) || 0;
      allUserActivity.set(timeKey, total + count);
    }
  }

  const userActivityPoints = Array.from(allUserActivity.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x, y]) => ({ x, y }));

  // Format for table (top users)
  const topUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([userId, count]) => ({
      userId,
      events: count,
      actor: events.find(e => e.actor?.id === userId)?.actor?.type || 'unknown',
    }));

  // Return products bar chart data
  return {
    series: [{
      name: 'Usage by Product',
      points: products,
    }],
  };
}

