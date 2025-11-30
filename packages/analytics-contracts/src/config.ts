/**
 * @module @kb-labs/analytics-contracts/config
 * Configuration interfaces for sinks and analytics
 */

export interface RetryConfig {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
  jitter?: number;
}

export interface CircuitBreakerConfig {
  failures?: number;
  windowMs?: number;
  halfOpenEveryMs?: number;
}

export interface SinkConfig {
  type: 'fs' | 'http' | 's3' | 'sqlite';
  [key: string]: unknown;
  retry?: RetryConfig;
  breaker?: CircuitBreakerConfig;
}
