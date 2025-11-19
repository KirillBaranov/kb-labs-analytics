/**
 * Analytics Core Class
 * Main orchestrator for event pipeline
 */

import { uuidv7 } from 'uuidv7';
import type { AnalyticsEventV1, EmitResult, RunScope, EventActor, EventContext } from './types';
import { safeValidateEvent } from './schema/event-v1';
import { WalBuffer } from './buffer';
import { DeadLetterQueue } from './dlq';
import { MiddlewarePipeline } from './middleware/index';
import { MetricsCollector } from './metrics';
import { BackpressureController } from './backpressure';
import { EventBatcher } from './batcher';
import { SinkRouter, type SinkAdapter } from './router';
import { loadAnalyticsConfig } from './config';
import type { AnalyticsConfig, SinkConfig } from './types/config';
import { join } from 'node:path';
import { findRepoRoot } from '@kb-labs/core';

export interface AnalyticsOptions {
  cwd?: string;
  config?: Partial<AnalyticsConfig>;
  bufferDir?: string;
  dlqDir?: string;
}

/**
 * Analytics - Main event pipeline orchestrator
 */
export class Analytics {
  private config: AnalyticsConfig;
  private buffer: WalBuffer | null = null;
  private dlq: DeadLetterQueue | null = null;
  private middleware: MiddlewarePipeline | null = null;
  private metrics: MetricsCollector;
  private backpressure: BackpressureController;
  private router: SinkRouter | null = null;
  private batchers: Map<string, EventBatcher> = new Map();
  private initialized = false;
  private bufferDir: string;
  private dlqDir: string;
  private options: AnalyticsOptions;

  constructor(options: AnalyticsOptions = {}) {
    this.options = options;
    // Will be initialized in init()
    this.config = { enabled: true };
    this.metrics = new MetricsCollector();
    this.backpressure = new BackpressureController();
    
    // Set directories (will be resolved in init)
    this.bufferDir = options.bufferDir || '.kb/analytics/buffer';
    this.dlqDir = options.dlqDir || '.kb/analytics/dlq';
  }

  /**
   * Initialize analytics with configuration
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load config
    const cwd = this.options?.cwd || process.cwd();
    const { config, diagnostics } = await loadAnalyticsConfig(cwd, this.options?.config);
    this.config = config;

    // Log diagnostics
    for (const diag of diagnostics) {
      if (diag.level === 'error') {
        console.error(`[analytics] ${diag.code}: ${diag.message}`);
      } else if (diag.level === 'warn') {
        console.warn(`[analytics] ${diag.code}: ${diag.message}`);
      }
    }

    if (!this.config.enabled) {
      // Analytics disabled - no initialization needed
      this.initialized = true;
      return;
    }

    // Resolve directories
    try {
      const repoRoot = await findRepoRoot(cwd);
      this.bufferDir = join(repoRoot, this.bufferDir);
      this.dlqDir = join(repoRoot, this.dlqDir);
    } catch {
      // Not a repo, use cwd
      const { resolve } = await import('node:path');
      this.bufferDir = resolve(cwd, this.bufferDir);
      this.dlqDir = resolve(cwd, this.dlqDir);
    }

    // Initialize components
    this.buffer = new WalBuffer(this.bufferDir, this.config.buffer);
    await this.buffer.init();

    this.dlq = new DeadLetterQueue(this.dlqDir);
    await this.dlq.init();

    this.middleware = new MiddlewarePipeline({
      redact: this.config.middleware?.redact,
      pii: this.config.pii,
      sampling: this.config.middleware?.sampling,
      enrich: this.config.middleware?.enrich,
    });
    await this.middleware.init();

    this.backpressure = new BackpressureController(this.config.backpressure);

    // Initialize sink router
    this.router = new SinkRouter(this.config.sinks || []);
    await this.initializeSinks();

    this.initialized = true;
  }

  /**
   * Initialize sinks and create batchers
   */
  private async initializeSinks(): Promise<void> {
    if (!this.config.sinks || this.config.sinks.length === 0) {
      return; // No sinks configured
    }

    for (const sinkConfig of this.config.sinks) {
      try {
        const adapter = await this.createSinkAdapter(sinkConfig);
        const sinkId = (sinkConfig.id as string | undefined) || sinkConfig.type || `sink_${this.batchers.size}`;
        this.router!.register(sinkId, adapter);

        // Create batcher for sink
        const batcher = new EventBatcher(
          {
            maxSize: 100,
            maxAgeMs: 5000,
          },
          async (events: AnalyticsEventV1[]) => {
            await adapter.write(events);
          }
        );
        this.batchers.set(sinkId as string, batcher);
      } catch (error) {
        console.error(`[analytics] Failed to initialize sink ${sinkConfig.type}:`, error);
        // Continue with other sinks
      }
    }
  }

  /**
   * Create sink adapter from config
   */
  private async createSinkAdapter(sinkConfig: SinkConfig): Promise<SinkAdapter> {
    // Dynamic import of sink adapters
    const adapters = await import('@kb-labs/analytics-adapters');

    switch (sinkConfig.type) {
      case 'fs': {
        const sink = new adapters.FSSink(sinkConfig as any);
        await sink.init();
        return sink;
      }
      case 'http': {
        const sink = new adapters.HTTPSink(sinkConfig as any);
        await sink.init();
        return sink;
      }
      case 's3': {
        const sink = new adapters.S3Sink(sinkConfig as any);
        await sink.init();
        return sink;
      }
      case 'sqlite': {
        const sink = new adapters.SQLiteSink(sinkConfig as any);
        await sink.init();
        return sink;
      }
      default:
        throw new Error(`Unknown sink type: ${sinkConfig.type}`);
    }
  }

  /**
   * Emit an event
   * Never throws - returns result with queued status
   */
  async emit(event: Partial<AnalyticsEventV1>): Promise<EmitResult> {
    // Lazy initialization
    if (!this.initialized) {
      try {
        await this.init();
      } catch (error) {
        // Log but don't throw
        console.error('[analytics] Failed to initialize:', error);
        return {
          queued: false,
          reason: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    if (!this.config.enabled) {
      return { queued: false, reason: 'Analytics disabled' };
    }

    try {
      // Build complete event with required fields
      const now = new Date().toISOString();
      const completeEvent: Partial<AnalyticsEventV1> = {
        id: event.id || uuidv7(),
        schema: 'kb.v1',
        type: event.type || 'unknown',
        ts: event.ts || now,
        ingestTs: event.ingestTs || now,
        source: event.source || {
          product: '@kb-labs/unknown',
          version: '0.0.0',
        },
        runId: event.runId || `run_${Date.now()}`,
        actor: event.actor,
        ctx: event.ctx,
        payload: event.payload,
        hashMeta: event.hashMeta,
      };

      // Validate event
      const validation = safeValidateEvent(completeEvent);
      if (!validation.success) {
        // Log validation errors but don't throw
        console.warn('[analytics] Event validation failed:', validation.error?.errors);
        return {
          queued: false,
          reason: `Validation failed: ${validation.error?.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const validatedEvent = validation.data!;

      // Apply middleware pipeline
      let processedEvent: AnalyticsEventV1 | null;
      if (this.middleware) {
        processedEvent = await this.middleware.process(validatedEvent);
      } else {
        processedEvent = validatedEvent;
      }

      // Check if dropped by sampling
      if (!processedEvent) {
        this.metrics.recordEvent(); // Count dropped events
        return { queued: false, reason: 'Dropped by sampling' };
      }

      // Check backpressure
      if (this.buffer) {
        const queueDepth = this.buffer.getCurrentSegment()?.eventCount || 0;
        this.backpressure.updateQueueDepth(queueDepth);
        this.metrics.updateQueueDepth(queueDepth);

        if (!this.backpressure.shouldAccept()) {
          const state = this.backpressure.getState();
          return {
            queued: false,
            reason: `Backpressure ${state.level}: dropped`,
          };
        }
      }

      // Append to buffer
      if (this.buffer) {
        const appended = await this.buffer.append(processedEvent);
        if (!appended) {
          // Duplicate event
          return { queued: false, reason: 'Duplicate event' };
        }

        this.metrics.recordEvent();

        // Send to sinks via batcher (async, don't wait)
        this.sendToSinks([processedEvent]).catch((error) => {
          console.error('[analytics] Failed to send to sinks:', error);
        });
      }

      return { queued: true };
    } catch (error) {
      // Log error but don't throw
      console.error('[analytics] Failed to emit event:', error);

      // Try to add to DLQ (if we have a valid event structure)
      if (this.dlq && event && 'id' in event && 'type' in event) {
        try {
          // Create minimal valid event for DLQ
          const dlqEvent: AnalyticsEventV1 = {
            id: event.id || uuidv7(),
            schema: 'kb.v1',
            type: event.type || 'unknown',
            ts: event.ts || new Date().toISOString(),
            ingestTs: event.ingestTs || new Date().toISOString(),
            source: event.source || { product: '@kb-labs/unknown', version: '0.0.0' },
            runId: event.runId || `run_${Date.now()}`,
            actor: event.actor,
            ctx: event.ctx,
            payload: event.payload,
          };
          await this.dlq.add(dlqEvent, error instanceof Error ? error : new Error(String(error)));
        } catch (dlqError) {
          console.error('[analytics] Failed to add to DLQ:', dlqError);
        }
      }

      return {
        queued: false,
        reason: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Create a run scope for grouping events
   */
  createRunScope(runId?: string, actor?: EventActor, ctx?: EventContext): RunScope {
    const scopeId = runId || `run_${Date.now()}_${uuidv7().substring(0, 8)}`;

    const emit = async (event: Partial<AnalyticsEventV1>): Promise<EmitResult> => {
      return this.emit({
        ...event,
        runId: scopeId,
        actor: event.actor || actor,
        ctx: { ...ctx, ...event.ctx },
      });
    };

    const finish = async (): Promise<void> => {
      // Optional: emit finish event if needed
      // Can be extended later
    };

    return {
      id: scopeId,
      actor,
      ctx,
      emit,
      finish,
    };
  }

  /**
   * Lightweight task wrapper
   */
  async task(eventType: string, payload: Record<string, unknown>): Promise<EmitResult> {
    return this.emit({
      type: eventType,
      payload,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    return this.metrics.getSnapshot();
  }

  /**
   * Get backpressure state
   */
  getBackpressureState() {
    return this.backpressure.getState();
  }

  /**
   * Send events to sinks via batchers
   */
  private async sendToSinks(events: AnalyticsEventV1[]): Promise<void> {
    if (!this.router || events.length === 0) {
      return;
    }

    // Add to batchers for each sink
    for (const [_sinkId, batcher] of this.batchers.entries()) {
      for (const event of events) {
        await batcher.add(event);
      }
    }

    // Also route directly (for immediate sinks if needed)
    await this.router.route(events);
  }

  /**
   * Force flush buffer to sinks
   */
  async flush(): Promise<void> {
    // Flush all batchers
    for (const batcher of this.batchers.values()) {
      await batcher.flush();
    }

    // Also flush router
    if (this.router) {
      // Router doesn't need explicit flush, but batchers do
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    // Close all batchers
    for (const batcher of this.batchers.values()) {
      await batcher.close();
    }
    this.batchers.clear();

    // Close router and sinks
    if (this.router) {
      await this.router.close();
      this.router = null;
    }

    if (this.buffer) {
      await this.buffer.close();
    }
    if (this.dlq) {
      await this.dlq.close();
    }
    this.initialized = false;
  }
}

