/**
 * Compact command - Compact old segments
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { loadAnalyticsConfig } from '@kb-labs/analytics-core';
import { keyValue, formatTiming } from '@kb-labs/shared-cli-ui';

type AnalyticsCompactFlags = {
  'dry-run': { type: 'boolean'; description?: string; default?: boolean };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsCompactResult = CommandResult & {
  deleted?: number;
  filesCount?: number;
  retentionDays?: number;
};

export const run = defineCommand<AnalyticsCompactFlags, AnalyticsCompactResult>({
  name: 'analytics:compact',
  flags: {
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be deleted without actually deleting',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const dryRun = flags['dry-run'];
    const cwd = ctx?.cwd || process.cwd();
    
    ctx.logger?.info('Analytics compact started', { dryRun, cwd });

    ctx.tracker.checkpoint('load');

    // Load config to get retention settings
    const cwdStr = typeof cwd === 'string' ? cwd : process.cwd();
    const { config } = await loadAnalyticsConfig(cwdStr);
    const retentionDays = config.retention?.wal?.days || 7;

    // Find repo root
    let repoRoot: string;
    try {
      repoRoot = await findRepoRoot(cwd);
    } catch {
      repoRoot = cwd;
    }

    const bufferDir = join(repoRoot, '.kb/analytics/buffer');
    const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    ctx.tracker.checkpoint('scan');

    // Find all segment files
    const files = await readdir(bufferDir).catch(() => []);
    const segmentFiles = files.filter((f) => f.endsWith('.jsonl') || f.endsWith('.idx'));

    let deleted = 0;
    const toDelete: string[] = [];

    for (const file of segmentFiles) {
      const filePath = join(bufferDir, file);
      const stats = await stat(filePath).catch(() => null);

      if (stats && stats.mtimeMs < cutoffDate) {
        toDelete.push(file);
        if (!dryRun) {
          await unlink(filePath);
          deleted++;
        }
      }
    }

    ctx.tracker.checkpoint('complete');
    
    ctx.logger?.info('Analytics compact completed', { 
      dryRun,
      deleted: dryRun ? toDelete.length : deleted,
      filesCount: toDelete.length,
      retentionDays,
    });

    if (flags.json) {
      ctx.output?.json({
        ok: true,
        dryRun,
        deleted: dryRun ? toDelete.length : deleted,
        files: toDelete,
        retentionDays,
        durationMs: ctx.tracker.total(),
      });
      return { ok: true };
    }

    const info: Record<string, string> = {
      Mode: dryRun
        ? (ctx.output?.ui.colors.muted('DRY RUN (no files deleted)') ?? 'DRY RUN')
        : (ctx.output?.ui.colors.success(`${ctx.output?.ui.symbols.success} Deleted ${deleted} file(s)`) ?? `Deleted ${deleted} file(s)`),
      'Retention policy': `${retentionDays} days`,
      'Files to delete': `${toDelete.length}`,
      Duration: formatTiming(ctx.tracker.total()),
    };

    const outputText = ctx.output?.ui.box('Analytics Compact', keyValue(info));
    ctx.output?.write(outputText);

    if (dryRun && toDelete.length > 0) {
      ctx.output?.write('\nFiles that would be deleted:\n');
      for (const file of toDelete.slice(0, 10)) {
        ctx.output?.write(`  ${ctx.output?.ui.colors.muted(file) ?? file}\n`);
      }
      if (toDelete.length > 10) {
        ctx.output?.write(`  ... and ${toDelete.length - 10} more\n`);
      }
    }

    return { ok: true, deleted: dryRun ? toDelete.length : deleted, files: toDelete };
  },
});

export async function compactCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
