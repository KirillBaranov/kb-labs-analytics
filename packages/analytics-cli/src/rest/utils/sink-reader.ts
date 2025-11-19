/**
 * @module @kb-labs/analytics-cli/rest/utils/sink-reader
 * Utilities for reading events from configured sinks
 */

import { loadAnalyticsConfig } from '@kb-labs/analytics-core';
import { findRepoRoot } from '@kb-labs/core';
import { join } from 'node:path';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';
import type { SinkConfig } from '@kb-labs/analytics-core';

export interface EventFilters {
  type?: string | string[];
  product?: string | string[];
  workspace?: string | string[];
  timeRange?: {
    from: string; // ISO string
    to: string; // ISO string
  } | string; // 'today' | 'week' | 'month'
  limit?: number;
  offset?: number;
}

export interface AvailableSink {
  type: 'sqlite' | 'fs' | 'buffer';
  path?: string;
  config: SinkConfig;
}

/**
 * Get available sinks from config
 */
export async function getAvailableSinks(cwd: string): Promise<AvailableSink[]> {
  const { config } = await loadAnalyticsConfig(cwd);
  
  if (!config.sinks || config.sinks.length === 0) {
    // Fallback to buffer
    const repoRoot = await findRepoRoot(cwd).catch(() => cwd);
    return [{
      type: 'buffer',
      path: join(repoRoot, '.kb/analytics/buffer'),
      config: { type: 'fs' },
    }];
  }

  const repoRoot = await findRepoRoot(cwd).catch(() => cwd);
  const sinks: AvailableSink[] = [];

  for (const sinkConfig of config.sinks) {
    if (sinkConfig.type === 'sqlite') {
      const path = (sinkConfig.path as string | undefined) || join(repoRoot, '.kb/analytics/events.db');
      sinks.push({
        type: 'sqlite',
        path,
        config: sinkConfig,
      });
    } else if (sinkConfig.type === 'fs') {
      const path = (sinkConfig.path as string | undefined) || join(repoRoot, '.kb/analytics/events');
      sinks.push({
        type: 'fs',
        path,
        config: sinkConfig,
      });
    }
  }

  // Always add buffer as fallback
  sinks.push({
    type: 'buffer',
    path: join(repoRoot, '.kb/analytics/buffer'),
    config: { type: 'fs' },
  });

  return sinks;
}

/**
 * Get the best sink for reading (priority: sqlite > fs > buffer)
 */
export async function getBestSink(cwd: string): Promise<AvailableSink | null> {
  const sinks = await getAvailableSinks(cwd);
  
  // Priority: sqlite > fs > buffer
  const sqliteSink = sinks.find(s => s.type === 'sqlite');
  if (sqliteSink) return sqliteSink;
  
  const fsSink = sinks.find(s => s.type === 'fs');
  if (fsSink) return fsSink;
  
  return sinks.find(s => s.type === 'buffer') || null;
}




