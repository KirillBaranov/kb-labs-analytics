/**
 * Error handling for analytics-core
 * Uses KbError pattern from @kb-labs/core-config for consistent error handling
 */

/**
 * Base error class following KbError pattern
 */
export class KbError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
    public meta?: any
  ) {
    super(message);
    this.name = 'KbError';
  }
}

/**
 * Analytics-specific error codes
 */
export const ANALYTICS_ERROR_CODES = {
  ERR_ANALYTICS_BUFFER_FULL: 'ERR_ANALYTICS_BUFFER_FULL',
  ERR_ANALYTICS_SINK_FAILED: 'ERR_ANALYTICS_SINK_FAILED',
  ERR_ANALYTICS_CONFIG_INVALID: 'ERR_ANALYTICS_CONFIG_INVALID',
  ERR_ANALYTICS_BUFFER_ERROR: 'ERR_ANALYTICS_BUFFER_ERROR',
  ERR_ANALYTICS_EVENT_INVALID: 'ERR_ANALYTICS_EVENT_INVALID',
  ERR_ANALYTICS_DLQ_ERROR: 'ERR_ANALYTICS_DLQ_ERROR',
  ERR_ANALYTICS_SINK_INIT_FAILED: 'ERR_ANALYTICS_SINK_INIT_FAILED',
} as const;

export type AnalyticsErrorCode = (typeof ANALYTICS_ERROR_CODES)[keyof typeof ANALYTICS_ERROR_CODES];

/**
 * Standard hints for analytics errors
 */
export const ANALYTICS_ERROR_HINTS = {
  ERR_ANALYTICS_BUFFER_FULL:
    'Analytics buffer is full. Check backpressure settings or increase buffer size.',
  ERR_ANALYTICS_SINK_FAILED:
    'Failed to send events to sink. Check sink configuration and network connectivity.',
  ERR_ANALYTICS_CONFIG_INVALID:
    'Invalid analytics configuration. Check kb-labs.config.json analytics section.',
  ERR_ANALYTICS_BUFFER_ERROR:
    'Error writing to analytics buffer. Check disk space and permissions.',
  ERR_ANALYTICS_EVENT_INVALID:
    'Event validation failed. Check event schema and required fields.',
  ERR_ANALYTICS_DLQ_ERROR:
    'Error writing to Dead-Letter Queue. Check disk space and permissions.',
  ERR_ANALYTICS_SINK_INIT_FAILED:
    'Failed to initialize sink. Check sink configuration and dependencies.',
} as const;

/**
 * Analytics error class extending KbError
 */
export class AnalyticsError extends KbError {
  constructor(
    code: AnalyticsErrorCode,
    message: string,
    meta?: Record<string, unknown>
  ) {
    const hint = ANALYTICS_ERROR_HINTS[code];
    super(code, message, hint, meta);
    Object.setPrototypeOf(this, AnalyticsError.prototype);
    Object.defineProperty(this, 'name', { value: 'AnalyticsError' });
  }
}

/**
 * Helper to create analytics errors
 */
export function createAnalyticsError(
  code: AnalyticsErrorCode,
  message: string,
  meta?: Record<string, unknown>
): AnalyticsError {
  return new AnalyticsError(code, message, meta);
}

/**
 * Check if error is AnalyticsError
 */
export function isAnalyticsError(err: unknown): err is AnalyticsError {
  return err instanceof AnalyticsError;
}

/**
 * Map analytics error codes to exit codes
 */
export function getAnalyticsExitCode(err: AnalyticsError | KbError): number {
  if (err instanceof KbError) {
    // Use KbError's exit code mapping if available
    const code = (err as any).code;
    if (code === ANALYTICS_ERROR_CODES.ERR_ANALYTICS_CONFIG_INVALID) {
      return 78; // EX_CONFIG
    }
    if (code === ANALYTICS_ERROR_CODES.ERR_ANALYTICS_BUFFER_ERROR) {
      return 74; // EX_IOERR
    }
  }
  return 1; // Generic error
}

