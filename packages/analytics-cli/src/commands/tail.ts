/**
 * Tail command - Tail events from buffer
 */

import type { Command } from '@kb-labs/cli-commands';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';
import { box, keyValue, safeSymbols, safeColors } from '@kb-labs/shared-cli-ui';

export const tail: Command = {
  name: 'analytics:tail',
  category: 'analytics',
  describe: 'Tail events from buffer',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const follow = !!(flags.follow || flags.f);
    const grep = flags.grep as string | undefined;
    const cwd = ctx?.cwd || process.cwd();

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
        if (jsonMode) {
          ctx.presenter.json({ ok: true, events: [], message: 'No events found' });
        } else {
          ctx.presenter.info('No events found');
        }
        return 0;
      }

      // Read and display events
      const events: any[] = [];
      for (const segment of segments) {
        const content = await readFile(segment, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line) continue;

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
            if (!jsonMode && !follow) {
              ctx.presenter.write(line + '\n');
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      if (jsonMode) {
        ctx.presenter.json({ ok: true, events });
        return 0;
      }

      if (follow) {
        const latestSegment = segments[segments.length - 1];
        const info: Record<string, string> = {
          Status: safeColors.info(`${safeSymbols.info} Following: ${latestSegment}`),
        };
        const output = box('Analytics Tail', keyValue(info));
        ctx.presenter.write(output);
        ctx.presenter.info('Press Ctrl+C to stop following');
        // TODO: Implement actual follow logic with file watching
        return 0;
      }

      if (events.length === 0 && grep) {
        ctx.presenter.info(`No events matched filter: ${grep}`);
      } else if (events.length > 0) {
        const info: Record<string, string> = {
          'Events found': `${events.length}`,
        };
        if (grep) {
          info['Filter'] = grep;
        }
        const output = box('Analytics Tail', keyValue(info));
        ctx.presenter.write(output);
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
