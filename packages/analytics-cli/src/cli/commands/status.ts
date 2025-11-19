/**
 * Status command - Show analytics status
 */

import type { Command } from '@kb-labs/cli-commands';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { Analytics } from '@kb-labs/analytics-core';
import { box, safeColors } from '@kb-labs/shared-cli-ui';

export const status: Command = {
  name: 'analytics:status',
  category: 'analytics',
  describe: 'Show analytics status',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const cwd = ctx?.cwd || process.cwd();

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

      if (jsonMode) {
        ctx.presenter.json({
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
        return 0;
      }

      const lines: string[] = [];
      
      // Buffer section
      lines.push('Buffer:');
      lines.push(`  Segments: ${segments.length}`);
      lines.push(`  Total size: ${(totalSize / 1024).toFixed(2)} KB`);
      lines.push('');

      // Metrics section
      lines.push('Metrics:');
      lines.push(`  Events/sec: ${metrics.eventsPerSecond.toFixed(2)}`);
      lines.push(`  Queue depth: ${metrics.queueDepth}`);
      lines.push(`  Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      lines.push('');

      // Backpressure section
      lines.push('Backpressure:');
      lines.push(`  Level: ${backpressure.level}`);
      lines.push(`  Sampling rate: ${(backpressure.samplingRate * 100).toFixed(1)}%`);
      lines.push(`  Drops: ${backpressure.dropCount}`);

      // Circuit breakers section
      const breakerStates = Object.entries(metrics.circuitBreakerStates);
      if (breakerStates.length > 0) {
        lines.push('');
        lines.push('Circuit Breakers:');
        for (const [sinkId, state] of breakerStates) {
          const color = state === 'closed' ? safeColors.success : state === 'open' ? safeColors.error : safeColors.warning;
          lines.push(`  ${sinkId}: ${color(state)}`);
        }
      }

      const output = box('Analytics Status', lines);
      ctx.presenter.write(output);

      await analytics.dispose();
      return 0;
    } catch (error) {
      if (jsonMode) {
        ctx.presenter.json({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        ctx.presenter.error(error instanceof Error ? error.message : String(error));
      }
      return 1;
    }
  },
};

export async function statusCommand(
  ctx: Parameters<Command['run']>[0],
  argv: Parameters<Command['run']>[1],
  flags: Parameters<Command['run']>[2]
) {
  return status.run(ctx, argv, flags);
}
