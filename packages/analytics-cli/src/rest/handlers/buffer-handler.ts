import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { AnalyticsBufferStatusSchema } from '../../contracts/analytics.schema';
import { findRepoRoot } from '@kb-labs/sdk';

type HandlerContext = {
  cwd?: string;
};

export async function handleGetBufferStatus(_input: unknown, ctx: HandlerContext = {}) {
  const cwd = ctx.cwd ?? process.cwd();
  const repoRoot = await findRepoRoot(cwd);
  const bufferDir = join(repoRoot, '.kb', 'analytics', 'buffer');

  const files = await collectFileEntries(bufferDir);
  return AnalyticsBufferStatusSchema.parse({
    totalFiles: files.length,
    files,
  });
}

async function collectFileEntries(dir: string) {
  const entries = await readdir(dir).catch(() => []);
  const jsonlFiles = entries.filter((entry) => entry.endsWith('.jsonl'));
  const files = [];
  for (const file of jsonlFiles) {
    try {
      const filePath = join(dir, file);
      const stats = await stat(filePath);
      files.push({
        file,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      });
    } catch {
      // ignore
    }
  }
  return files.sort((a, b) => (a.file < b.file ? -1 : 1));
}


