/**
 * Backpressure Control
 * Staged sampling and pause emit() with drop counters
 */

import type { BackpressureConfig } from './types/config';

export interface BackpressureState {
  level: 'normal' | 'high' | 'critical';
  samplingRate: number;
  shouldPause: boolean;
  dropCount: number;
}

const DEFAULT_CONFIG: Required<BackpressureConfig> = {
  high: 20000,
  critical: 50000,
  sampling: {
    high: 0.5,
    critical: 0.1,
  },
};

/**
 * Backpressure Controller
 */
export class BackpressureController {
  private config: Required<BackpressureConfig>;
  private currentQueueDepth = 0;
  private dropCount = 0;
  private pauseCount = 0;

  constructor(config: BackpressureConfig = {}) {
    const samplingHigh = config.sampling?.high ?? DEFAULT_CONFIG.sampling.high;
    const samplingCritical = config.sampling?.critical ?? DEFAULT_CONFIG.sampling.critical;
    
    this.config = {
      high: config.high ?? DEFAULT_CONFIG.high,
      critical: config.critical ?? DEFAULT_CONFIG.critical,
      sampling: {
        high: samplingHigh,
        critical: samplingCritical,
      },
    };
  }

  /**
   * Update current queue depth
   */
  updateQueueDepth(depth: number): void {
    this.currentQueueDepth = depth;
  }

  /**
   * Get current backpressure state
   */
  getState(): BackpressureState {
    let level: 'normal' | 'high' | 'critical' = 'normal';
    let samplingRate = 1.0;
    let shouldPause = false;

    if (this.currentQueueDepth >= this.config.critical) {
      level = 'critical';
      samplingRate = this.config.sampling.critical ?? 0.1;
      shouldPause = true;
    } else if (this.currentQueueDepth >= this.config.high) {
      level = 'high';
      samplingRate = this.config.sampling.high ?? 0.5;
      shouldPause = false; // Don't pause at high, just reduce sampling
    }

    return {
      level,
      samplingRate,
      shouldPause,
      dropCount: this.dropCount,
    };
  }

  /**
   * Check if event should be accepted (based on sampling)
   */
  shouldAccept(): boolean {
    const state = this.getState();

    // If paused, reject all
    if (state.shouldPause) {
      this.dropCount++;
      this.pauseCount++;
      return false;
    }

    // Apply sampling
    if (state.samplingRate < 1.0) {
      const accept = Math.random() < state.samplingRate;
      if (!accept) {
        this.dropCount++;
      }
      return accept;
    }

    return true; // Normal level, accept all
  }

  /**
   * Get drop statistics
   */
  getStats(): { dropCount: number; pauseCount: number; queueDepth: number } {
    return {
      dropCount: this.dropCount,
      pauseCount: this.pauseCount,
      queueDepth: this.currentQueueDepth,
    };
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.dropCount = 0;
    this.pauseCount = 0;
  }
}

