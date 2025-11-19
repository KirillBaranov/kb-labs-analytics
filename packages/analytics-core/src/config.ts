/**
 * Configuration loading for analytics
 * Uses @kb-labs/core-bundle for unified configuration system
 */

import { loadBundle } from '@kb-labs/core-bundle';
import { resolveConfig, type Diagnostic } from '@kb-labs/core';
import type { AnalyticsConfig } from './types/config';

const DEFAULT_CONFIG: AnalyticsConfig = {
  configVersion: 1,
  enabled: true,
  buffer: {
    segmentBytes: 1048576, // 1MB
    segmentMaxAgeMs: 60000, // 60s
    fsyncOnRotate: true,
  },
  backpressure: {
    high: 20000,
    critical: 50000,
    sampling: {
      high: 0.5,
      critical: 0.1,
    },
  },
  sinks: [],
  pii: {
    hash: {
      enabled: false,
      saltEnv: 'KB_ANALYTICS_SALT',
      saltId: undefined,
      rotateAfterDays: undefined,
    },
    fields: [],
  },
  retention: {
    wal: { days: 7 },
    out: { days: 30 },
  },
};

/**
 * Map environment variables to config overrides
 */
function envMapper(env: NodeJS.ProcessEnv): Partial<AnalyticsConfig> {
  const overrides: Partial<AnalyticsConfig> = {};

  // KB_ANALYTICS_ENABLED
  if (env.KB_ANALYTICS_ENABLED !== undefined) {
    overrides.enabled = env.KB_ANALYTICS_ENABLED === '1' || env.KB_ANALYTICS_ENABLED === 'true';
  }

  // KB_ANALYTICS_BUFFER_SEGMENT_BYTES
  if (env.KB_ANALYTICS_BUFFER_SEGMENT_BYTES) {
    const bytes = Number.parseInt(env.KB_ANALYTICS_BUFFER_SEGMENT_BYTES, 10);
    if (!Number.isNaN(bytes)) {
      overrides.buffer = { ...overrides.buffer, segmentBytes: bytes };
    }
  }

  // KB_ANALYTICS_BUFFER_SEGMENT_MAX_AGE_MS
  if (env.KB_ANALYTICS_BUFFER_SEGMENT_MAX_AGE_MS) {
    const ms = Number.parseInt(env.KB_ANALYTICS_BUFFER_SEGMENT_MAX_AGE_MS, 10);
    if (!Number.isNaN(ms)) {
      overrides.buffer = { ...overrides.buffer, segmentMaxAgeMs: ms };
    }
  }

  // KB_ANALYTICS_BACKPRESSURE_HIGH
  if (env.KB_ANALYTICS_BACKPRESSURE_HIGH) {
    const high = Number.parseInt(env.KB_ANALYTICS_BACKPRESSURE_HIGH, 10);
    if (!Number.isNaN(high)) {
      overrides.backpressure = { ...overrides.backpressure, high };
    }
  }

  // KB_ANALYTICS_BACKPRESSURE_CRITICAL
  if (env.KB_ANALYTICS_BACKPRESSURE_CRITICAL) {
    const critical = Number.parseInt(env.KB_ANALYTICS_BACKPRESSURE_CRITICAL, 10);
    if (!Number.isNaN(critical)) {
      overrides.backpressure = { ...overrides.backpressure, critical };
    }
  }

  // KB_ANALYTICS_PII_ENABLED
  if (env.KB_ANALYTICS_PII_ENABLED !== undefined) {
    const enabled = env.KB_ANALYTICS_PII_ENABLED === '1' || env.KB_ANALYTICS_PII_ENABLED === 'true';
    overrides.pii = {
      ...overrides.pii,
      hash: { ...overrides.pii?.hash, enabled },
    };
  }

  // KB_ANALYTICS_PII_SALT_ID
  if (env.KB_ANALYTICS_PII_SALT_ID) {
    overrides.pii = {
      ...overrides.pii,
      hash: { ...overrides.pii?.hash, saltId: env.KB_ANALYTICS_PII_SALT_ID },
    };
  }

  return overrides;
}

/**
 * Validate config
 */
function validateConfig(cfg: AnalyticsConfig): { ok: boolean; diagnostics?: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  // Check configVersion
  if (cfg.configVersion && cfg.configVersion > 1) {
    diagnostics.push({
      level: 'warn',
      code: 'CONFIG_VERSION_UNSUPPORTED',
      message: `Config version ${cfg.configVersion} is not fully supported. Using version 1.`,
    });
  }

  // Check buffer config
  if (cfg.buffer) {
    if (cfg.buffer.segmentBytes && cfg.buffer.segmentBytes < 1024) {
      diagnostics.push({
        level: 'warn',
        code: 'BUFFER_SEGMENT_TOO_SMALL',
        message: 'Buffer segment size is too small. Recommended minimum: 1024 bytes.',
      });
    }
  }

  // Check backpressure config
  if (cfg.backpressure) {
    if (cfg.backpressure.high && cfg.backpressure.critical && cfg.backpressure.high >= cfg.backpressure.critical) {
      diagnostics.push({
        level: 'error',
        code: 'BACKPRESSURE_INVALID',
        message: 'Backpressure high threshold must be less than critical threshold.',
      });
      return { ok: false, diagnostics };
    }
  }

  // Check sink configs
  if (cfg.sinks) {
    for (let i = 0; i < cfg.sinks.length; i++) {
      const sink = cfg.sinks[i];
      if (!sink || !sink.type) {
        diagnostics.push({
          level: 'error',
          code: 'SINK_TYPE_MISSING',
          message: `Sink configuration at index ${i} must include type field.`,
        });
        // Continue checking other sinks instead of returning early
      }
    }
  }

  // Return ok: false only if there are errors
  const hasErrors = diagnostics.some((d) => d.level === 'error');
  return hasErrors ? { ok: false, diagnostics } : { ok: true, diagnostics: diagnostics.length > 0 ? diagnostics : undefined };
}

/**
 * Load analytics configuration from kb-labs.config.json using loadBundle
 */
export async function loadAnalyticsConfig(
  cwd: string = process.cwd(),
  cliOverrides?: Partial<AnalyticsConfig>
): Promise<{
  config: AnalyticsConfig;
  diagnostics: Diagnostic[];
}> {
  try {
    // Load bundle using core-bundle system
    const bundle = await loadBundle<{ analytics?: Partial<AnalyticsConfig> }>({
      cwd,
      product: 'analytics',
      profileId: 'default',
      cli: cliOverrides as Record<string, unknown>,
      validate: 'warn',
    });

    // Extract analytics config from bundle
    // bundle.config already contains the product-specific config from kb-labs.config.json#products.analytics
    // loadBundle merges: runtime → profile → preset → workspace → local → CLI
    // We still need to apply: defaults → env → final CLI overrides
    const fileConfig = (bundle.config as any) as Partial<AnalyticsConfig>;

    // Resolve config: defaults → bundle.config → env → cli
    // Note: bundle.config already includes CLI from loadBundle options, so we merge cliOverrides on top
    const resolved = resolveConfig<AnalyticsConfig>({
      defaults: DEFAULT_CONFIG,
      fileConfig,
      envMapper,
      cliOverrides, // Final CLI overrides (merged on top of bundle CLI)
      validate: validateConfig,
    });

    return {
      config: resolved.value,
      diagnostics: resolved.diagnostics,
    };
  } catch (error) {
    // Fallback to defaults if bundle loading fails (e.g., no config file)
    const resolved = resolveConfig<AnalyticsConfig>({
      defaults: DEFAULT_CONFIG,
      fileConfig: {},
      envMapper,
      cliOverrides,
      validate: validateConfig,
    });

    return {
      config: resolved.value,
      diagnostics: [
        {
          level: 'warn',
          code: 'CONFIG_LOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to load config bundle',
        },
        ...resolved.diagnostics,
      ],
    };
  }
}

/**
 * Get default config (for testing)
 */
export function getDefaultConfig(): AnalyticsConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export type { AnalyticsConfig } from './types/config.js';

