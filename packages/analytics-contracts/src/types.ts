/**
 * @module @kb-labs/analytics-contracts/types
 * Core event types for KB Labs Analytics
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

export interface AnalyticsEventV1 {
  id: string;
  schema: 'kb.v1';
  type: string;
  ts: string;
  ingestTs: string;
  source: EventSource;
  runId: string;
  actor?: EventActor;
  ctx?: EventContext;
  payload?: unknown;
  hashMeta?: HashMeta;
}

export interface EmitResult {
  queued: boolean;
  reason?: string;
}
