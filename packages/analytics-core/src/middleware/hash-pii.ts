/**
 * PII Hashing Middleware
 * HMAC-SHA256 with salt from ENV/KMS, salt rotation support, configurable fields
 */

import { createHmac } from 'node:crypto';
import type { AnalyticsEventV1 } from '../types';
import type { PIIConfig } from '../types/config';

export interface PIIHashOptions {
  enabled: boolean;
  saltEnv?: string; // default "KB_ANALYTICS_SALT"
  saltId?: string;
  rotateAfterDays?: number;
  fields: string[]; // JSON paths like "actor.id", "ctx.repo"
  pepper?: string; // optional pepper from ENV
}

/**
 * Get salt from environment or return undefined if not set
 */
function getSaltFromEnv(saltEnv: string = 'KB_ANALYTICS_SALT'): string | undefined {
  return process.env[saltEnv];
}

/**
 * Hash a value using HMAC-SHA256
 */
function hashValue(value: string, salt: string, pepper?: string): string {
  const input = pepper ? `${salt}:${pepper}:${value}` : `${salt}:${value}`;
  return createHmac('sha256', salt).update(input).digest('hex');
}

/**
 * Set value at JSON path
 */
function setValueAtPath(obj: any, path: string, value: unknown): void {
  const parts = path.split('.');
  if (parts.length === 0) {
    return;
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) {
      return;
    }
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Get value at JSON path
 */
function getValueAtPath(obj: any, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Check if salt needs rotation
 */
function shouldRotateSalt(saltId: string | undefined, rotateAfterDays: number | undefined): boolean {
  if (!saltId || !rotateAfterDays) {
    return false;
  }

  // Extract date from saltId (format: "default-2025-10")
  const dateMatch = saltId.match(/(\d{4}-\d{2})$/);
  if (!dateMatch) {
    return false;
  }

  const saltDate = new Date(dateMatch[1] + '-01');
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - saltDate.getTime()) / (1000 * 60 * 60 * 24));

  return daysDiff >= rotateAfterDays;
}

/**
 * Generate new saltId
 */
function generateSaltId(baseName: string = 'default'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${baseName}-${year}-${month}`;
}

/**
 * PII Hashing Middleware
 */
export class PIIHashMiddleware {
  private options: PIIHashOptions;
  private salt: string | undefined;
  private currentSaltId: string;

  constructor(config: PIIConfig) {
    const hashConfig = config.hash || {};
    this.options = {
      enabled: hashConfig.enabled ?? false,
      saltEnv: hashConfig.saltEnv ?? 'KB_ANALYTICS_SALT',
      saltId: hashConfig.saltId,
      rotateAfterDays: hashConfig.rotateAfterDays,
      fields: config.fields || [],
      pepper: process.env.KB_ANALYTICS_PEPPER,
    };

    // Load salt from environment
    this.salt = getSaltFromEnv(this.options.saltEnv);

    // Determine current saltId
    if (this.shouldRotate()) {
      this.currentSaltId = generateSaltId();
    } else {
      this.currentSaltId = this.options.saltId || generateSaltId();
    }
  }

  /**
   * Check if salt should be rotated
   */
  shouldRotate(): boolean {
    if (!this.options.enabled || !this.salt) {
      return false;
    }
    return shouldRotateSalt(this.options.saltId, this.options.rotateAfterDays);
  }

  /**
   * Get current saltId
   */
  getSaltId(): string {
    return this.currentSaltId;
  }

  /**
   * Check if PII hashing is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled && !!this.salt;
  }

  /**
   * Apply PII hashing to event
   */
  process(event: AnalyticsEventV1): AnalyticsEventV1 {
    if (!this.isEnabled()) {
      return event;
    }

    // Create a deep copy to avoid mutating original
    const processed = JSON.parse(JSON.stringify(event)) as AnalyticsEventV1;

    // Hash each configured field
    for (const fieldPath of this.options.fields) {
      const value = getValueAtPath(processed, fieldPath);
      if (value !== undefined && value !== null && typeof value === 'string' && value.length > 0) {
        const hashed = hashValue(value, this.salt!, this.options.pepper);
        setValueAtPath(processed, fieldPath, hashed);
      }
    }

    // Add hashMeta if not present
    if (!processed.hashMeta) {
      processed.hashMeta = {
        algo: 'hmac-sha256',
        saltId: this.currentSaltId,
      };
    } else {
      processed.hashMeta.saltId = this.currentSaltId;
    }

    return processed;
  }

  /**
   * Check if a value is already hashed (heuristic: hex string of fixed length)
   */
  static isHashed(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    // SHA256 produces 64 hex characters
    return /^[a-f0-9]{64}$/i.test(value);
  }
}

