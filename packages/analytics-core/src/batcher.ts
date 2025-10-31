/**
 * Event Batcher - Batch events before sending to sinks
 */

import type { AnalyticsEventV1 } from './types';
import type { SinkConfig } from './types/config';

export interface BatcherConfig {
  maxSize?: number; // Max batch size (default: 100)
  maxAgeMs?: number; // Max age before flushing (default: 5000)
  flushOnClose?: boolean; // Flush on close (default: true)
}

/**
 * Event Batcher - Batch events for efficient sink writes
 */
export class EventBatcher {
  private config: Required<BatcherConfig>;
  private buffer: AnalyticsEventV1[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private onFlush: (events: AnalyticsEventV1[]) => Promise<void>;

  constructor(
    config: BatcherConfig,
    onFlush: (events: AnalyticsEventV1[]) => Promise<void>
  ) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      maxAgeMs: config.maxAgeMs ?? 5000,
      flushOnClose: config.flushOnClose ?? true,
    };
    this.onFlush = onFlush;
  }

  /**
   * Add event to batch
   */
  async add(event: AnalyticsEventV1): Promise<void> {
    this.buffer.push(event);

    // Flush if batch is full
    if (this.buffer.length >= this.config.maxSize) {
      await this.flush();
      return;
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimer && this.buffer.length > 0) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch((error) => {
          console.error('[analytics:batcher] Failed to flush:', error);
        });
      }, this.config.maxAgeMs);
    }
  }

  /**
   * Flush current batch
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Get current batch
    const batch = [...this.buffer];
    this.buffer = [];

    // Send to sink
    try {
      await this.onFlush(batch);
    } catch (error) {
      // On error, put events back in buffer (or send to DLQ)
      console.error('[analytics:batcher] Failed to send batch:', error);
      // For now, just log error - in production would send to DLQ
    }
  }

  /**
   * Close batcher (flush remaining events)
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.config.flushOnClose && this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Get current batch size
   */
  getSize(): number {
    return this.buffer.length;
  }
}

