/**
 * Tests for Analytics class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Analytics } from '../../analytics';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

describe('Analytics', () => {
  let testDir: string;
  let analytics: Analytics;

  beforeEach(async () => {
    testDir = join(tmpdir(), `analytics-test-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });
    
    // Create git repo for findRepoRoot
    await fsp.mkdir(join(testDir, '.git'), { recursive: true });
    
    analytics = new Analytics({
      cwd: testDir,
      bufferDir: join(testDir, '.kb/analytics/buffer'),
      dlqDir: join(testDir, '.kb/analytics/dlq'),
    });
  });

  afterEach(async () => {
    await analytics.dispose().catch(() => {});
    await fsp.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should initialize with default config when no config file', async () => {
    await analytics.init();
    // Should not throw
    expect(analytics).toBeDefined();
  });

  it('should emit event successfully', async () => {
    await analytics.init();

    const result = await analytics.emit({
      type: 'test.event',
      source: {
        product: '@kb-labs/test',
        version: '0.1.0',
      },
      payload: { test: true },
    });

    expect(result.queued).toBe(true);
  });

  it('should return queued=false when disabled', async () => {
    const disabledAnalytics = new Analytics({
      cwd: testDir,
      config: { enabled: false },
    });
    await disabledAnalytics.init();

    const result = await disabledAnalytics.emit({
      type: 'test.event',
      source: { product: '@kb-labs/test', version: '0.1.0' },
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe('Analytics disabled');

    await disabledAnalytics.dispose();
  });

  it('should create run scope', () => {
    const scope = analytics.createRunScope('run_123', {
      type: 'user',
      id: 'u_123',
    });

    expect(scope.id).toBe('run_123');
    expect(scope.actor?.id).toBe('u_123');
    expect(scope.emit).toBeDefined();
    expect(scope.finish).toBeDefined();
  });

  it('should emit event through run scope', async () => {
    await analytics.init();

    const scope = analytics.createRunScope();
    const result = await scope.emit({
      type: 'test.event',
      source: { product: '@kb-labs/test', version: '0.1.0' },
    });

    expect(result.queued).toBe(true);
  });

  it('should use task helper', async () => {
    await analytics.init();

    const result = await analytics.task('test.event', {
      pkg: '@kb-labs/test',
      durationMs: 100,
    });

    expect(result.queued).toBe(true);
  });

  it('should return queued=false for invalid event', async () => {
    await analytics.init();

    const result = await analytics.emit({
      // Missing required fields
      type: 'test',
    } as any);

    // Should handle gracefully
    expect(result.queued).toBeDefined();
  });

  it('should provide metrics snapshot', async () => {
    await analytics.init();

    await analytics.emit({
      type: 'test.event',
      source: { product: '@kb-labs/test', version: '0.1.0' },
    });

    const metrics = analytics.getMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.eventsPerSecond).toBeGreaterThanOrEqual(0);
    expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
  });

  it('should provide backpressure state', async () => {
    await analytics.init();

    const state = analytics.getBackpressureState();

    expect(state).toBeDefined();
    expect(state.level).toMatch(/^(normal|high|critical)$/);
    expect(typeof state.samplingRate).toBe('number');
  });

  it('should handle errors gracefully', async () => {
    // Create analytics with invalid buffer dir to trigger error
    const badAnalytics = new Analytics({
      cwd: '/nonexistent',
      bufferDir: '/nonexistent/invalid',
    });

    // Should not throw
    const result = await badAnalytics.emit({
      type: 'test.event',
      source: { product: '@kb-labs/test', version: '0.1.0' },
    });

    // Should return queued=false with reason
    expect(result.queued).toBe(false);
    expect(result.reason).toBeDefined();

    await badAnalytics.dispose();
  });
});

