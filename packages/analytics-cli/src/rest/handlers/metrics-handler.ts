/**
 * @module @kb-labs/analytics-cli/rest/handlers/metrics-handler
 * Handler for performance metrics (latency, throughput, error rate)
 */

import { findRepoRoot } from '@kb-labs/core';
import { join } from 'node:path';
import { Analytics } from '@kb-labs/analytics-core';
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

export async function handleMetrics(input: MetricsQuery, ctx: HandlerContext = {}) {
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

  // Get analytics instance for real-time metrics
  const analytics = new Analytics({ cwd });
  await analytics.init();
  const metrics = analytics.getMetrics();
  const backpressure = analytics.getBackpressureState();
  await analytics.dispose();

  // Get events for calculating metrics
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

  // Calculate metrics from events
  const errorEvents = events.filter(e => e.type.includes('error') || e.type.includes('failed'));
  const errorRate = events.length > 0 ? errorEvents.length / events.length : 0;

  // Calculate latency from events with duration in payload
  const latencyEvents = events.filter(e => {
    if (e.payload && typeof e.payload === 'object') {
      const payload = e.payload as Record<string, unknown>;
      return 'duration' in payload || 'durationMs' in payload || 'latency' in payload || 'latencyMs' in payload;
    }
    return false;
  });

  const latencies: number[] = [];
  for (const event of latencyEvents) {
    if (event.payload && typeof event.payload === 'object') {
      const payload = event.payload as Record<string, unknown>;
      const duration = payload.durationMs || payload.duration || payload.latencyMs || payload.latency;
      if (typeof duration === 'number') {
        latencies.push(duration);
      }
    }
  }

  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  const p50Latency = latencies.length > 0
    ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)]
    : 0;

  const p95Latency = latencies.length > 0
    ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
    : 0;

  // Group events by time for throughput calculation
  const timeGroups = new Map<string, number>();
  for (const event of events) {
    const eventDate = new Date(event.ts);
    const timeKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
    const count = timeGroups.get(timeKey) || 0;
    timeGroups.set(timeKey, count + 1);
  }

  const throughputPoints = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x, y]) => ({ x, y }));

  const latencyPoints = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x]) => {
      // Calculate average latency for this time bucket
      const bucketEvents = events.filter(e => {
        const eventDate = new Date(e.ts);
        const eventKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
        return eventKey === x;
      });
      
      const bucketLatencies: number[] = [];
      for (const event of bucketEvents) {
        if (event.payload && typeof event.payload === 'object') {
          const payload = event.payload as Record<string, unknown>;
          const duration = payload.durationMs || payload.duration || payload.latencyMs || payload.latency;
          if (typeof duration === 'number') {
            bucketLatencies.push(duration);
          }
        }
      }
      
      const avg = bucketLatencies.length > 0
        ? bucketLatencies.reduce((a, b) => a + b, 0) / bucketLatencies.length
        : 0;
      
      return { x, y: avg };
    });

  const errorRatePoints = Array.from(timeGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([x]) => {
      const bucketEvents = events.filter(e => {
        const eventDate = new Date(e.ts);
        const eventKey = eventDate.toISOString().slice(0, 13) + ':00:00Z';
        return eventKey === x;
      });
      
      const bucketErrors = bucketEvents.filter(e => 
        e.type.includes('error') || e.type.includes('failed')
      );
      
      const rate = bucketEvents.length > 0 ? bucketErrors.length / bucketEvents.length : 0;
      return { x, y: rate * 100 }; // Convert to percentage
    });

  // Format for keyvalue widget: { items: Array<{ key: string; value: string | number }> }
  const kpiItems = [
    { key: 'Events/sec', value: metrics.eventsPerSecond.toFixed(2) },
    { key: 'Queue Depth', value: metrics.queueDepth },
    { key: 'Error Rate', value: `${(errorRate * 100).toFixed(2)}%` },
    { key: 'Avg Latency', value: `${avgLatency.toFixed(0)}ms` },
    { key: 'P50 Latency', value: `${p50Latency.toFixed(0)}ms` },
    { key: 'P95 Latency', value: `${p95Latency.toFixed(0)}ms` },
    { key: 'Backpressure', value: backpressure.level },
    { key: 'Sampling Rate', value: `${(backpressure.samplingRate * 100).toFixed(1)}%` },
  ];

  // Return KPI metrics (keyvalue widget)
  return {
    items: kpiItems,
  };
}

