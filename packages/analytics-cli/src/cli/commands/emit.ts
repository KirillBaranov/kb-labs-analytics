/**
 * Emit command - Emit a test event
 */

import type { Command } from '@kb-labs/cli-commands';
import { box, keyValue, safeSymbols, safeColors } from '@kb-labs/shared-cli-ui';
import { emit } from '@kb-labs/analytics-sdk-node';

export const run: Command = {
  name: 'analytics:emit',
  category: 'analytics',
  describe: 'Emit a test event',
  async run(ctx, argv, flags) {
    const jsonMode = !!flags.json;
    const eventType = (flags.type as string) || 'test.event';
    let payload: Record<string, unknown> = {};

    if (flags.payload) {
      try {
        payload = JSON.parse(flags.payload as string);
      } catch {
        if (jsonMode) {
          ctx.presenter.json({
            ok: false,
            error: 'Invalid JSON payload',
          });
        } else {
          ctx.presenter.error('Invalid JSON payload');
        }
        return 1;
      }
    }

    // Emit event
    const result = await emit({
      type: eventType,
      source: {
        product: '@kb-labs/analytics-cli',
        version: '0.1.0',
      },
      payload,
    });

    if (jsonMode) {
      ctx.presenter.json({
        ok: result.queued,
        event: {
          type: eventType,
          queued: result.queued,
          reason: result.reason,
        },
      });
      return result.queued ? 0 : 1;
    }

    if (result.queued) {
      const info: Record<string, string> = {
        Status: safeColors.success(`${safeSymbols.success} Event emitted`),
        Type: eventType,
      };
      if (Object.keys(payload).length > 0) {
        info['Payload'] = JSON.stringify(payload);
      }
      const output = box('Analytics Event', keyValue(info));
      ctx.presenter.write(output);
      return 0;
    } else {
      ctx.presenter.error(`Failed to emit event: ${result.reason || 'Unknown error'}`);
      return 1;
    }
  },
};

export async function emitCommand(
  ctx: Parameters<Command['run']>[0],
  argv: Parameters<Command['run']>[1],
  flags: Parameters<Command['run']>[2]
) {
  return run.run(ctx, argv, flags);
}
