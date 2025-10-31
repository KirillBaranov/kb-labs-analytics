/**
 * Sampling Middleware - Filter events based on sampling rates
 */

import type { AnalyticsEventV1 } from '../types';

export interface SamplingConfig {
  default?: number; // default: 1.0 (100%)
  byEvent?: Record<string, number>; // per-event sampling rates
}

/**
 * Sampling Middleware
 */
export class SampleMiddleware {
  private defaultRate: number;
  private eventRates: Map<string, number>;

  constructor(config: SamplingConfig = {}) {
    this.defaultRate = config.default ?? 1.0;
    this.eventRates = new Map(Object.entries(config.byEvent || {}));
  }

  /**
   * Check if event should be sampled (included)
   * Returns true if event should be included, false to drop
   */
  shouldInclude(event: AnalyticsEventV1): boolean {
    const rate = this.eventRates.get(event.type) ?? this.defaultRate;

    // If rate is 1.0, always include
    if (rate >= 1.0) {
      return true;
    }

    // If rate is 0.0, always exclude
    if (rate <= 0.0) {
      return false;
    }

    // Random sampling: Math.random() < rate
    return Math.random() < rate;
  }

  /**
   * Process event - returns event if sampled, null if dropped
   */
  process(event: AnalyticsEventV1): AnalyticsEventV1 | null {
    if (this.shouldInclude(event)) {
      return event;
    }
    return null; // Drop event
  }
}

