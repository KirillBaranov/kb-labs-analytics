import type { PluginContracts } from './types';
import { contractsSchemaId, contractsVersion } from './version';

/**
 * Analytics plugin contracts manifest
 * Level 2: Contracts типизация с as const для извлечения типов
 * 
 * Note: REST routes упрощены - можно доработать позже по мере необходимости
 */
export const pluginContractsManifest = {
  schema: contractsSchemaId,
  pluginId: '@kb-labs/analytics',
  contractsVersion,
  artifacts: {
    'analytics.buffer.jsonl': {
      id: 'analytics.buffer.jsonl',
      kind: 'jsonl',
      description: 'Buffered analytics events (JSONL).',
      pathPattern: '.kb/analytics/buffer/{file}',
      mediaType: 'application/x-ndjson',
    },
    'analytics.dlq.jsonl': {
      id: 'analytics.dlq.jsonl',
      kind: 'jsonl',
      description: 'Dead-letter queue files awaiting replay.',
      pathPattern: '.kb/analytics/dlq/{file}',
      mediaType: 'application/x-ndjson',
    },
  },
  commands: {
    'analytics:emit': {
      id: 'analytics:emit',
      description: 'Emit a test analytics event for debugging',
      examples: [
        'kb analytics emit',
        'kb analytics emit --type test.event --payload \'{"test": true}\'',
      ],
    },
    'analytics:tail': {
      id: 'analytics:tail',
      description: 'Display events from buffer (optionally follow for new events)',
      examples: [
        'kb analytics tail',
        'kb analytics tail --follow',
        'kb analytics tail --grep type=test.event',
      ],
    },
    'analytics:flush': {
      id: 'analytics:flush',
      description: 'Force flush all buffered events to configured sinks',
      examples: ['kb analytics flush'],
    },
    'analytics:dlq': {
      id: 'analytics:dlq',
      description: 'Manage and replay events from Dead-Letter Queue',
      examples: [
        'kb analytics dlq list',
        'kb analytics dlq replay',
        'kb analytics dlq replay --filter type=test.event',
      ],
    },
    'analytics:compact': {
      id: 'analytics:compact',
      description: 'Compact old buffer segments based on retention policy',
      examples: ['kb analytics compact', 'kb analytics compact --dry-run'],
    },
    'analytics:status': {
      id: 'analytics:status',
      description: 'Show analytics status including buffer, sinks, and metrics',
      examples: ['kb analytics status'],
    },
    'analytics:stats': {
      id: 'analytics:stats',
      description: 'Show analytics metrics with optional interval updates',
      examples: ['kb analytics stats', 'kb analytics stats --interval 5s'],
    },
  },
  api: {
    rest: {
      basePath: '/v1/plugins/analytics',
      routes: {
        'analytics.rest.buffer.status': {
          id: 'analytics.rest.buffer.status',
          method: 'GET',
          path: '/buffer/status',
          description: 'Get buffer status',
          response: {
            ref: './contracts/analytics.schema.js#AnalyticsBufferStatusSchema',
            format: 'zod',
          },
        },
        'analytics.rest.dlq.status': {
          id: 'analytics.rest.dlq.status',
          method: 'GET',
          path: '/dlq/status',
          description: 'Get DLQ status',
          response: {
            ref: './contracts/analytics.schema.js#AnalyticsDlqStatusSchema',
            format: 'zod',
          },
        },
        'analytics.rest.events': {
          id: 'analytics.rest.events',
          method: 'GET',
          path: '/events',
          description: 'Query analytics events',
          request: {
            ref: './contracts/analytics.schema.js#AnalyticsEventsQuerySchema',
            format: 'zod',
          },
          response: {
            ref: './contracts/analytics.schema.js#AnalyticsEventsResponseSchema',
            format: 'zod',
          },
        },
        // Note: Остальные ~29 REST routes можно добавить позже по мере необходимости
        // Сейчас включены только основные для базовой типизации
      },
    },
  },
} as const satisfies PluginContracts;

// Извлекаем типы для использования в других местах
export type PluginArtifactIds = keyof typeof pluginContractsManifest.artifacts;
export type PluginCommandIds = keyof typeof pluginContractsManifest.commands;
export type PluginRouteIds = typeof pluginContractsManifest.api extends { rest: { routes: infer R } }
  ? R extends Record<string, any>
    ? keyof R
    : never
  : never;

