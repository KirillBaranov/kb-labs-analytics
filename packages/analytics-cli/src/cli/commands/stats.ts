/**
 * Stats command - Show metrics statistics
 *
 * Note: Real-time metrics were previously provided by analytics-core.
 * After architecture simplification, this command shows file-based statistics.
 */

import { defineCommand, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

type AnalyticsStatsFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsStatsResult = CommandResult & {
  stats?: {
    bufferFiles: number;
    dlqFiles: number;
    totalSizeBytes: number;
  };
};

export const run = defineCommand<AnalyticsStatsFlags, AnalyticsStatsResult>({
  name: 'analytics:stats',
  flags: {
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const cwd = ctx?.cwd || process.cwd();

    ctx.logger?.info('Analytics stats started');

    ctx.tracker.checkpoint('init');

    try {
      let repoRoot: string;
      try {
        repoRoot = await findRepoRoot(cwd);
      } catch {
        repoRoot = cwd;
      }

      const analyticsDir = join(repoRoot, '.kb/analytics');
      const bufferDir = join(analyticsDir, 'buffer');
      const dlqDir = join(analyticsDir, 'dlq');

      // Count buffer files
      const bufferFiles = await readdir(bufferDir).catch(() => []);
      const jsonlBufferFiles = bufferFiles.filter((f) => f.endsWith('.jsonl'));

      // Count DLQ files
      const dlqFiles = await readdir(dlqDir).catch(() => []);
      const jsonlDlqFiles = dlqFiles.filter((f) => f.endsWith('.jsonl'));

      // Calculate total size
      let totalSizeBytes = 0;
      for (const file of jsonlBufferFiles) {
        const stats = await stat(join(bufferDir, file)).catch(() => null);
        if (stats) {
          totalSizeBytes += stats.size;
        }
      }
      for (const file of jsonlDlqFiles) {
        const stats = await stat(join(dlqDir, file)).catch(() => null);
        if (stats) {
          totalSizeBytes += stats.size;
        }
      }

      ctx.tracker.checkpoint('complete');

      const stats = {
        bufferFiles: jsonlBufferFiles.length,
        dlqFiles: jsonlDlqFiles.length,
        totalSizeBytes,
      };

      if (flags.json) {
        ctx.output?.json({
          ok: true,
          stats,
        });
        return { ok: true, stats };
      }

      const items: string[] = [
        `Buffer files: ${stats.bufferFiles}`,
        `DLQ files: ${stats.dlqFiles}`,
        `Total size: ${(stats.totalSizeBytes / 1024).toFixed(2)} KB`,
      ];

      const outputText = ctx.output?.ui.sideBox({
        title: 'Analytics Stats',
        sections: [
          {
            items,
          },
        ],
        status: 'info',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);

      ctx.logger?.info('Analytics stats completed');
      return { ok: true, stats };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger?.error('Analytics stats failed', { error: errorMessage });

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

export async function statsCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
