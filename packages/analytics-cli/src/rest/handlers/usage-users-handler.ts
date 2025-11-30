/**
 * @module @kb-labs/analytics-cli/rest/handlers/usage-users-handler
 * Handler for user activity (line chart)
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

export async function handleUsageUsers(input: UsageQuery, ctx: HandlerContext = {}) {
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

  // Track user activity over time
  const userActivity = new Map<string, Map<string, number>>(); // user -> time -> count

  for (const event of events) {
    if (event.actor?.id) {
      const userId = event.actor.id;
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

  return {
    series: [{
      name: 'User Activity',
      points: userActivityPoints,
    }],
  };
}




