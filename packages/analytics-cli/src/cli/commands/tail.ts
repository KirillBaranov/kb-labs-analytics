/**
 * Tail command - Tail events from buffer
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { keyValue } from '@kb-labs/shared-cli-ui';

/**
 * Find latest segments in buffer directory
 */
async function findLatestSegments(bufferDir: string): Promise<string[]> {
  const files = await readdir(bufferDir).catch(() => []);
  const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

  // Sort by modification time (newest first)
  const segments = await Promise.all(
    jsonlFiles.map(async (file) => {
      const path = join(bufferDir, file);
      const stats = await stat(path).catch(() => null);
      return { path, mtime: stats?.mtimeMs || 0 };
    })
  );

  segments.sort((a, b) => b.mtime - a.mtime);
  return segments.map((s) => s.path).slice(0, 5); // Return top 5 most recent
}

type AnalyticsTailFlags = {
  follow: { type: 'boolean'; description?: string; alias?: string; default?: boolean };
  grep: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsTailResult = CommandResult & {
  events?: Array<Record<string, unknown>>;
};

export const run = defineCommand<AnalyticsTailFlags, AnalyticsTailResult>({
  name: 'analytics:tail',
  flags: {
    follow: {
      type: 'boolean',
      description: 'Follow file for new events',
      alias: 'f',
      default: false,
    },
    grep: {
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
    const follow = flags.follow;
    const grep = flags.grep;
    const cwd = ctx?.cwd || process.cwd();
    
    ctx.logger?.info('Analytics tail started', { follow, grep });

    ctx.tracker.checkpoint('read');

    try {
      // Find repo root
      let repoRoot: string;
      try {
        repoRoot = await findRepoRoot(cwd);
      } catch {
        repoRoot = cwd;
      }

      const bufferDir = join(repoRoot, '.kb/analytics/buffer');

      // Find latest segments
      const segments = await findLatestSegments(bufferDir);
      if (segments.length === 0) {
        ctx.logger?.info('No events found');
        
        if (flags.json) {
          ctx.output?.json({ ok: true, events: [], message: 'No events found' });
        } else {
          ctx.output?.info('No events found');
        }
        return { ok: true, events: [] };
      }

      // Read and display events
      const events: any[] = [];
      for (const segment of segments) {
        const content = await readFile(segment, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line) {
            continue;
          }

          try {
            const event = JSON.parse(line);

            // Filter by grep
            if (grep) {
              const [key, value] = grep.split('=');
              if (key === 'type' && event.type !== value) {
                continue;
              }
            }

            events.push(event);
            if (!flags.json && !follow) {
              ctx.output?.write(line + '\n');
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      
      ctx.tracker.checkpoint('complete');
      
      ctx.logger?.info('Analytics tail completed', { eventsCount: events.length, follow });

      if (flags.json) {
        ctx.output?.json({ ok: true, events });
        return { ok: true, events };
      }

      if (follow) {
        const latestSegment = segments[segments.length - 1];
        const info: Record<string, string> = {
          Status: ctx.output?.ui.colors.info(`${ctx.output?.ui.symbols.info} Following: ${latestSegment}`) ?? `Following: ${latestSegment}`,
        };
        const outputText = ctx.output?.ui.box('Analytics Tail', keyValue(info));
        ctx.output?.write(outputText);
        ctx.output?.info('Press Ctrl+C to stop following');
        // TODO: Implement actual follow logic with file watching
        return { ok: true, events };
      }

      if (events.length === 0 && grep) {
        ctx.output?.info(`No events matched filter: ${grep}`);
      } else if (events.length > 0) {
        const info: Record<string, string> = {
          'Events found': `${events.length}`,
        };
        if (grep) {
          info['Filter'] = grep;
        }
        const outputText = ctx.output?.ui.box('Analytics Tail', keyValue(info));
        ctx.output?.write(outputText);
      }

      return { ok: true, events };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger?.error('Analytics tail failed', { error: errorMessage });
      
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

export async function tailCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
