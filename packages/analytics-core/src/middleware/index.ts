/**
 * Middleware Pipeline
 * Order: redact → hashPII → sample → enrich
 */

import type { AnalyticsEventV1 } from '../types';
import type { PIIConfig } from '../types/config';
import { RedactMiddleware, type RedactConfig } from './redact';
import { PIIHashMiddleware } from './hash-pii';
import { SampleMiddleware, type SamplingConfig } from './sample';
import { EnrichMiddleware, type EnrichConfig } from './enrich';

export interface MiddlewareConfig {
  redact?: RedactConfig;
  pii?: PIIConfig;
  sampling?: SamplingConfig;
  enrich?: EnrichConfig;
}

/**
 * Middleware Pipeline
 * Processes events in strict order: redact → hashPII → sample → enrich
 */
export class MiddlewarePipeline {
  private redact: RedactMiddleware;
  private hashPII: PIIHashMiddleware;
  private sample: SampleMiddleware;
  private enrich: EnrichMiddleware;

  constructor(config: MiddlewareConfig = {}) {
    this.redact = new RedactMiddleware(config.redact);
    this.hashPII = new PIIHashMiddleware(config.pii || {});
    this.sample = new SampleMiddleware(config.sampling);
    this.enrich = new EnrichMiddleware(config.enrich);
  }

  /**
   * Initialize middleware (async setup)
   */
  async init(): Promise<void> {
    await this.enrich.init();
  }

  /**
   * Process event through pipeline
   * Returns processed event or null if dropped by sampling
   */
  async process(event: AnalyticsEventV1): Promise<AnalyticsEventV1 | null> {
    // Step 1: Redact sensitive keys
    let processed = this.redact.process(event);

    // Step 2: Hash PII fields
    processed = this.hashPII.process(processed);

    // Step 3: Sample (may drop event)
    const sampled = this.sample.process(processed);
    if (!sampled) {
      return null; // Event dropped by sampling
    }
    processed = sampled;

    // Step 4: Enrich with context
    processed = await this.enrich.process(processed);

    return processed;
  }

  /**
   * Synchronous version (without async enrichment like git)
   */
  processSync(event: AnalyticsEventV1): AnalyticsEventV1 | null {
    // Step 1: Redact
    let processed = this.redact.process(event);

    // Step 2: Hash PII
    processed = this.hashPII.process(processed);

    // Step 3: Sample
    const sampled = this.sample.process(processed);
    if (!sampled) {
      return null;
    }
    processed = sampled;

    // Step 4: Enrich (sync version)
    processed = this.enrich.processSync(processed);

    return processed;
  }
}

export { RedactMiddleware, SampleMiddleware, EnrichMiddleware, PIIHashMiddleware };
export type { RedactConfig, SamplingConfig, EnrichConfig };

