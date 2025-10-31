/**
 * Dead-Letter Queue (DLQ) - Store failed events for replay
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import type { AnalyticsEventV1 } from './types/types';
import { createAnalyticsError, ANALYTICS_ERROR_CODES } from './errors';

export interface DLQEntry {
  event: AnalyticsEventV1;
  error: string;
  timestamp: number;
  retryCount?: number;
}

export interface DLQFilter {
  eventId?: string;
  eventType?: string;
  runId?: string;
  errorContains?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
}

/**
 * Dead-Letter Queue manager
 */
export class DeadLetterQueue {
  private dlqDir: string;
  private currentFile: string | null = null;
  private fileHandle: fsp.FileHandle | null = null;

  constructor(dlqDir: string) {
    this.dlqDir = dlqDir;
  }

  /**
   * Initialize DLQ directory
   */
  async init(): Promise<void> {
    await fsp.mkdir(this.dlqDir, { recursive: true });
  }

  /**
   * Add failed event to DLQ
   */
  async add(event: AnalyticsEventV1, error: Error | string): Promise<void> {
    const entry: DLQEntry = {
      event,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.ensureFile();
    if (!this.fileHandle) {
      throw createAnalyticsError(
        ANALYTICS_ERROR_CODES.ERR_ANALYTICS_DLQ_ERROR,
        'Failed to open DLQ file'
      );
    }

    const line = JSON.stringify(entry) + '\n';
    await this.fileHandle.appendFile(line);
  }

  /**
   * Ensure DLQ file is open
   */
  private async ensureFile(): Promise<void> {
    if (this.fileHandle && this.currentFile) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dlq-${timestamp}.jsonl`;
    this.currentFile = join(this.dlqDir, filename);

    // Close previous handle if exists
    if (this.fileHandle) {
      await this.fileHandle.close();
    }

    this.fileHandle = await fsp.open(this.currentFile, 'a');
  }

  /**
   * List all DLQ files
   */
  async listFiles(): Promise<string[]> {
    const files = await fsp.readdir(this.dlqDir);
    return files
      .filter((f) => f.startsWith('dlq-') && f.endsWith('.jsonl'))
      .map((f) => join(this.dlqDir, f))
      .sort();
  }

  /**
   * Read entries from DLQ file with optional filter
   */
  async readEntries(filePath: string, filter?: DLQFilter): Promise<DLQEntry[]> {
    const content = await fsp.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const entries: DLQEntry[] = lines.map((line) => JSON.parse(line) as DLQEntry);

    if (!filter) {
      return entries;
    }

    return entries.filter((entry) => {
      if (filter.eventId && entry.event.id !== filter.eventId) {
        return false;
      }
      if (filter.eventType && entry.event.type !== filter.eventType) {
        return false;
      }
      if (filter.runId && entry.event.runId !== filter.runId) {
        return false;
      }
      if (filter.errorContains && !entry.error.includes(filter.errorContains)) {
        return false;
      }
      if (filter.fromTimestamp && entry.timestamp < filter.fromTimestamp) {
        return false;
      }
      if (filter.toTimestamp && entry.timestamp > filter.toTimestamp) {
        return false;
      }
      return true;
    });
  }

  /**
   * Replay entries from DLQ (extract events, don't delete entries)
   */
  async replay(filePath: string, filter?: DLQFilter): Promise<AnalyticsEventV1[]> {
    const entries = await this.readEntries(filePath, filter);
    return entries.map((entry) => entry.event);
  }

  /**
   * Remove DLQ file (after successful replay)
   */
  async removeFile(filePath: string): Promise<void> {
    await fsp.unlink(filePath);
  }

  /**
   * Get DLQ stats
   */
  async getStats(): Promise<{ totalFiles: number; totalEntries: number }> {
    const files = await this.listFiles();
    let totalEntries = 0;

    for (const file of files) {
      const entries = await this.readEntries(file);
      totalEntries += entries.length;
    }

    return {
      totalFiles: files.length,
      totalEntries,
    };
  }

  /**
   * Close DLQ
   */
  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
      this.currentFile = null;
    }
  }
}

