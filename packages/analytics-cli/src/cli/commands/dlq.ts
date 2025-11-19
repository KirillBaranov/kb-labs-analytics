/**
 * DLQ command - Dead-Letter Queue operations
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { emit } from '@kb-labs/analytics-sdk-node';
import { keyValue, formatTiming } from '@kb-labs/shared-cli-ui';
import type { EnhancedCliContext } from '@kb-labs/cli-command-kit';

/**
 * List DLQ files
 */
async function listDlqFiles(ctx: EnhancedCliContext, jsonMode: boolean, cwd: string): Promise<{ ok: boolean; exitCode?: number }> {
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
    
    ctx.logger?.info('DLQ list completed', { filesCount: jsonlFiles.length });
    
    if (jsonMode) {
      ctx.output?.json({
        ok: true,
        files: jsonlFiles,
        count: jsonlFiles.length,
      });
      return { ok: true };
    }

    if (jsonlFiles.length === 0) {
      ctx.output?.info('No DLQ files found');
      return { ok: true };
    }

    const lines: string[] = [];
    lines.push(...keyValue({ 'DLQ files': `${jsonlFiles.length}` }));
    lines.push('');
    for (const file of jsonlFiles) {
      lines.push(`${ctx.output?.ui.colors.muted(file) ?? file}`);
    }
    const outputText = ctx.output?.ui.box('Dead-Letter Queue', lines);
    ctx.output?.write(outputText);
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.logger?.error('DLQ list failed', { error: errorMessage });
    
    if (jsonMode) {
      ctx.output?.json({
        ok: false,
        error: errorMessage,
      });
    } else {
      ctx.output?.error(error instanceof Error ? error : new Error(errorMessage));
    }
    return { ok: false, exitCode: 1 };
  }
}

/**
 * Replay DLQ events
 */
async function replayDlqEvents(
  ctx: EnhancedCliContext,
  jsonMode: boolean,
  cwd: string,
  filter?: string
): Promise<{ ok: boolean; exitCode?: number }> {
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
      ctx.logger?.info('No DLQ files to replay');
      
      if (jsonMode) {
        ctx.output?.json({ ok: true, replayed: 0, message: 'No DLQ files to replay' });
      } else {
        ctx.output?.info('No DLQ files to replay');
      }
      return { ok: true };
    }

    ctx.tracker.checkpoint('read');

    let replayed = 0;
    let failed = 0;

    for (const file of jsonlFiles) {
      const filePath = join(dlqDir, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line) {
          continue;
        }

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
        } catch (_error) {
          failed++;
        }
      }
    }

    ctx.tracker.checkpoint('complete');
    
    ctx.logger?.info('DLQ replay completed', { replayed, failed });

    if (jsonMode) {
      ctx.output?.json({
        ok: true,
        replayed,
        failed,
        durationMs: ctx.tracker.total(),
      });
      return { ok: true };
    }

    const info: Record<string, string> = {
      Status: ctx.output?.ui.colors.success(`${ctx.output?.ui.symbols.success} Replayed ${replayed} event(s)`) ?? `Replayed ${replayed} event(s)`,
      Failed: failed > 0 ? (ctx.output?.ui.colors.error(`${failed}`) ?? `${failed}`) : '0',
      Duration: formatTiming(ctx.tracker.total()),
    };
    if (filter) {
      info['Filter'] = filter;
    }

    const outputText = ctx.output?.ui.box('DLQ Replay', keyValue(info));
    ctx.output?.write(outputText);
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.logger?.error('DLQ replay failed', { error: errorMessage });
    
    if (jsonMode) {
      ctx.output?.json({
        ok: false,
        error: errorMessage,
      });
    } else {
      ctx.output?.error(error instanceof Error ? error : new Error(errorMessage));
    }
    return { ok: false, exitCode: 1 };
  }
}

type AnalyticsDlqFlags = {
  filter: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsDlqResult = CommandResult & {
  subcommand?: string;
  files?: string[];
  count?: number;
  replayed?: number;
  failed?: number;
  durationMs?: number;
};

export const run = defineCommand<AnalyticsDlqFlags, AnalyticsDlqResult>({
  name: 'analytics:dlq',
  flags: {
    filter: {
      type: 'string',
      description: 'Filter events by pattern (e.g. type=test.event)',
    },
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const subcommand = argv[0] || 'list';
    const filter = flags.filter;
    const cwd = ctx?.cwd || process.cwd();
    
    ctx.logger?.info('Analytics DLQ started', { subcommand, filter });

    switch (subcommand) {
      case 'list':
        return await listDlqFiles(ctx, flags.json, cwd);
      case 'replay':
        return await replayDlqEvents(ctx, flags.json, cwd, filter);
      default:
        ctx.logger?.error('Unknown DLQ command', { subcommand });
        
        if (flags.json) {
          ctx.output?.json({
            ok: false,
            error: `Unknown DLQ command: ${subcommand}. Use 'list' or 'replay'`,
          });
        } else {
          ctx.output?.error(new Error(`Unknown DLQ command: ${subcommand}. Use 'list' or 'replay'`));
        }
        return { ok: false, exitCode: 1 };
    }
  },
});

export async function dlqCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
