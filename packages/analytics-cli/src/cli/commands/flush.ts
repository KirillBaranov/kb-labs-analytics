/**
 * Flush command - Force flush buffer to sinks
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { keyValue, formatTiming } from '@kb-labs/shared-cli-ui';
import { flush } from '@kb-labs/analytics-sdk-node';

type AnalyticsFlushFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsFlushResult = CommandResult & {
  durationMs?: number;
};

export const run = defineCommand<AnalyticsFlushFlags, AnalyticsFlushResult>({
  name: 'analytics:flush',
  flags: {
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    ctx.logger?.info('Analytics flush started');

    ctx.tracker.checkpoint('flush');

    await flush();

    ctx.tracker.checkpoint('complete');
    
    ctx.logger?.info('Analytics flush completed');

    if (flags.json) {
      ctx.output?.json({
        ok: true,
        durationMs: ctx.tracker.total(),
      });
      return { ok: true };
    }

    const info: Record<string, string> = {
      Status: ctx.output?.ui.colors.success(`${ctx.output?.ui.symbols.success} Buffer flushed to sinks`) ?? 'Buffer flushed',
      Duration: formatTiming(ctx.tracker.total()),
    };

    const outputText = ctx.output?.ui.box('Analytics Flush', keyValue(info));
    ctx.output?.write(outputText);
    return { ok: true };
  },
});

export async function runFlushCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
