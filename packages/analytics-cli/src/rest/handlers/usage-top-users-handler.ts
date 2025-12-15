/**
 * @module @kb-labs/analytics-cli/rest/handlers/usage-top-users-handler
 * Handler for top users (table)
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

export async function handleUsageTopUsers(input: UsageQuery, ctx: HandlerContext = {}) {
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

  // Count by user
  const userCounts = new Map<string, number>();
  
  for (const event of events) {
    if (event.actor?.id) {
      const userId = event.actor.id;
      const userCount = userCounts.get(userId) || 0;
      userCounts.set(userId, userCount + 1);
    }
  }

  // Format for table (top users)
  const topUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([userId, count]) => {
      const userEvent = events.find(e => e.actor?.id === userId);
      return {
        userId,
        events: count,
        actor: userEvent?.actor?.type || 'unknown',
        name: userEvent?.actor?.name || null,
      };
    });

  return {
    rows: topUsers,
  };
}




