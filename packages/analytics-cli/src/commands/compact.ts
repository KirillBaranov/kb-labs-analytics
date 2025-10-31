/**
 * Compact command - Compact old segments
 */

import type { Command } from '@kb-labs/cli-commands';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { loadAnalyticsConfig } from '@kb-labs/analytics-core';
import { box, keyValue, formatTiming, TimingTracker, safeSymbols, safeColors } from '@kb-labs/shared-cli-ui';

export const compact: Command = {
  name: 'analytics:compact',
  category: 'analytics',
  describe: 'Compact old segments',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const dryRun = !!(flags['dry-run'] || flags.dryRun);
    const tracker = new TimingTracker();
    const cwd = ctx?.cwd || process.cwd();

    try {
      tracker.checkpoint('load');

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

      tracker.checkpoint('scan');

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

      const duration = tracker.total();

      if (jsonMode) {
        ctx.presenter.json({
          ok: true,
          dryRun,
          deleted: dryRun ? toDelete.length : deleted,
          files: toDelete,
          retentionDays,
          duration: formatTiming(duration),
        });
        return 0;
      }

      const info: Record<string, string> = {
        Mode: dryRun
          ? safeColors.dim('DRY RUN (no files deleted)')
          : safeColors.success(`${safeSymbols.success} Deleted ${deleted} file(s)`),
        'Retention policy': `${retentionDays} days`,
        'Files to delete': `${toDelete.length}`,
        Duration: formatTiming(duration),
      };

      const output = box('Analytics Compact', keyValue(info));
      ctx.presenter.write(output);

      if (dryRun && toDelete.length > 0) {
        ctx.presenter.write('\nFiles that would be deleted:\n');
        for (const file of toDelete.slice(0, 10)) {
          ctx.presenter.write(`  ${safeColors.dim(file)}\n`);
        }
        if (toDelete.length > 10) {
          ctx.presenter.write(`  ... and ${toDelete.length - 10} more\n`);
        }
      }

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
