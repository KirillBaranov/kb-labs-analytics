/**
 * Redact Middleware - Remove sensitive keys from event data
 */

import type { AnalyticsEventV1 } from '../types';

export interface RedactConfig {
  keys?: string[]; // default: ['token', 'apiKey', 'authorization', 'password']
}

const DEFAULT_REDACT_KEYS = [
  'token',
  'apiKey',
  'authorization',
  'password',
  'secret',
  'privateKey',
  'accessToken',
  'refreshToken',
] as const;

/**
 * Redact sensitive keys from object recursively
 */
function redactObject(obj: unknown, keys: Set<string>, path: string[] = []): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => redactObject(item, keys, path.concat(String(index))));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      if (keys.has(keyLower)) {
        // Redact: replace with masked value
        result[key] = '****';
      } else if (typeof value === 'object') {
        // Recurse into nested objects
        result[key] = redactObject(value, keys, path.concat(key));
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Redact Middleware
 */
export class RedactMiddleware {
  private keys: Set<string>;

  constructor(config: RedactConfig = {}) {
    const keysToRedact = config.keys || DEFAULT_REDACT_KEYS;
    this.keys = new Set(keysToRedact.map((k) => k.toLowerCase()));
  }

  /**
   * Apply redaction to event
   */
  process(event: AnalyticsEventV1): AnalyticsEventV1 {
    // Create a deep copy to avoid mutating original
    const processed = JSON.parse(JSON.stringify(event)) as AnalyticsEventV1;

    // Redact from payload if present
    if (processed.payload && typeof processed.payload === 'object') {
      processed.payload = redactObject(processed.payload, this.keys, ['payload']) as unknown;
    }

    // Redact from ctx if present
    if (processed.ctx && typeof processed.ctx === 'object') {
      processed.ctx = redactObject(processed.ctx, this.keys, ['ctx']) as typeof processed.ctx;
    }

    // Redact from actor if present
    if (processed.actor && typeof processed.actor === 'object') {
      processed.actor = redactObject(processed.actor, this.keys, ['actor']) as typeof processed.actor;
    }

    return processed;
  }
}

