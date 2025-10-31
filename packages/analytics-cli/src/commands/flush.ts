/**
 * Flush command - Force flush buffer to sinks
 */

import type { Command } from '@kb-labs/cli-commands';
import { box, keyValue, formatTiming, TimingTracker, safeSymbols, safeColors } from '@kb-labs/shared-cli-ui';
import { flush } from '@kb-labs/analytics-sdk-node';

export const flushCommand: Command = {
  name: 'analytics:flush',
  category: 'analytics',
  describe: 'Force flush buffer to sinks',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const tracker = new TimingTracker();

    try {
      tracker.checkpoint('flush');

      await flush();

      const duration = tracker.total();

      if (jsonMode) {
        ctx.presenter.json({
          ok: true,
          duration: formatTiming(duration),
        });
        return 0;
      }

      const info: Record<string, string> = {
        Status: safeColors.success(`${safeSymbols.success} Buffer flushed to sinks`),
        Duration: formatTiming(duration),
      };

      const output = box('Analytics Flush', keyValue(info));
      ctx.presenter.write(output);
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
