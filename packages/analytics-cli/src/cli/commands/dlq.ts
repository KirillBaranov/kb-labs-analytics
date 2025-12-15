/**
 * DLQ command - Dead-Letter Queue operations
 */

import { defineCommand, findRepoRoot, useAnalytics, type CommandResult } from '@kb-labs/sdk';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * List DLQ files
 */
async function listDlqFiles(ctx: any, jsonMode: boolean, cwd: string): Promise<{ ok: boolean; exitCode?: number }> {
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

    const items: string[] = [
      `DLQ files: ${jsonlFiles.length}`,
      '',
      ...jsonlFiles.map((file) => ctx.output?.ui.colors.muted(file) ?? file),
    ];

    const outputText = ctx.output?.ui.sideBox({
      title: 'Dead-Letter Queue',
      sections: [
        {
          items,
        },
      ],
      status: 'info',
    });
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
  ctx: any,
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

    const analytics = useAnalytics();
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
          if (analytics) {
            try {
              await analytics.track(event.type, event.payload || {});
              replayed++;
            } catch {
              failed++;
            }
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

    const items: string[] = [
      `${ctx.output?.ui.symbols.success} ${ctx.output?.ui.colors.success(`Replayed ${replayed} event(s)`)}`,
      `Failed: ${failed > 0 ? ctx.output?.ui.colors.error(`${failed}`) : '0'}`,
    ];
    if (filter) {
      items.push(`Filter: ${filter}`);
    }

    const outputText = ctx.output?.ui.sideBox({
      title: 'DLQ Replay',
      sections: [
        {
          items,
        },
      ],
      status: failed > 0 ? 'warning' : 'success',
      timing: ctx.tracker.total(),
    });
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
        return await listDlqFiles(ctx, !!flags.json, cwd);
      case 'replay':
        return await replayDlqEvents(ctx, !!flags.json, cwd, filter);
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
