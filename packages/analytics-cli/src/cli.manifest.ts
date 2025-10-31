/**
 * Analytics CLI manifest
 */

// Local type definition to avoid external dependencies
export type CommandManifest = {
  manifestVersion: '1.0';
  id: string;
  aliases?: string[];
  group: string;
  describe: string;
  longDescription?: string;
  requires?: string[];
  flags?: FlagDefinition[];
  examples?: string[];
  loader: () => Promise<{ run: any }>;
};

export type FlagDefinition = {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  alias?: string;
  default?: any;
  description?: string;
  choices?: string[];
  required?: boolean;
};

export const commands: CommandManifest[] = [
  {
    manifestVersion: '1.0',
    id: 'analytics:emit',
    aliases: ['analytics-emit'],
    group: 'analytics',
    describe: 'Emit a test event',
    longDescription: 'Emit a test analytics event for debugging',
    flags: [
      {
        name: 'type',
        type: 'string',
        description: 'Event type (default: test.event)',
      },
      {
        name: 'payload',
        type: 'string',
        description: 'Event payload as JSON string',
      },
    ],
    examples: [
      'kb analytics emit',
      'kb analytics emit --type test.event --payload \'{"test": true}\'',
    ],
    loader: async () => {
      const mod = await import('./commands/emit.js');
      return { run: mod.run.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:tail',
    aliases: ['analytics-tail'],
    group: 'analytics',
    describe: 'Tail events from buffer',
    longDescription: 'Display events from buffer (optionally follow for new events)',
    flags: [
      {
        name: 'follow',
        type: 'boolean',
        alias: 'f',
        description: 'Follow file for new events',
      },
      {
        name: 'grep',
        type: 'string',
        description: 'Filter events by pattern (e.g. type=test.event)',
      },
    ],
    examples: [
      'kb analytics tail',
      'kb analytics tail --follow',
      'kb analytics tail --grep type=test.event',
    ],
    loader: async () => {
      const mod = await import('./commands/tail.js');
      return { run: mod.tail.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:flush',
    aliases: ['analytics-flush'],
    group: 'analytics',
    describe: 'Force flush buffer to sinks',
    longDescription: 'Force flush all buffered events to configured sinks',
    examples: ['kb analytics flush'],
    loader: async () => {
      const mod = await import('./commands/flush.js');
      return { run: mod.flushCommand.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:dlq',
    aliases: ['analytics-dlq'],
    group: 'analytics',
    describe: 'Dead-Letter Queue operations',
    longDescription: 'Manage and replay events from Dead-Letter Queue',
    flags: [
      {
        name: 'filter',
        type: 'string',
        description: 'Filter events by pattern (e.g. type=test.event)',
      },
    ],
    examples: [
      'kb analytics dlq list',
      'kb analytics dlq replay',
      'kb analytics dlq replay --filter type=test.event',
    ],
    loader: async () => {
      const mod = await import('./commands/dlq.js');
      return { run: mod.dlq.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:compact',
    aliases: ['analytics-compact'],
    group: 'analytics',
    describe: 'Compact old segments',
    longDescription: 'Compact old buffer segments based on retention policy',
    flags: [
      {
        name: 'dry-run',
        type: 'boolean',
        description: 'Show what would be deleted without actually deleting',
      },
    ],
    examples: ['kb analytics compact', 'kb analytics compact --dry-run'],
    loader: async () => {
      const mod = await import('./commands/compact.js');
      return { run: mod.compact.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:status',
    aliases: ['analytics-status'],
    group: 'analytics',
    describe: 'Show analytics status',
    longDescription: 'Show analytics status including buffer, sinks, and metrics',
    examples: ['kb analytics status'],
    loader: async () => {
      const mod = await import('./commands/status.js');
      return { run: mod.status.run };
    },
  },
  {
    manifestVersion: '1.0',
    id: 'analytics:stats',
    aliases: ['analytics-stats'],
    group: 'analytics',
    describe: 'Show metrics statistics',
    longDescription: 'Show analytics metrics with optional interval updates',
    flags: [
      {
        name: 'interval',
        type: 'string',
        description: 'Update interval (e.g. 5s, 10s)',
      },
    ],
    examples: ['kb analytics stats', 'kb analytics stats --interval 5s'],
    loader: async () => {
      const mod = await import('./commands/stats.js');
      return { run: mod.stats.run };
    },
  },
];

