/**
 * Stats command - Show metrics statistics
 */

import type { Command } from '@kb-labs/cli-commands';
import { Analytics } from '@kb-labs/analytics-core';
import { box, keyValue } from '@kb-labs/shared-cli-ui';

export const stats: Command = {
  name: 'analytics:stats',
  category: 'analytics',
  describe: 'Show metrics statistics',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const interval = flags.interval as string | undefined;
    const cwd = ctx?.cwd || process.cwd();

    try {
      const analytics = new Analytics({ cwd });
      await analytics.init();

      const showStats = () => {
        const metrics = analytics.getMetrics();
        const backpressure = analytics.getBackpressureState();

        if (jsonMode) {
          ctx.presenter.json({
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
          const info: Record<string, string> = {
            'Events/sec': metrics.eventsPerSecond.toFixed(2),
            'Queue depth': `${metrics.queueDepth}`,
            'Error rate': `${(metrics.errorRate * 100).toFixed(2)}%`,
            'Backpressure': backpressure.level,
            'Sampling rate': `${(backpressure.samplingRate * 100).toFixed(1)}%`,
            'Drops': `${backpressure.dropCount}`,
          };

          const output = box('Analytics Stats', keyValue(info));
          ctx.presenter.write(output);
        }
      };

      // Show stats once
      showStats();

      // If interval specified, show stats periodically
      if (interval) {
        const intervalMs = parseInterval(interval);
        if (intervalMs > 0) {
          ctx.presenter.info(`Updating every ${interval}... (Press Ctrl+C to stop)`);
          const intervalId = setInterval(() => {
            ctx.presenter.write('\n'); // Add spacing between updates
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

      await analytics.dispose();
      return 0;
    } catch (error) {
      if (jsonMode) {
        ctx.presenter.json({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        ctx.presenter.error(error instanceof Error ? error.message : String(error));
      }
      return 1;
    }
  },
};

export async function statsCommand(
  ctx: Parameters<Command['run']>[0],
  argv: Parameters<Command['run']>[1],
  flags: Parameters<Command['run']>[2]
) {
  return stats.run(ctx, argv, flags);
}

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

