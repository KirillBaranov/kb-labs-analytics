/**
 * Status command - Show analytics status
 *
 * Shows file-based buffer statistics after architecture simplification.
 */

import { defineCommand, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

type AnalyticsStatusFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsStatusResult = CommandResult & {
  buffer?: {
    segments: number;
    totalSizeBytes: number;
  };
  dlq?: {
    files: number;
    totalSizeBytes: number;
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
      let repoRoot: string;
      try {
        repoRoot = await findRepoRoot(cwd);
      } catch {
        repoRoot = cwd;
      }

      const analyticsDir = join(repoRoot, '.kb/analytics');
      const bufferDir = join(analyticsDir, 'buffer');
      const dlqDir = join(analyticsDir, 'dlq');

      // Buffer status
      const bufferFiles = await readdir(bufferDir).catch(() => []);
      const segments = bufferFiles.filter((f) => f.endsWith('.jsonl'));

      let bufferSize = 0;
      for (const file of segments) {
        const stats = await stat(join(bufferDir, file)).catch(() => null);
        if (stats) {
          bufferSize += stats.size;
        }
      }

      // DLQ status
      const dlqFiles = await readdir(dlqDir).catch(() => []);
      const dlqSegments = dlqFiles.filter((f) => f.endsWith('.jsonl'));

      let dlqSize = 0;
      for (const file of dlqSegments) {
        const stats = await stat(join(dlqDir, file)).catch(() => null);
        if (stats) {
          dlqSize += stats.size;
        }
      }

      ctx.tracker.checkpoint('complete');

      const result = {
        buffer: {
          segments: segments.length,
          totalSizeBytes: bufferSize,
        },
        dlq: {
          files: dlqSegments.length,
          totalSizeBytes: dlqSize,
        },
      };

      ctx.logger?.info('Analytics status completed', result);

      if (flags.json) {
        ctx.output?.json({
          ok: true,
          ...result,
        });
        return { ok: true, ...result };
      }

      const sections: Array<{ header?: string; items: string[] }> = [];

      // Buffer section
      sections.push({
        header: 'Buffer',
        items: [
          `Segments: ${segments.length}`,
          `Total size: ${(bufferSize / 1024).toFixed(2)} KB`,
        ],
      });

      // DLQ section
      sections.push({
        header: 'Dead Letter Queue',
        items: [
          `Files: ${dlqSegments.length}`,
          `Total size: ${(dlqSize / 1024).toFixed(2)} KB`,
        ],
      });

      const outputText = ctx.output?.ui.sideBox({
        title: 'Analytics Status',
        sections,
        status: 'info',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);

      return { ok: true, ...result };
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
