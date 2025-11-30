/**
 * @module @kb-labs/analytics-contracts/adapter
 * Sink adapter interface
 */

import type { AnalyticsEventV1 } from './types';

export interface SinkAdapter {
  write(events: AnalyticsEventV1[]): Promise<void>;
  close(): Promise<void>;
  getIdempotencyKey?(event: AnalyticsEventV1): string;
}
