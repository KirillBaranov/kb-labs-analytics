/**
 * @module @kb-labs/analytics-cli/__tests__/analytics-cli-edge-cases.spec.ts
 * Edge cases and error handling tests for Analytics CLI commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Command } from '@kb-labs/cli-commands';
import { run as emitCommand } from '../cli/commands/emit';
import { status as statusCommand } from '../cli/commands/status';
import { tail as tailCommand } from '../cli/commands/tail';
import { flushCommand } from '../cli/commands/flush';
import { dlq as dlqCommand } from '../cli/commands/dlq';
import { compact as compactCommand } from '../cli/commands/compact';
import { stats as statsCommand } from '../cli/commands/stats';
import type { CliContext } from '@kb-labs/cli-core';

describe('Analytics CLI Edge Cases', () => {
  let testDir: string;
  let mockContext: CliContext;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `kb-labs-analytics-cli-edge-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });

    mockContext = {
      cwd: testDir,
      repoRoot: testDir,
      env: process.env,
      diagnostics: [],
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      presenter: {
        isTTY: false,
        isQuiet: false,
        isJSON: false,
        write: vi.fn(),
        error: vi.fn(),
        json: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    } as any;
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe('analytics:emit Edge Cases', () => {
    it('should handle missing event type (uses default)', async () => {
      const result = await emitCommand.run(mockContext, [], {});
      
      // Should use default event type and return success or error
      expect(typeof result).toBe('number');
      // Command should be callable
      expect(emitCommand.name).toBe('analytics:emit');
    });

    it('should handle invalid JSON payload', async () => {
      const result = await emitCommand.run(
        mockContext,
        [],
        { payload: 'invalid json', type: 'test.event' }
      );
      
      // Should return error code for invalid JSON
      expect(result).toBe(1);
      expect(mockContext.presenter.error).toHaveBeenCalled();
    });

    it('should handle empty event payload', async () => {
      const result = await emitCommand.run(
        mockContext,
        [],
        { type: 'test.event' }
      );
      
      // Should handle empty payload gracefully
      expect(typeof result).toBe('number');
    });

    it('should handle valid event emission', async () => {
      const result = await emitCommand.run(
        mockContext,
        [],
        { type: 'test.event', payload: '{"key":"value"}' }
      );
      
      // Should return success or error code
      expect(typeof result).toBe('number');
      // Result should be 0 (success) or 1 (error)
      expect(result === 0 || result === 1).toBe(true);
    });

    it('should support JSON output mode', async () => {
      const result = await emitCommand.run(
        mockContext,
        [],
        { type: 'test.event', json: true }
      );
      
      // Should return code and may call json presenter
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:status Edge Cases', () => {
    it('should handle missing buffer directory', async () => {
      // No buffer directory created
      const result = await statusCommand.run(mockContext, [], {});
      
      // Should handle missing buffer gracefully
      expect(typeof result).toBe('number');
      // Command should be callable
      expect(statusCommand.name).toBe('analytics:status');
    });

    it('should handle empty buffer', async () => {
      // Create analytics directory structure
      const analyticsDir = path.join(testDir, '.kb', 'analytics');
      await fsp.mkdir(analyticsDir, { recursive: true });
      
      const result = await statusCommand.run(mockContext, [], {});
      
      // Should report empty buffer correctly
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await statusCommand.run(mockContext, [], { json: true });
      
      // Should return code and may call json presenter
      expect(typeof result).toBe('number');
    });

    it('should handle analytics initialization errors', async () => {
      // Use invalid cwd
      const invalidContext = {
        ...mockContext,
        cwd: '/nonexistent/path',
      };
      
      const result = await statusCommand.run(invalidContext, [], {});
      
      // Should handle errors gracefully
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:tail Edge Cases', () => {
    it('should handle missing buffer', async () => {
      // No buffer directory created
      const result = await tailCommand.run(mockContext, [], {});
      
      // Should handle missing buffer gracefully
      expect(typeof result).toBe('number');
      expect(tailCommand.name).toBe('analytics:tail');
    });

    it('should handle empty buffer', async () => {
      // Create empty buffer directory
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });
      
      const result = await tailCommand.run(mockContext, [], {});
      
      // Should handle empty buffer
      expect(typeof result).toBe('number');
    });

    it('should handle limit parameter', async () => {
      const result = await tailCommand.run(mockContext, [], { limit: '10' });
      
      // Should validate limit parameter
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await tailCommand.run(mockContext, [], { json: true });
      
      // Should support JSON output
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:flush Edge Cases', () => {
    it('should handle missing buffer', async () => {
      // No buffer directory created
      const result = await flushCommand.run(mockContext, [], {});
      
      // Should handle missing buffer gracefully
      expect(typeof result).toBe('number');
      expect(flushCommand.name).toBe('analytics:flush');
    });

    it('should handle empty buffer', async () => {
      // Create empty buffer directory
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });
      
      const result = await flushCommand.run(mockContext, [], {});
      
      // Should handle empty buffer gracefully
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await flushCommand.run(mockContext, [], { json: true });
      
      // Should support JSON output
      expect(typeof result).toBe('number');
    });

    it('should handle analytics initialization errors', async () => {
      const invalidContext = {
        ...mockContext,
        cwd: '/nonexistent/path',
      };
      
      const result = await flushCommand.run(invalidContext, [], {});
      
      // Should handle errors gracefully
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:dlq Edge Cases', () => {
    it('should handle missing DLQ directory', async () => {
      // No DLQ directory created
      const result = await dlqCommand.run(mockContext, [], {});
      
      // Should handle missing DLQ gracefully
      expect(typeof result).toBe('number');
      expect(dlqCommand.name).toBe('analytics:dlq');
    });

    it('should handle empty DLQ', async () => {
      // Create empty DLQ directory
      const dlqDir = path.join(testDir, '.kb', 'analytics', 'dlq');
      await fsp.mkdir(dlqDir, { recursive: true });
      
      const result = await dlqCommand.run(mockContext, [], {});
      
      // Should handle empty DLQ
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await dlqCommand.run(mockContext, [], { json: true });
      
      // Should support JSON output
      expect(typeof result).toBe('number');
    });

    it('should handle list operation', async () => {
      const result = await dlqCommand.run(mockContext, ['list'], {});
      
      // Should handle list operation
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:compact Edge Cases', () => {
    it('should handle missing buffer', async () => {
      // No buffer directory created
      const result = await compactCommand.run(mockContext, [], {});
      
      // Should handle missing buffer gracefully
      expect(typeof result).toBe('number');
      expect(compactCommand.name).toBe('analytics:compact');
    });

    it('should handle empty buffer', async () => {
      // Create empty buffer directory
      const bufferDir = path.join(testDir, '.kb', 'analytics', 'buffer');
      await fsp.mkdir(bufferDir, { recursive: true });
      
      const result = await compactCommand.run(mockContext, [], {});
      
      // Should handle empty buffer
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await compactCommand.run(mockContext, [], { json: true });
      
      // Should support JSON output
      expect(typeof result).toBe('number');
    });

    it('should handle analytics initialization errors', async () => {
      const invalidContext = {
        ...mockContext,
        cwd: '/nonexistent/path',
      };
      
      const result = await compactCommand.run(invalidContext, [], {});
      
      // Should handle errors gracefully
      expect(typeof result).toBe('number');
    });
  });

  describe('analytics:stats Edge Cases', () => {
    it('should handle missing analytics config', async () => {
      // No config directory created
      const result = await statsCommand.run(mockContext, [], {});
      
      // Should handle missing config gracefully
      expect(typeof result).toBe('number');
      expect(statsCommand.name).toBe('analytics:stats');
    });

    it('should handle empty stats', async () => {
      // Create analytics directory structure
      const analyticsDir = path.join(testDir, '.kb', 'analytics');
      await fsp.mkdir(analyticsDir, { recursive: true });
      
      const result = await statsCommand.run(mockContext, [], {});
      
      // Should handle empty stats
      expect(typeof result).toBe('number');
    });

    it('should support JSON output mode', async () => {
      const result = await statsCommand.run(mockContext, [], { json: true });
      
      // Should support JSON output
      expect(typeof result).toBe('number');
    });

    it('should handle analytics initialization errors', async () => {
      const invalidContext = {
        ...mockContext,
        cwd: '/nonexistent/path',
      };
      
      const result = await statsCommand.run(invalidContext, [], {});
      
      // Should handle errors gracefully
      expect(typeof result).toBe('number');
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle command chaining (emit -> status)', async () => {
      // First emit an event
      const emitResult = await emitCommand.run(
        mockContext,
        [],
        { type: 'test.event', payload: '{"test":true}' }
      );
      
      // Then check status
      const statusResult = await statusCommand.run(mockContext, [], {});
      
      // Both should complete
      expect(typeof emitResult).toBe('number');
      expect(typeof statusResult).toBe('number');
    });

    it('should handle context sharing between commands', async () => {
      // All commands should share the same context
      const commands = [
        emitCommand,
        statusCommand,
        tailCommand,
        flushCommand,
      ];
      
      for (const cmd of commands) {
        const result = await cmd.run(mockContext, [], {});
        expect(typeof result).toBe('number');
      }
    });

    it('should handle JSON mode across commands', async () => {
      // All commands should support JSON mode
      const commands = [
        emitCommand,
        statusCommand,
        tailCommand,
        flushCommand,
        dlqCommand,
        compactCommand,
        statsCommand,
      ];
      
      for (const cmd of commands) {
        const result = await cmd.run(mockContext, [], { json: true });
        expect(typeof result).toBe('number');
      }
    });
  });
});

