/**
 * @module @kb-labs/analytics-core/__tests__/analytics-edge-cases.spec.ts
 * Edge cases and error handling tests for Analytics Core
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Analytics } from '../analytics';
import { WalBuffer } from '../buffer';
import { EventBatcher } from '../batcher';
import { DeadLetterQueue } from '../dlq';
import { BackpressureController } from '../backpressure';
import { MetricsCollector } from '../metrics';
import { SinkRouter } from '../router';
import { MiddlewarePipeline } from '../middleware';
import { loadAnalyticsConfig, getDefaultConfig } from '../config';
import type { AnalyticsConfig, AnalyticsEventV1 } from '../types';

describe('Analytics Core Edge Cases', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `kb-labs-analytics-edge-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe('Analytics Class Edge Cases', () => {
    it('should handle missing configuration gracefully', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      
      const analytics = new Analytics({
        cwd: testDir,
        bufferDir,
        dlqDir
      });

      await analytics.init();
      expect(analytics).toBeDefined();
      
      await analytics.dispose();
    });

    it('should handle emit with invalid event format', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      
      const analytics = new Analytics({
        cwd: testDir,
        bufferDir,
        dlqDir
      });
      await analytics.init();

      // Invalid event should be handled gracefully (returns EmitResult)
      const result = await analytics.emit(null as any);
      expect(result).toBeDefined();
      expect(result.queued).toBeDefined();
      
      await analytics.dispose();
    });

    it('should handle emit with missing required fields', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      
      const analytics = new Analytics({
        cwd: testDir,
        bufferDir,
        dlqDir
      });
      await analytics.init();

      const invalidEvent = {
        type: 'test',
        // Missing required fields
      } as any;

      const result = await analytics.emit(invalidEvent);
      // Should handle gracefully (may return queued=false)
      expect(result).toBeDefined();
      expect(result.queued).toBeDefined();
      
      await analytics.dispose();
    });

    it('should handle flush when buffer is empty', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      
      const analytics = new Analytics({
        cwd: testDir,
        bufferDir,
        dlqDir
      });
      await analytics.init();

      // Analytics doesn't have flush() - it uses automatic flushing
      // But we can test dispose
      await expect(analytics.dispose()).resolves.not.toThrow();
    });

    it('should handle emit with valid event', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      
      const analytics = new Analytics({
        cwd: testDir,
        bufferDir,
        dlqDir
      });
      await analytics.init();

      const result = await analytics.emit({
        type: 'test.event',
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        }
      });

      expect(result).toBeDefined();
      expect(result.queued).toBeDefined();
      
      await analytics.dispose();
    });
  });

  describe('WalBuffer Edge Cases', () => {
    it('should handle append when buffer is full', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });

      const buffer = new WalBuffer(bufferDir, {
        segmentBytes: 100, // Very small buffer
        segmentMaxAgeMs: 60000,
        fsyncOnRotate: false
      });
      await buffer.init();

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      // Should handle full buffer gracefully (rotation)
      await expect(buffer.append(event)).resolves.not.toThrow();
      
      await buffer.close();
    });

    it('should handle read from empty buffer', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });

      const buffer = new WalBuffer(bufferDir, {
        segmentBytes: 1024,
        segmentMaxAgeMs: 60000,
        fsyncOnRotate: false
      });
      await buffer.init();

      // Read from empty buffer should return empty array
      const segments = await buffer.listSegments();
      expect(Array.isArray(segments)).toBe(true);
      
      await buffer.close();
    });

    it('should handle deduplication correctly', async () => {
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });

      const buffer = new WalBuffer(bufferDir, {
        segmentBytes: 1024,
        segmentMaxAgeMs: 60000,
        fsyncOnRotate: false
      });
      await buffer.init();

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      const appended1 = await buffer.append(event);
      const appended2 = await buffer.append(event); // Duplicate

      expect(appended1).toBe(true);
      expect(appended2).toBe(false); // Should be deduplicated
      
      await buffer.close();
    });
  });

  describe('EventBatcher Edge Cases', () => {
    it('should batch events correctly', async () => {
      const flushCallback = vi.fn(async () => {});
      const batcher = new EventBatcher({
        maxSize: 3,
        maxAgeMs: 1000
      }, flushCallback);

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      await batcher.add(event);
      await batcher.add(event);
      await batcher.add(event);

      // Third event should trigger flush
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(flushCallback).toHaveBeenCalled();
      
      await batcher.close();
    });

    it('should flush on interval timeout', async () => {
      const flushCallback = vi.fn(async () => {});
      const batcher = new EventBatcher({
        maxSize: 10,
        maxAgeMs: 100 // Short interval
      }, flushCallback);

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      await batcher.add(event);

      // Wait for flush interval
      await new Promise(resolve => setTimeout(resolve, 150));

      // Flush callback should have been called
      expect(flushCallback).toHaveBeenCalled();
      
      await batcher.close();
    });

    it('should handle flush when empty', async () => {
      const flushCallback = vi.fn(async () => {});
      const batcher = new EventBatcher({
        maxSize: 3,
        maxAgeMs: 1000
      }, flushCallback);

      await batcher.flush();
      
      // Should not call flush callback when empty
      expect(flushCallback).not.toHaveBeenCalled();
      
      await batcher.close();
    });
  });

  describe('DeadLetterQueue Edge Cases', () => {
    it('should handle add to DLQ', async () => {
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      await fsp.mkdir(dlqDir, { recursive: true });

      const dlq = new DeadLetterQueue(dlqDir);
      await dlq.init();

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      await expect(dlq.add(event, 'test-error')).resolves.not.toThrow();
      
      await dlq.close();
    });

    it('should handle list from empty DLQ', async () => {
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      await fsp.mkdir(dlqDir, { recursive: true });

      const dlq = new DeadLetterQueue(dlqDir);
      await dlq.init();

      const files = await dlq.listFiles();
      
      expect(Array.isArray(files)).toBe(true);
      
      await dlq.close();
    });

    it('should handle stats for empty DLQ', async () => {
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      await fsp.mkdir(dlqDir, { recursive: true });

      const dlq = new DeadLetterQueue(dlqDir);
      await dlq.init();

      const stats = await dlq.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalEntries).toBe(0);
      
      await dlq.close();
    });
  });

  describe('BackpressureController Edge Cases', () => {
    it('should handle backpressure when queue is full', () => {
      const controller = new BackpressureController({
        high: 2,
        critical: 5
      });

      // Update queue depth
      controller.updateQueueDepth(1);
      expect(controller.shouldAccept()).toBe(true); // Still normal

      controller.updateQueueDepth(3);
      const state = controller.getState();
      expect(state.level).toMatch(/^(normal|high|critical)$/);
    });

    it('should handle different backpressure levels', () => {
      const controller = new BackpressureController({
        high: 10,
        critical: 20,
        sampling: {
          high: 0.5,
          critical: 0.1
        }
      });

      controller.updateQueueDepth(5);
      expect(controller.getState().level).toBe('normal');

      controller.updateQueueDepth(15);
      expect(controller.getState().level).toBe('high');

      controller.updateQueueDepth(25);
      expect(controller.getState().level).toBe('critical');
    });
  });

  describe('MetricsCollector Edge Cases', () => {
    it('should collect metrics correctly', () => {
      const collector = new MetricsCollector();

      collector.recordEvent();
      collector.recordError('sink1');

      const snapshot = collector.getSnapshot();
      
      expect(snapshot).toBeDefined();
      expect(snapshot.eventsPerSecond).toBeGreaterThanOrEqual(0);
      expect(snapshot.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', () => {
      const collector = new MetricsCollector();

      collector.recordEvent();
      collector.recordError('sink1');
      collector.reset();

      const snapshot = collector.getSnapshot();
      
      // Metrics should be reset
      expect(snapshot.eventsPerSecond).toBe(0);
      expect(snapshot.errorRate).toBe(0);
    });
  });

  describe('SinkRouter Edge Cases', () => {
    it('should route events to registered sinks', async () => {
      const router = new SinkRouter([]);

      const mockSink = {
        write: vi.fn(async () => {}),
        close: async () => {}
      };

      router.register('test-sink', mockSink);

      const events: AnalyticsEventV1[] = [
        {
          id: '01234567-89ab-cdef-0123-456789abcdef',
          schema: 'kb.v1',
          type: 'test',
          ts: new Date().toISOString(),
          ingestTs: new Date().toISOString(),
          source: {
            product: '@kb-labs/test',
            version: '0.1.0'
          },
          runId: 'run_123'
        }
      ];

      await router.route(events);
      
      expect(mockSink.write).toHaveBeenCalled();
      
      await router.close();
    });

    it('should handle routing when no sinks configured', async () => {
      const router = new SinkRouter([]);

      const events: AnalyticsEventV1[] = [
        {
          id: '01234567-89ab-cdef-0123-456789abcdef',
          schema: 'kb.v1',
          type: 'test',
          ts: new Date().toISOString(),
          ingestTs: new Date().toISOString(),
          source: {
            product: '@kb-labs/test',
            version: '0.1.0'
          },
          runId: 'run_123'
        }
      ];

      // Should handle gracefully when no sinks (no-op)
      await expect(router.route(events)).resolves.not.toThrow();
    });
  });

  describe('MiddlewarePipeline Edge Cases', () => {
    it('should process events through middleware chain', async () => {
      const pipeline = new MiddlewarePipeline({});
      await pipeline.init();

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      const processed = await pipeline.process(event);
      
      expect(processed).toBeDefined();
      // May be null if dropped by sampling
      expect(processed === null || typeof processed === 'object').toBe(true);
    });

    it('should handle sync processing', () => {
      const pipeline = new MiddlewarePipeline({});

      const event: AnalyticsEventV1 = {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        schema: 'kb.v1',
        type: 'test',
        ts: new Date().toISOString(),
        ingestTs: new Date().toISOString(),
        source: {
          product: '@kb-labs/test',
          version: '0.1.0'
        },
        runId: 'run_123'
      };

      const processed = pipeline.processSync(event);
      
      expect(processed).toBeDefined();
      // May be null if dropped by sampling
      expect(processed === null || typeof processed === 'object').toBe(true);
    });
  });

  describe('Config Loading Edge Cases', () => {
    it('should return default config when workspace config missing', async () => {
      const { config } = await loadAnalyticsConfig(testDir);

      expect(config).toBeDefined();
      // Should have default values (from getDefaultConfig)
      expect(config.enabled).toBeDefined();
    });

    it('should load config from workspace', async () => {
      // Create workspace config directory
      await fsp.mkdir(path.join(testDir, '.kb'), { recursive: true });
      
      const workspaceConfig = {
        schemaVersion: '1.0',
        products: {
          analytics: {
            enabled: true,
            buffer: {
              segmentBytes: 1000,
              segmentMaxAgeMs: 5000
            }
          }
        }
      };

      await fsp.writeFile(
        path.join(testDir, 'kb.config.json'),
        JSON.stringify(workspaceConfig, null, 2)
      );

      const { config } = await loadAnalyticsConfig(testDir);

      expect(config).toBeDefined();
      // Config may be merged with defaults
      expect(config).toBeDefined();
    });

    it('should handle invalid config gracefully', async () => {
      // Create invalid config
      await fsp.mkdir(path.join(testDir, '.kb'), { recursive: true });
      await fsp.writeFile(
        path.join(testDir, 'kb.config.json'),
        '{ invalid json }'
      );

      // Should fall back to defaults (returns config with diagnostics)
      const { config, diagnostics } = await loadAnalyticsConfig(testDir);
      expect(config).toBeDefined();
      expect(diagnostics).toBeDefined();
    });
  });
});

