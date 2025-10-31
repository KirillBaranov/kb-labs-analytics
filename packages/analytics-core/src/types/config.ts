/**
 * Configuration types for analytics
 */

import type { BufferConfig } from '../buffer';

export type { BufferConfig };

export interface BackpressureConfig {
  high?: number; // default 20000
  critical?: number; // default 50000
  sampling?: {
    high?: number; // default 0.5
    critical?: number; // default 0.1
  };
}

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
  [key: string]: unknown; // sink-specific config
  retry?: RetryConfig;
  breaker?: CircuitBreakerConfig;
}

export interface PIIHashConfig {
  enabled?: boolean;
  saltEnv?: string; // default "KB_ANALYTICS_SALT"
  saltId?: string;
  rotateAfterDays?: number;
}

export interface PIIConfig {
  hash?: PIIHashConfig;
  fields?: string[]; // JSON paths like "actor.id", "ctx.repo"
}

export interface RetentionConfig {
  wal?: { days: number };
  out?: { days: number };
}

export interface MiddlewareConfig {
  redact?: { keys?: string[] };
  sampling?: { default?: number; byEvent?: Record<string, number> };
  enrich?: { git?: boolean; host?: boolean; cli?: boolean; workspace?: boolean };
}

export interface AnalyticsConfig {
  configVersion?: number; // default 1
  enabled?: boolean; // default true
  buffer?: BufferConfig;
  backpressure?: BackpressureConfig;
  sinks?: SinkConfig[];
  pii?: PIIConfig;
  middleware?: MiddlewareConfig;
  retention?: RetentionConfig;
}

