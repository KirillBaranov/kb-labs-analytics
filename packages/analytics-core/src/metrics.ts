/**
 * Built-in Metrics for Analytics
 * Tracks: ev/s, batch sizes, send latencies, error rates, queue depth, circuit breaker states
 */

export interface MetricsSnapshot {
  eventsPerSecond: number;
  batchSize: {
    p50: number;
    p95: number;
    p99?: number;
  };
  sendLatency: {
    p50: number;
    p95: number;
    p99?: number;
  };
  errorRate: number;
  queueDepth: number;
  circuitBreakerStates: Record<string, 'open' | 'half-open' | 'closed'>;
}

export interface SinkMetrics {
  sinkId: string;
  sendLatency: number[];
  errorCount: number;
  successCount: number;
  circuitBreakerState: 'open' | 'half-open' | 'closed';
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.ceil(sortedValues.length * p) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] || 0;
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private eventTimestamps: number[] = [];
  private batchSizes: number[] = [];
  private sinkMetrics = new Map<string, SinkMetrics>();
  private queueDepth = 0;
  private windowSize = 60000; // 60s window for ev/s calculation
  private maxSamples = 1000; // Keep last N samples

  /**
   * Record event emission
   */
  recordEvent(): void {
    const now = Date.now();
    this.eventTimestamps.push(now);
    // Keep only recent timestamps
    const cutoff = now - this.windowSize;
    this.eventTimestamps = this.eventTimestamps.filter((ts) => ts > cutoff);
  }

  /**
   * Record batch size
   */
  recordBatchSize(size: number): void {
    this.batchSizes.push(size);
    if (this.batchSizes.length > this.maxSamples) {
      this.batchSizes.shift();
    }
  }

  /**
   * Record send latency for a sink
   */
  recordSendLatency(sinkId: string, latencyMs: number): void {
    let metrics = this.sinkMetrics.get(sinkId);
    if (!metrics) {
      metrics = {
        sinkId,
        sendLatency: [],
        errorCount: 0,
        successCount: 0,
        circuitBreakerState: 'closed',
      };
      this.sinkMetrics.set(sinkId, metrics);
    }
    metrics.sendLatency.push(latencyMs);
    if (metrics.sendLatency.length > this.maxSamples) {
      metrics.sendLatency.shift();
    }
  }

  /**
   * Record send error for a sink
   */
  recordError(sinkId: string): void {
    let metrics = this.sinkMetrics.get(sinkId);
    if (!metrics) {
      metrics = {
        sinkId,
        sendLatency: [],
        errorCount: 0,
        successCount: 0,
        circuitBreakerState: 'closed',
      };
      this.sinkMetrics.set(sinkId, metrics);
    }
    metrics.errorCount++;
  }

  /**
   * Record send success for a sink
   */
  recordSuccess(sinkId: string): void {
    let metrics = this.sinkMetrics.get(sinkId);
    if (!metrics) {
      metrics = {
        sinkId,
        sendLatency: [],
        errorCount: 0,
        successCount: 0,
        circuitBreakerState: 'closed',
      };
      this.sinkMetrics.set(sinkId, metrics);
    }
    metrics.successCount++;
  }

  /**
   * Update circuit breaker state for a sink
   */
  updateCircuitBreakerState(sinkId: string, state: 'open' | 'half-open' | 'closed'): void {
    let metrics = this.sinkMetrics.get(sinkId);
    if (!metrics) {
      metrics = {
        sinkId,
        sendLatency: [],
        errorCount: 0,
        successCount: 0,
        circuitBreakerState: state,
      };
      this.sinkMetrics.set(sinkId, metrics);
    }
    metrics.circuitBreakerState = state;
  }

  /**
   * Update queue depth
   */
  updateQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  /**
   * Calculate events per second
   */
  private calculateEventsPerSecond(): number {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const recent = this.eventTimestamps.filter((ts) => ts > cutoff);
    return recent.length / (this.windowSize / 1000); // events per second
  }

  /**
   * Calculate percentile from batch sizes
   */
  private calculateBatchSizePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.batchSizes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    const sorted = [...this.batchSizes].sort((a, b) => a - b);
    return {
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    };
  }

  /**
   * Calculate send latency percentiles across all sinks
   */
  private calculateSendLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    const allLatencies: number[] = [];
    for (const metrics of this.sinkMetrics.values()) {
      allLatencies.push(...metrics.sendLatency);
    }
    if (allLatencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    const sorted = [...allLatencies].sort((a, b) => a - b);
    return {
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    };
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    let totalErrors = 0;
    let totalRequests = 0;
    for (const metrics of this.sinkMetrics.values()) {
      totalErrors += metrics.errorCount;
      totalRequests += metrics.errorCount + metrics.successCount;
    }
    if (totalRequests === 0) {
      return 0;
    }
    return totalErrors / totalRequests;
  }

  /**
   * Get circuit breaker states
   */
  private getCircuitBreakerStates(): Record<string, 'open' | 'half-open' | 'closed'> {
    const states: Record<string, 'open' | 'half-open' | 'closed'> = {};
    for (const [sinkId, metrics] of this.sinkMetrics.entries()) {
      states[sinkId] = metrics.circuitBreakerState;
    }
    return states;
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    return {
      eventsPerSecond: this.calculateEventsPerSecond(),
      batchSize: this.calculateBatchSizePercentiles(),
      sendLatency: this.calculateSendLatencyPercentiles(),
      errorRate: this.calculateErrorRate(),
      queueDepth: this.queueDepth,
      circuitBreakerStates: this.getCircuitBreakerStates(),
    };
  }

  /**
   * Get per-sink metrics
   */
  getSinkMetrics(sinkId: string): SinkMetrics | undefined {
    return this.sinkMetrics.get(sinkId);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.eventTimestamps = [];
    this.batchSizes = [];
    this.sinkMetrics.clear();
    this.queueDepth = 0;
  }
}

