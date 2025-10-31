/**
 * Event types for AnalyticsEventV1
 */

export type ActorType = 'user' | 'agent' | 'ci';

export interface EventActor {
  type: ActorType;
  id?: string;
  name?: string;
}

export interface EventContext {
  repo?: string;
  branch?: string;
  commit?: string;
  workspace?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface EventSource {
  product: string;
  version: string;
}

export interface HashMeta {
  algo: 'hmac-sha256';
  saltId: string;
}

/**
 * AnalyticsEventV1 - Main event structure
 * All fields except optional ones are required
 */
export interface AnalyticsEventV1 {
  id: string; // uuidv7
  schema: 'kb.v1';
  type: string; // e.g. "audit.run.finished"
  ts: string; // ISO 8601 UTC timestamp
  ingestTs: string; // ISO 8601 UTC timestamp (set by SDK)
  source: EventSource;
  runId: string;
  actor?: EventActor;
  ctx?: EventContext;
  payload?: unknown;
  hashMeta?: HashMeta;
}

/**
 * Result of emit() call - never throws
 */
export interface EmitResult {
  queued: boolean;
  reason?: string;
}

/**
 * Run scope for grouping events
 */
export interface RunScope {
  id: string;
  actor?: EventActor;
  ctx?: EventContext;
  emit(event: Partial<AnalyticsEventV1>): Promise<EmitResult>;
  finish(): Promise<void>;
}

