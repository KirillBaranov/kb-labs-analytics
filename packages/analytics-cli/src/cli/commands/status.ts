/**
 * Status command - Show analytics status
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { Analytics } from '@kb-labs/analytics-core';

type AnalyticsStatusFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsStatusResult = CommandResult & {
  buffer?: {
    segments: number;
    totalSize: number;
  };
  metrics?: {
    eventsPerSecond: number;
    queueDepth: number;
    errorRate: number;
  };
  backpressure?: {
    level: string;
    samplingRate: number;
    dropCount: number;
  };
};

export const run = defineCommand<AnalyticsStatusFlags, AnalyticsStatusResult>({
  name: 'analytics:status',
  flags: {
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const cwd = ctx?.cwd || process.cwd();
    
    ctx.logger?.info('Analytics status started', { cwd });

    ctx.tracker.checkpoint('init');

    try {
      const analytics = new Analytics({ cwd });
      await analytics.init();

      // Get metrics
      const metrics = analytics.getMetrics();
      const backpressure = analytics.getBackpressureState();

      // Buffer status
      let repoRoot: string;
      try {
        repoRoot = await findRepoRoot(cwd);
      } catch {
        repoRoot = cwd;
      }

      const bufferDir = join(repoRoot, '.kb/analytics/buffer');
      const bufferFiles = await readdir(bufferDir).catch(() => []);
      const segments = bufferFiles.filter((f) => f.endsWith('.jsonl'));

      let totalSize = 0;
      for (const file of segments) {
        const stats = await stat(join(bufferDir, file)).catch(() => null);
        if (stats) {
          totalSize += stats.size;
        }
      }

      ctx.tracker.checkpoint('complete');

      ctx.logger?.info('Analytics status completed', { 
        segmentsCount: segments.length,
        totalSize,
        eventsPerSecond: metrics.eventsPerSecond,
        queueDepth: metrics.queueDepth,
      });

      if (flags.json) {
        ctx.output?.json({
          ok: true,
          buffer: {
            segments: segments.length,
            totalSize,
          },
          metrics: {
            eventsPerSecond: metrics.eventsPerSecond,
            queueDepth: metrics.queueDepth,
            errorRate: metrics.errorRate,
          },
          backpressure: {
            level: backpressure.level,
            samplingRate: backpressure.samplingRate,
            dropCount: backpressure.dropCount,
          },
          circuitBreakers: metrics.circuitBreakerStates,
        });
        await analytics.dispose();
        return { ok: true };
      }

      const sections: Array<{ header?: string; items: string[] }> = [];

      // Buffer section
      sections.push({
        header: 'Buffer',
        items: [
          `Segments: ${segments.length}`,
          `Total size: ${(totalSize / 1024).toFixed(2)} KB`,
        ],
      });

      // Metrics section
      sections.push({
        header: 'Metrics',
        items: [
          `Events/sec: ${metrics.eventsPerSecond.toFixed(2)}`,
          `Queue depth: ${metrics.queueDepth}`,
          `Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`,
        ],
      });

      // Backpressure section
      sections.push({
        header: 'Backpressure',
        items: [
          `Level: ${backpressure.level}`,
          `Sampling rate: ${(backpressure.samplingRate * 100).toFixed(1)}%`,
          `Drops: ${backpressure.dropCount}`,
        ],
      });

      // Circuit breakers section
      const breakerStates = Object.entries(metrics.circuitBreakerStates);
      if (breakerStates.length > 0) {
        const breakerItems: string[] = [];
        for (const [sinkId, state] of breakerStates) {
          const color =
            state === 'closed'
              ? ctx.output?.ui.colors.success
              : state === 'open'
                ? ctx.output?.ui.colors.error
                : ctx.output?.ui.colors.warn;
          breakerItems.push(`${sinkId}: ${color ? color(state) : state}`);
        }
        sections.push({
          header: 'Circuit Breakers',
          items: breakerItems,
        });
      }

      const outputText = ctx.output?.ui.sideBox({
        title: 'Analytics Status',
        sections,
        status: 'info',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);

      await analytics.dispose();
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger?.error('Analytics status failed', { error: errorMessage });
      
      if (flags.json) {
        ctx.output?.json({
          ok: false,
          error: errorMessage,
        });
      } else {
        ctx.output?.error(error instanceof Error ? error : new Error(errorMessage));
      }
      return { ok: false, exitCode: 1, error: errorMessage };
    }
  },
});

export async function statusCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
