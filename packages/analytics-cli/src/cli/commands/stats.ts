/**
 * Stats command - Show metrics statistics
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { Analytics } from '@kb-labs/analytics-core';

/**
 * Parse interval string (e.g. "5s", "10s", "1m")
 */
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h)$/);
  if (!match) {
    return 0;
  }

  const value = parseInt(match[1] || '0', 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return 0;
  }
}

type AnalyticsStatsFlags = {
  interval: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsStatsResult = CommandResult & {
  metrics?: {
    eventsPerSecond: number;
    queueDepth: number;
    errorRate: number;
  };
  backpressure?: {
    level: string;
    samplingRate: number;
    dropCount: number;
  };
};

export const run = defineCommand<AnalyticsStatsFlags, AnalyticsStatsResult>({
  name: 'analytics:stats',
  flags: {
    interval: {
      type: 'string',
      description: 'Update interval (e.g. 5s, 10s)',
    },
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const interval = flags.interval;
    const cwd = ctx?.cwd || process.cwd();
    
    ctx.logger?.info('Analytics stats started', { interval });

    ctx.tracker.checkpoint('init');

    try {
      const analytics = new Analytics({ cwd });
      await analytics.init();

      const showStats = () => {
        const metrics = analytics.getMetrics();
        const backpressure = analytics.getBackpressureState();

        if (flags.json) {
          ctx.output?.json({
            ok: true,
            metrics: {
              eventsPerSecond: metrics.eventsPerSecond,
              queueDepth: metrics.queueDepth,
              errorRate: metrics.errorRate,
            },
            backpressure: {
              level: backpressure.level,
              samplingRate: backpressure.samplingRate,
              dropCount: backpressure.dropCount,
            },
          });
        } else {
          const items: string[] = [
            `Events/sec: ${metrics.eventsPerSecond.toFixed(2)}`,
            `Queue depth: ${metrics.queueDepth}`,
            `Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`,
            `Backpressure: ${backpressure.level}`,
            `Sampling rate: ${(backpressure.samplingRate * 100).toFixed(1)}%`,
            `Drops: ${backpressure.dropCount}`,
          ];

          const outputText = ctx.output?.ui.sideBox({
            title: 'Analytics Stats',
            sections: [
              {
                items,
              },
            ],
            status: 'info',
          });
          ctx.output?.write(outputText);
        }
      };

      // Show stats once
      showStats();

      // If interval specified, show stats periodically
      if (interval) {
        const intervalMs = parseInterval(interval);
        if (intervalMs > 0) {
          ctx.output?.info(`Updating every ${interval}... (Press Ctrl+C to stop)`);
          const intervalId = setInterval(() => {
            ctx.output?.write('\n'); // Add spacing between updates
            showStats();
          }, intervalMs);

          // Keep process alive
          process.stdin.resume();
          
          // Cleanup on exit
          process.on('SIGINT', () => {
            clearInterval(intervalId);
            analytics.dispose().then(() => process.exit(0));
          });
        }
      }

      ctx.tracker.checkpoint('complete');

      await analytics.dispose();
      ctx.logger?.info('Analytics stats completed');
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger?.error('Analytics stats failed', { error: errorMessage });
      
      if (flags.json) {
        ctx.output?.json({
          ok: false,
          error: errorMessage,
        });
      } else {
        ctx.output?.error(error instanceof Error ? error : new Error(errorMessage));
      }
      return { ok: false, exitCode: 1, error: errorMessage };
    }
  },
});

export async function statsCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
