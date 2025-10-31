/**
 * DLQ command - Dead-Letter Queue operations
 */

import type { Command } from '@kb-labs/cli-commands';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { emit } from '@kb-labs/analytics-sdk-node';
import { box, keyValue, safeSymbols, safeColors, formatTiming, TimingTracker } from '@kb-labs/shared-cli-ui';

export const dlq: Command = {
  name: 'analytics:dlq',
  category: 'analytics',
  describe: 'Dead-Letter Queue operations',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const subcommand = argv[0] || 'list';
    const filter = flags.filter as string | undefined;
    const cwd = ctx?.cwd || process.cwd();

    switch (subcommand) {
      case 'list':
        return await listDlqFiles(ctx, jsonMode, cwd);
      case 'replay':
        return await replayDlqEvents(ctx, jsonMode, cwd, filter);
      default:
        if (jsonMode) {
          ctx.presenter.json({
            ok: false,
            error: `Unknown DLQ command: ${subcommand}. Use 'list' or 'replay'`,
          });
        } else {
          ctx.presenter.error(`Unknown DLQ command: ${subcommand}. Use 'list' or 'replay'`);
        }
        return 1;
    }
  },
};

/**
 * List DLQ files
 */
async function listDlqFiles(ctx: any, jsonMode: boolean, cwd: string): Promise<number> {
  try {
    let repoRoot: string;
    try {
      repoRoot = await findRepoRoot(cwd);
    } catch {
      repoRoot = cwd;
    }

    const dlqDir = join(repoRoot, '.kb/analytics/dlq');
    const files = await readdir(dlqDir).catch(() => []);

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
    
    if (jsonMode) {
      ctx.presenter.json({
        ok: true,
        files: jsonlFiles,
        count: jsonlFiles.length,
      });
      return 0;
    }

    if (jsonlFiles.length === 0) {
      ctx.presenter.info('No DLQ files found');
      return 0;
    }

    const lines: string[] = [];
    lines.push(...keyValue({ 'DLQ files': `${jsonlFiles.length}` }));
    lines.push('');
    for (const file of jsonlFiles) {
      lines.push(`${safeColors.dim(file)}`);
    }
    const output = box('Dead-Letter Queue', lines);
    ctx.presenter.write(output);
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
}

/**
 * Replay DLQ events
 */
async function replayDlqEvents(
  ctx: any,
  jsonMode: boolean,
  cwd: string,
  filter?: string
): Promise<number> {
  const tracker = new TimingTracker();

  try {
    let repoRoot: string;
    try {
      repoRoot = await findRepoRoot(cwd);
    } catch {
      repoRoot = cwd;
    }

    const dlqDir = join(repoRoot, '.kb/analytics/dlq');
    const files = await readdir(dlqDir).catch(() => []);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      if (jsonMode) {
        ctx.presenter.json({ ok: true, replayed: 0, message: 'No DLQ files to replay' });
      } else {
        ctx.presenter.info('No DLQ files to replay');
      }
      return 0;
    }

    tracker.checkpoint('read');

    let replayed = 0;
    let failed = 0;

    for (const file of jsonlFiles) {
      const filePath = join(dlqDir, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line) continue;

        try {
          const event = JSON.parse(line);

          // Apply filter
          if (filter) {
            const [key, value] = filter.split('=');
            if (key === 'type' && event.type !== value) {
              continue;
            }
          }

          // Replay event
          const result = await emit(event);
          if (result.queued) {
            replayed++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }
    }

    const duration = tracker.total();

    if (jsonMode) {
      ctx.presenter.json({
        ok: true,
        replayed,
        failed,
        duration: formatTiming(duration),
      });
      return 0;
    }

    const info: Record<string, string> = {
      Status: safeColors.success(`${safeSymbols.success} Replayed ${replayed} event(s)`),
      Failed: failed > 0 ? safeColors.error(`${failed}`) : '0',
      Duration: formatTiming(duration),
    };
    if (filter) {
      info['Filter'] = filter;
    }

    const output = box('DLQ Replay', keyValue(info));
    ctx.presenter.write(output);
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
}
