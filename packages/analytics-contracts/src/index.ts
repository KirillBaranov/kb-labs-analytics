/**
 * @module @kb-labs/analytics-contracts
 * Shared type definitions and contracts for KB Labs Analytics
 *
 * This package provides types, schemas, and contracts for analytics without
 * any implementation dependencies (no core, no SDK).
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

// Zod schemas and validation
export {
  AnalyticsEventV1Schema,
  validateEvent,
  safeValidateEvent,
  validateEventDetailed,
  formatValidationErrors,
} from './schemas';

// Configuration
export type {
  RetryConfig,
  CircuitBreakerConfig,
  SinkConfig,
} from './config';

// Adapter interface
export type { SinkAdapter } from './adapter';

// Plugin contracts manifest
export {
  pluginContractsManifest,
  type PluginArtifactIds,
  type PluginCommandIds,
  type PluginRouteIds,
} from './contract';
