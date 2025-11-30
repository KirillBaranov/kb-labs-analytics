/**
 * @module @kb-labs/analytics-contracts
 * Shared type definitions and contracts for KB Labs Analytics
 * 
 * This package breaks the circular dependency between:
 * - @kb-labs/analytics-core
 * - @kb-labs/analytics-adapters
 */

// Event types
export type {
  ActorType,
  EventActor,
  EventContext,
  EventSource,
  HashMeta,
  AnalyticsEventV1,
  EmitResult,
} from './types';

// Configuration
export type {
  RetryConfig,
  CircuitBreakerConfig,
  SinkConfig,
} from './config';

// Adapter interface
export type { SinkAdapter } from './adapter';
