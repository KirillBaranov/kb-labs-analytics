/**
 * Sink Router - Route events to configured sinks
 */

import type { AnalyticsEventV1 } from './types';
import type { SinkConfig } from './types/config';

export interface SinkAdapter {
  write(events: AnalyticsEventV1[]): Promise<void>;
  close(): Promise<void>;
  getIdempotencyKey?(event: AnalyticsEventV1): string;
}

/**
 * Sink Router - Route events to multiple sinks
 */
export class SinkRouter {
  private adapters: Map<string, SinkAdapter> = new Map();
  private configs: SinkConfig[] = [];

  constructor(sinks: SinkConfig[] = []) {
    this.configs = sinks;
  }

  /**
   * Register sink adapter
   */
  register(id: string, adapter: SinkAdapter): void {
    this.adapters.set(id, adapter);
  }

  /**
   * Route events to all registered sinks
   */
  async route(events: AnalyticsEventV1[]): Promise<void> {
    if (events.length === 0 || this.adapters.size === 0) {
      return;
    }

    // Send to all sinks in parallel
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.write(events);
      } catch (error) {
        // Log error but don't throw - sinks should handle their own errors
        console.error('[analytics:router] Sink failed:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Close all sinks
   */
  async close(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.close();
      } catch (error) {
        console.error('[analytics:router] Failed to close sink:', error);
      }
    });

    await Promise.allSettled(promises);
    this.adapters.clear();
  }

  /**
   * Get registered sinks
   */
  getSinks(): string[] {
    return Array.from(this.adapters.keys());
  }
}

