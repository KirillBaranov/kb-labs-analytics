/**
 * Emit command - Emit a test event
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { emit } from '@kb-labs/analytics-sdk-node';

type AnalyticsEmitFlags = {
  type: { type: 'string'; description?: string; default?: string };
  payload: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

type AnalyticsEmitResult = CommandResult & {
  event?: {
    type: string;
    queued: boolean;
    reason?: string;
  };
};

export const run = defineCommand<AnalyticsEmitFlags, AnalyticsEmitResult>({
  name: 'analytics:emit',
  flags: {
    type: {
      type: 'string',
      description: 'Event type (default: test.event)',
      default: 'test.event',
    },
    payload: {
      type: 'string',
      description: 'Event payload as JSON string',
    },
    json: {
      type: 'boolean',
      description: 'Return JSON payload',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const eventType = flags.type || 'test.event';
    let payload: Record<string, unknown> = {};
    
    ctx.logger?.info('Analytics emit started', { eventType });

    if (flags.payload) {
      try {
        payload = JSON.parse(flags.payload);
      } catch {
        ctx.logger?.error('Invalid JSON payload');
        
        if (flags.json) {
          ctx.output?.json({
            ok: false,
            error: 'Invalid JSON payload',
          });
        } else {
          ctx.output?.error(new Error('Invalid JSON payload'));
        }
        return { ok: false, exitCode: 1 };
      }
    }

    ctx.tracker.checkpoint('emit');

    // Emit event
    const result = await emit({
      type: eventType,
      source: {
        product: '@kb-labs/analytics-cli',
        version: '0.1.0',
      },
      payload,
    });
    
    ctx.tracker.checkpoint('complete');
    
    ctx.logger?.info('Analytics emit completed', { 
      queued: result.queued,
      reason: result.reason,
    });

    if (flags.json) {
      ctx.output?.json({
        ok: result.queued,
        event: {
          type: eventType,
          queued: result.queued,
          reason: result.reason,
        },
      });
      return result.queued ? { ok: true } : { ok: false, exitCode: 1 };
    }

    if (result.queued) {
      const items: string[] = [
        `${ctx.output?.ui.symbols.success} ${ctx.output?.ui.colors.success('Event emitted')}`,
        `Type: ${eventType}`,
      ];
      if (Object.keys(payload).length > 0) {
        items.push(`Payload: ${JSON.stringify(payload)}`);
      }

      const outputText = ctx.output?.ui.sideBox({
        title: 'Analytics Event',
        sections: [
          {
            items,
          },
        ],
        status: 'success',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);
      return { ok: true };
    } else {
      ctx.output?.error(new Error(`Failed to emit event: ${result.reason || 'Unknown error'}`));
      ctx.logger?.error('Failed to emit event', { reason: result.reason });
      return { ok: false, exitCode: 1 };
    }
  },
});

export async function emitCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}
