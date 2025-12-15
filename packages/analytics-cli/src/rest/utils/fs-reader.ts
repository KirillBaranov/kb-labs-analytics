/**
 * @module @kb-labs/analytics-cli/rest/utils/fs-reader
 * Read events from FS sink (JSONL files)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-contracts';
import type { EventFilters } from './sink-reader';

/**
 * Read events from FS sink (JSONL files)
 */
export async function readEventsFromFS(
  dirPath: string,
  filters: EventFilters = {}
): Promise<AnalyticsEventV1[]> {
  try {
    const files = await readdir(dirPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl')).sort().reverse(); // Newest first
    
    const allEvents: AnalyticsEventV1[] = [];
    const limit = filters.limit || 1000;
    const offset = filters.offset || 0;

    // Parse time range
    let fromTime: Date | undefined;
    let toTime: Date | undefined;

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
        fromTime = from;
        toTime = to;
      } else {
        fromTime = new Date(filters.timeRange.from);
        toTime = new Date(filters.timeRange.to);
      }
    }

    // Read files until we have enough events
    for (const file of jsonlFiles) {
      if (allEvents.length >= limit + offset) break;

      const filePath = join(dirPath, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as AnalyticsEventV1;

          // Apply filters
          if (fromTime && new Date(event.ts) < fromTime) continue;
          if (toTime && new Date(event.ts) > toTime) continue;

          if (filters.type) {
            const types = Array.isArray(filters.type) ? filters.type : [filters.type];
            if (!types.includes(event.type)) continue;
          }

          if (filters.product) {
            const products = Array.isArray(filters.product) ? filters.product : [filters.product];
            if (!products.includes(event.source.product)) continue;
          }

          if (filters.workspace && event.ctx?.workspace) {
            const workspaces = Array.isArray(filters.workspace) ? filters.workspace : [filters.workspace];
            if (!workspaces.includes(event.ctx.workspace)) continue;
          }

          allEvents.push(event);
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    // Sort by timestamp (newest first) and apply pagination
    allEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return allEvents.slice(offset, offset + limit);
  } catch {
    // Directory doesn't exist or can't read
    return [];
  }
}

/**
 * Count events in FS sink
 */
export async function countEventsFromFS(
  dirPath: string,
  filters: EventFilters = {}
): Promise<number> {
  const events = await readEventsFromFS(dirPath, { ...filters, limit: undefined, offset: undefined });
  return events.length;
}




