/**
 * FS Sink - Write events to filesystem (JSONL files)
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-core';
import type { SinkConfig } from '@kb-labs/analytics-core';

export interface FSSinkConfig extends SinkConfig {
  type: 'fs';
  path?: string; // Output directory (required)
  prefix?: string; // File prefix (default: "events")
  rotateSize?: number; // Rotate at size (bytes, default: 10MB)
  retentionDays?: number; // Retention policy (days, default: 30)
  idempotencyKey?: string; // Header/metadata key for idempotency
}

/**
 * FS Sink - Write events to JSONL files
 */
export class FSSink {
  private config: {
    type: 'fs';
    id?: string;
    path: string;
    prefix: string;
    rotateSize: number;
    retentionDays: number;
    idempotencyKey: string;
  };
  private currentFile: string | null = null;
  private currentSize = 0;
  private writtenEvents = new Set<string>(); // Track written event IDs for idempotency

  constructor(config: FSSinkConfig) {
    if (!config.path) {
      throw new Error('FSSink requires path configuration');
    }

    this.config = {
      type: 'fs',
      id: config.id as string | undefined,
      path: config.path as string,
      prefix: (config.prefix as string | undefined) || 'events',
      rotateSize: (config.rotateSize as number | undefined) || 10 * 1024 * 1024, // 10MB
      retentionDays: (config.retentionDays as number | undefined) || 30,
      idempotencyKey: (config.idempotencyKey as string | undefined) || 'id',
    };
  }

  /**
   * Initialize sink
   */
  async init(): Promise<void> {
    // Ensure output directory exists
    await fsp.mkdir(this.config.path, { recursive: true });
  }

  /**
   * Write events to file
   */
  async write(events: AnalyticsEventV1[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Filter out already written events (idempotency)
    const newEvents: AnalyticsEventV1[] = [];
    for (const event of events) {
      const eventId = event.id;
      if (!this.writtenEvents.has(eventId)) {
        newEvents.push(event);
        this.writtenEvents.add(eventId);
      }
    }

    if (newEvents.length === 0) {
      return; // All events already written
    }

    // Get or create current file
    let filePath = this.currentFile;
    if (!filePath || this.currentSize >= this.config.rotateSize) {
      filePath = await this.rotateFile();
    }

    // Write events as JSONL
    const lines = newEvents.map((event) => JSON.stringify(event)).join('\n') + '\n';
    const data = Buffer.from(lines, 'utf-8');

    await fsp.appendFile(filePath, data);

    this.currentSize += data.length;
    this.currentFile = filePath;

    // Cleanup old files if needed
    await this.cleanupOldFiles();
  }

  /**
   * Rotate to new file
   */
  private async rotateFile(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
    const filename = `${this.config.prefix}-${timestamp}.jsonl`;
    const filePath = join(this.config.path, filename);

    this.currentFile = filePath;
    this.currentSize = 0;

    // Create empty file
    await fsp.writeFile(filePath, '', 'utf-8');

    return filePath;
  }

  /**
   * Cleanup old files based on retention policy
   */
  async cleanupOldFiles(): Promise<void> {
    const cutoffDate = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    try {
      const files = await fsp.readdir(this.config.path);
      const prefixPattern = new RegExp(`^${this.config.prefix}-.*\\.jsonl$`);

      for (const file of files) {
        if (!prefixPattern.test(file)) {
          continue;
        }

      const filePath = join(this.config.path, file as string);
      const stats = await fsp.stat(filePath);

        if (stats.mtimeMs < cutoffDate) {
          await fsp.unlink(filePath);
        }
      }
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't block writes
      console.warn('[analytics:fs-sink] Failed to cleanup old files:', error);
    }
  }

  /**
   * Get idempotency key for event
   */
  getIdempotencyKey(event: AnalyticsEventV1): string {
    return event.id; // Use event ID as idempotency key
  }

  /**
   * Close sink
   */
  async close(): Promise<void> {
    // No cleanup needed - files are already written
    this.currentFile = null;
    this.currentSize = 0;
  }
}

