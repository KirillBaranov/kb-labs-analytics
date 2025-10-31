/**
 * HTTP Sink - POST events to HTTP endpoint
 */

import type {
  AnalyticsEventV1,
  SinkConfig,
  RetryConfig,
  CircuitBreakerConfig,
} from '@kb-labs/analytics-core';

export interface HTTPSinkConfig extends SinkConfig {
  type: 'http';
  url?: string; // Endpoint URL (required)
  method?: 'POST' | 'PUT'; // HTTP method (default: POST)
  headers?: Record<string, string>; // Additional headers
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string; // Bearer token or API key
    username?: string; // Basic auth username
    password?: string; // Basic auth password
  };
  timeout?: number; // Request timeout in ms (default: 5000)
  idempotencyKey?: string; // Header name for idempotency (default: "Idempotency-Key")
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  halfOpenAttempts: number;
}

/**
 * HTTP Sink - POST events to HTTP endpoint
 */
export class HTTPSink {
  private config: Required<Omit<HTTPSinkConfig, 'type' | 'auth' | 'headers'>> & {
    type: 'http';
    auth?: HTTPSinkConfig['auth'];
    headers?: Record<string, string>;
  };
  private circuitBreaker: CircuitBreakerState;
  private retryConfig: Required<RetryConfig>;
  private breakerConfig: Required<CircuitBreakerConfig>;
  private writtenEvents = new Set<string>(); // Track sent event IDs for idempotency

  constructor(config: HTTPSinkConfig) {
    if (!config.url) {
      throw new Error('HTTPSink requires url configuration');
    }

    this.config = {
      type: 'http',
      url: config.url as string,
      method: (config.method as 'POST' | 'PUT' | undefined) || 'POST',
      headers: (config.headers as Record<string, string> | undefined) || {},
      auth: config.auth as HTTPSinkConfig['auth'],
      timeout: (config.timeout as number | undefined) || 5000,
      idempotencyKey: (config.idempotencyKey as string | undefined) || 'Idempotency-Key',
    };

    // Default retry config
    this.retryConfig = {
      initialMs: config.retry?.initialMs ?? 100,
      maxMs: config.retry?.maxMs ?? 10000,
      factor: config.retry?.factor ?? 2,
      jitter: config.retry?.jitter ?? 0.1,
    };

    // Default circuit breaker config
    this.breakerConfig = {
      failures: config.breaker?.failures ?? 5,
      windowMs: config.breaker?.windowMs ?? 60000, // 1 minute
      halfOpenEveryMs: config.breaker?.halfOpenEveryMs ?? 30000, // 30 seconds
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      halfOpenAttempts: 0,
    };
  }

  /**
   * Initialize sink
   */
  async init(): Promise<void> {
    // No initialization needed for HTTP sink
  }

  /**
   * Write events to HTTP endpoint
   */
  async write(events: AnalyticsEventV1[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Check circuit breaker state
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure < this.breakerConfig.halfOpenEveryMs) {
        throw new Error('Circuit breaker is open');
      }
      // Transition to half-open
      this.circuitBreaker.state = 'half-open';
      this.circuitBreaker.halfOpenAttempts = 0;
    }

    // Filter out already sent events (idempotency)
    // But still attempt send to update circuit breaker state
    const newEvents: AnalyticsEventV1[] = [];
    for (const event of events) {
      const eventId = event.id;
      if (!this.writtenEvents.has(eventId)) {
        newEvents.push(event);
      }
    }

    // If all events already sent, still check circuit breaker but don't send
    if (newEvents.length === 0) {
      // Circuit breaker check already done above
      return; // All events already sent
    }

    // Send events with retry logic
    await this.sendWithRetry(newEvents);

    // Mark events as sent only after successful send
    for (const event of newEvents) {
      this.writtenEvents.add(event.id);
    }
  }

  /**
   * Send events with retry logic
   */
  private async sendWithRetry(events: AnalyticsEventV1[]): Promise<void> {
    let attempt = 0;
    let delay = this.retryConfig.initialMs;
    const maxAttempts = Math.ceil(Math.log(this.retryConfig.maxMs / this.retryConfig.initialMs) / Math.log(this.retryConfig.factor)) + 1;

    while (attempt < maxAttempts) {
      try {
        await this.sendRequest(events);
        // Success - reset circuit breaker
        this.onSuccess();
        return;
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          // Max retries reached - record failure
          this.onFailure();
          throw error;
        }

        // Calculate backoff with jitter
        const jitter = delay * this.retryConfig.jitter * (Math.random() * 2 - 1);
        const backoff = Math.min(delay + jitter, this.retryConfig.maxMs);
        delay *= this.retryConfig.factor;

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  /**
   * Send HTTP request
   */
  private async sendRequest(events: AnalyticsEventV1[]): Promise<void> {
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    // Add auth headers
    if (this.config.auth) {
      if (this.config.auth.type === 'bearer' && this.config.auth.token) {
        headers['Authorization'] = `Bearer ${this.config.auth.token}`;
      } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
        const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (this.config.auth.type === 'apikey' && this.config.auth.token) {
        headers['X-API-Key'] = this.config.auth.token;
      }
    }

    // Add idempotency key (use first event ID or generate)
    const idempotencyKey = events[0]?.id || `batch_${Date.now()}`;
    const headerKey = this.config.idempotencyKey as string;
    headers[headerKey] = idempotencyKey;

    // Prepare body
    const body = JSON.stringify(events);

    // Send request
    const controller = new AbortController();
    const timeoutMs = this.config.timeout as number;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = this.config.url as string;
      const method = this.config.method as 'POST' | 'PUT';
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      // Success in half-open - close circuit breaker
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.halfOpenAttempts = 0;
    } else if (this.circuitBreaker.state === 'closed') {
      // Reset failure count on success
      this.circuitBreaker.failures = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.state === 'half-open') {
      // Failure in half-open - open circuit breaker
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.halfOpenAttempts++;
    } else if (this.circuitBreaker.failures >= this.breakerConfig.failures) {
      // Too many failures - open circuit breaker
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Get idempotency key for event
   */
  getIdempotencyKey(event: AnalyticsEventV1): string {
    return event.id;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): 'open' | 'half-open' | 'closed' {
    // Check if we should transition from open to half-open
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure >= this.breakerConfig.halfOpenEveryMs) {
        return 'half-open';
      }
    }
    return this.circuitBreaker.state;
  }

  /**
   * Close sink
   */
  async close(): Promise<void> {
    // No cleanup needed
  }
}

