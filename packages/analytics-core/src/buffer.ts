/**
 * WAL Buffer - Write-Ahead Log with append-only segments
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import type { AnalyticsEventV1 } from './types';

export interface SegmentInfo {
  path: string;
  indexPath: string;
  offset: number;
  eventCount: number;
  firstEventTs?: number;
  lastEventTs?: number;
}

export interface BufferConfig {
  segmentBytes?: number; // default 1048576 (1MB)
  segmentMaxAgeMs?: number; // default 60000 (60s)
  fsyncOnRotate?: boolean; // default true
}

interface IndexEntry {
  eventId: string;
  offset: number;
  size: number;
}

/**
 * In-memory deduplication cache using LFU-like approach
 */
class DeduplicationCache {
  private seen = new Set<string>();
  private accessCount = new Map<string, number>();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  add(id: string): void {
    if (this.seen.has(id)) {
      const count = this.accessCount.get(id) || 0;
      this.accessCount.set(id, count + 1);
      return;
    }

    // Evict if at capacity (simple FIFO, can be improved with LFU)
    if (this.seen.size >= this.maxSize) {
      // Remove oldest entries
      const toRemove = Math.floor(this.maxSize * 0.1); // Remove 10%
      const entries = Array.from(this.seen);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        const entry = entries[i];
        if (entry !== undefined) {
          this.seen.delete(entry);
          this.accessCount.delete(entry);
        }
      }
    }

    this.seen.add(id);
    this.accessCount.set(id, 1);
  }

  clear(): void {
    this.seen.clear();
    this.accessCount.clear();
  }

  size(): number {
    return this.seen.size;
  }
}

/**
 * WAL Buffer with append-only segments, index file, and deduplication
 */
export class WalBuffer {
  private config: Required<BufferConfig>;
  private bufferDir: string;
  private currentSegment: SegmentInfo | null = null;
  private dedupCache: DeduplicationCache;

  constructor(bufferDir: string, config: BufferConfig = {}) {
    this.bufferDir = bufferDir;
    this.config = {
      segmentBytes: config.segmentBytes ?? 1048576, // 1MB
      segmentMaxAgeMs: config.segmentMaxAgeMs ?? 60000, // 60s
      fsyncOnRotate: config.fsyncOnRotate ?? true,
    };
    this.dedupCache = new DeduplicationCache(10000);
  }

  /**
   * Initialize buffer directory
   */
  async init(): Promise<void> {
    await fsp.mkdir(this.bufferDir, { recursive: true });
  }

  /**
   * Append event to current segment (with deduplication)
   * Returns true if event was appended, false if duplicate
   */
  async append(event: AnalyticsEventV1): Promise<boolean> {
    // Check deduplication
    if (this.dedupCache.has(event.id)) {
      return false; // Duplicate
    }

    // Ensure we have a current segment
    await this.ensureSegment();

    if (!this.currentSegment) {
      throw new Error('Failed to create segment');
    }

    // Serialize event to JSONL line
    const line = JSON.stringify(event) + '\n';
    const lineBuffer = Buffer.from(line, 'utf-8');

    // Check if we need to rotate
    if (
      this.currentSegment.offset + lineBuffer.length > this.config.segmentBytes ||
      (this.currentSegment.firstEventTs &&
        Date.now() - this.currentSegment.firstEventTs > this.config.segmentMaxAgeMs)
    ) {
      await this.rotate();
      await this.ensureSegment();
      if (!this.currentSegment) {
        throw new Error('Failed to create segment after rotate');
      }
    }

    // Write to file
    const fd = await fsp.open(this.currentSegment.path, 'a');
    try {
      await fd.appendFile(lineBuffer);
      if (this.config.fsyncOnRotate && this.shouldRotateAfterWrite()) {
        await fd.sync();
      }
    } finally {
      await fd.close();
    }

    // Update index
    await this.appendToIndex(event.id, this.currentSegment.offset, lineBuffer.length);

    // Update segment info
    this.currentSegment.offset += lineBuffer.length;
    this.currentSegment.eventCount++;
    if (!this.currentSegment.firstEventTs) {
      this.currentSegment.firstEventTs = Date.now();
    }
    this.currentSegment.lastEventTs = Date.now();

    // Add to deduplication cache
    this.dedupCache.add(event.id);

    return true;
  }

  /**
   * Ensure current segment exists
   */
  private async ensureSegment(): Promise<void> {
    if (this.currentSegment) {
      return;
    }

    const timestamp = Date.now();
    const segmentId = `segment-${timestamp}`;
    const segmentPath = join(this.bufferDir, `${segmentId}.jsonl`);
    const indexPath = join(this.bufferDir, `${segmentId}.idx`);

    this.currentSegment = {
      path: segmentPath,
      indexPath,
      offset: 0,
      eventCount: 0,
      firstEventTs: timestamp,
    };

    // Ensure files exist (empty)
    await fsp.writeFile(segmentPath, '', 'utf-8');
    await fsp.writeFile(indexPath, JSON.stringify([]), 'utf-8');
  }

  /**
   * Rotate current segment
   */
  private async rotate(): Promise<void> {
    if (!this.currentSegment) {
      return;
    }

    // Final sync if configured
    if (this.config.fsyncOnRotate) {
      const fd = await fsp.open(this.currentSegment.path, 'r+');
      try {
        await fd.sync();
      } finally {
        await fd.close();
      }
    }

    // Clear current segment
    this.currentSegment = null;
  }

  /**
   * Append to index file
   */
  private async appendToIndex(eventId: string, offset: number, size: number): Promise<void> {
    if (!this.currentSegment) {
      return;
    }

    const index: IndexEntry[] = JSON.parse(
      await fsp.readFile(this.currentSegment.indexPath, 'utf-8')
    );

    index.push({
      eventId,
      offset,
      size,
    });

    await fsp.writeFile(this.currentSegment.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * Check if we should rotate after this write
   */
  private shouldRotateAfterWrite(): boolean {
    if (!this.currentSegment) {
      return false;
    }
    const sizeExceeded = this.currentSegment.offset >= this.config.segmentBytes;
    const ageExceeded =
      this.currentSegment.firstEventTs !== undefined &&
      Date.now() - this.currentSegment.firstEventTs > this.config.segmentMaxAgeMs;
    return sizeExceeded || ageExceeded;
  }

  /**
   * Get current segment info
   */
  getCurrentSegment(): SegmentInfo | null {
    return this.currentSegment ? { ...this.currentSegment } : null;
  }

  /**
   * Get deduplication cache stats
   */
  getDedupStats(): { size: number } {
    return {
      size: this.dedupCache.size(),
    };
  }

  /**
   * List all segments
   */
  async listSegments(): Promise<string[]> {
    const files = await fsp.readdir(this.bufferDir);
    return files
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => join(this.bufferDir, f))
      .sort();
  }

  /**
   * Read segment events
   */
  async readSegment(segmentPath: string): Promise<AnalyticsEventV1[]> {
    const content = await fsp.readFile(segmentPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line) as AnalyticsEventV1);
  }

  /**
   * Clear deduplication cache
   */
  clearDedupCache(): void {
    this.dedupCache.clear();
  }

  /**
   * Close buffer
   */
  async close(): Promise<void> {
    await this.rotate();
  }
}

