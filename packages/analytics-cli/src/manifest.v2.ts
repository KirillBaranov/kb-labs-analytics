import type { ManifestV2 } from '@kb-labs/sdk';
import { defineManifest } from '@kb-labs/sdk';
import { pluginContractsManifest } from '@kb-labs/analytics-contracts';

/**
 * Level 2: Типизация через contracts для автодополнения и проверки ID
 */

const fileAllowList = ['.kb/analytics/**', '.kb/devkit/**', 'package.json', '**/package.json'];
const fileDenyList = ['**/*.key', '**/*.secret'];

type CliCommands = NonNullable<ManifestV2['cli']>['commands'];

const commands: CliCommands = [
  {
    manifestVersion: '1.0',
    id: 'emit',
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
    handler: './cli/commands/emit#emitCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'tail',
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
    handler: './cli/commands/tail#tailCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'flush',
    group: 'analytics',
    describe: 'Force flush buffer to sinks',
    longDescription: 'Force flush all buffered events to configured sinks',
    flags: [],
    examples: ['kb analytics flush'],
    handler: './cli/commands/flush#runFlushCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'dlq',
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
    handler: './cli/commands/dlq#dlqCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'compact',
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
    handler: './cli/commands/compact#compactCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'status',
    group: 'analytics',
    describe: 'Show analytics status',
    longDescription: 'Show analytics status including buffer, sinks, and metrics',
    flags: [],
    examples: ['kb analytics status'],
    handler: './cli/commands/status#statusCommand',
  },
  {
    manifestVersion: '1.0',
    id: 'stats',
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
    handler: './cli/commands/stats#statsCommand',
  },
];

export const manifest = defineManifest({
  schema: 'kb.plugin/2',
  id: '@kb-labs/analytics',
  version: '0.1.0',
  display: {
    name: 'Analytics',
    description: 'Event capture, buffer management, and DLQ tools for KB Labs.',
    tags: ['analytics', 'events', 'buffer', 'dlq'],
  },
  setup: {
    handler: './setup/handler.js#run',
    describe: 'Prepare .kb/analytics/{buffer,dlq,logs} workspace.',
    permissions: {
      fs: {
        mode: 'readWrite',
        allow: fileAllowList,
        deny: fileDenyList,
      },
      net: 'none',
      env: {
        allow: ['NODE_ENV'],
      },
      quotas: {
        timeoutMs: 20000,
        memoryMb: 256,
        cpuMs: 5000,
      },
      capabilities: ['fs:read', 'fs:write'],
    },
  },
  cli: {
    commands,
  },
  rest: {
    basePath: '/v1/plugins/analytics',
    routes: [
      {
        method: 'GET',
        path: '/buffer/status',
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsBufferStatusSchema',
        },
        handler: './rest/handlers/buffer-handler.js#handleGetBufferStatus',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV'],
          },
          quotas: {
            timeoutMs: 5000,
            memoryMb: 128,
            cpuMs: 2000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/dlq/status',
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsDlqStatusSchema',
        },
        handler: './rest/handlers/dlq-handler.js#handleGetDlqStatus',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV'],
          },
          quotas: {
            timeoutMs: 5000,
            memoryMb: 128,
            cpuMs: 2000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/events',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsResponseSchema',
        },
        handler: './rest/handlers/events-handler.js#handleEvents',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/events-stats',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsStatsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsStatsResponseSchema',
        },
        handler: './rest/handlers/events-stats-handler.js#handleEventsStats',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/events-stats-bar',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsStatsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsStatsBarResponseSchema',
        },
        handler: './rest/handlers/events-stats-bar-handler.js#handleEventsStatsBar',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/overview-summary',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsStatsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsOverviewSummaryResponseSchema',
        },
        handler: './rest/handlers/overview-summary-handler.js#handleOverviewSummary',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/events-timeline',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsEventsTimelineQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsTimelineResponseSchema',
        },
        handler: './rest/handlers/events-timeline-handler.js#handleEventsTimeline',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/metrics',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsResponseSchema',
        },
        handler: './rest/handlers/metrics-handler.js#handleMetrics',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/metrics-latency',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsLatencyResponseSchema',
        },
        handler: './rest/handlers/metrics-latency-handler.js#handleMetricsLatency',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/metrics-throughput',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsThroughputResponseSchema',
        },
        handler: './rest/handlers/metrics-throughput-handler.js#handleMetricsThroughput',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/metrics-error-rate',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsMetricsErrorRateResponseSchema',
        },
        handler: './rest/handlers/metrics-error-rate-handler.js#handleMetricsErrorRate',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/usage',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageProductsResponseSchema',
        },
        handler: './rest/handlers/usage-handler.js#handleUsage',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/usage-workspaces',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageWorkspacesResponseSchema',
        },
        handler: './rest/handlers/usage-workspaces-handler.js#handleUsageWorkspaces',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/usage-users',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageUsersResponseSchema',
        },
        handler: './rest/handlers/usage-users-handler.js#handleUsageUsers',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/usage-top-users',
        input: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageQuerySchema',
        },
        output: {
          zod: './contracts/analytics.schema.js#AnalyticsUsageTopUsersResponseSchema',
        },
        handler: './rest/handlers/usage-top-users-handler.js#handleUsageTopUsers',
        permissions: {
          fs: {
            mode: 'read',
            allow: fileAllowList,
            deny: fileDenyList,
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV', 'KB_ANALYTICS_*'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 10000,
          },
          capabilities: ['fs:read'],
        },
      },
    ],
  },
  studio: {
    widgets: [
      {
        id: 'analytics.buffer',
        kind: 'infopanel',
        title: 'Analytics Buffer',
        description: 'Latest buffer segments and sizes showing current event storage state and file status.',
        data: {
          source: {
            type: 'rest',
            routeId: '/buffer/status',
            method: 'GET',
          },
        },
        options: {
          layout: 'sections',
          defaultCollapsed: false,
        },
        layoutHint: {
          w: 3, // Half width (3 out of 6 columns)
          h: 4,
          minW: 3,
          minH: 3,
        },
      },
      {
        id: 'analytics.dlq',
        kind: 'cardlist',
        title: 'DLQ Files',
        description: 'Dead-letter queue segments requiring attention with error details and retry information.',
        data: {
          source: {
            type: 'rest',
            routeId: '/dlq/status',
            method: 'GET',
          },
        },
        options: {
          layout: 'list',
        },
        layoutHint: {
          w: 3, // Half width (3 out of 6 columns)
          h: 4,
          minW: 3,
          minH: 3,
        },
      },
      // Events page widgets
      {
        id: 'analytics.events-table',
        kind: 'table',
        title: 'Events',
        description: 'Detailed list of analytics events with filtering, sorting, and pagination.',
        data: {
          source: {
            type: 'rest',
            routeId: '/events',
            method: 'GET',
          },
        },
        options: {
          pageSize: 20,
          sortable: true,
          stickyHeader: true,
        },
        layoutHint: {
          w: 3, // Full width
          h: 5,
          minW: 3,
        },
        order: 0,
      },
      {
        id: 'analytics.events-stats-pie',
        kind: 'chart',
        title: 'Top Event Types',
        description: 'Distribution of events by type showing the most common event categories.',
        data: {
          source: {
            type: 'rest',
            routeId: '/events-stats',
            method: 'GET',
          },
        },
        options: {
          chartType: 'pie',
          showLegend: true,
          showTooltip: true,
          showPercent: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 1, // 1/3 width
          h: 4,
          minW: 1,
        },
        order: 1,
      },
      {
        id: 'analytics.events-products-bar',
        kind: 'chart',
        title: 'Events by Product',
        description: 'Event distribution across different products and services.',
        data: {
          source: {
            type: 'rest',
            routeId: '/events-stats-bar',
            method: 'GET',
          },
        },
        options: {
          chartType: 'bar',
          showLegend: false,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 1, // 1/3 width
          h: 4,
          minW: 1,
        },
        order: 2,
      },
      {
        id: 'analytics.events-timeline',
        kind: 'chart',
        title: 'Events Timeline',
        description: 'Event volume trends over time with hourly granularity.',
        data: {
          source: {
            type: 'rest',
            routeId: '/events-timeline',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: false,
          showTooltip: true,
          height: 320,
        },
        layoutHint: {
          w: 1, // 1/3 width
          h: 4,
          minW: 1,
        },
        order: 3,
      },
      // Performance page widgets
      {
        id: 'analytics.metrics-kpi',
        kind: 'keyvalue',
        title: 'Performance Metrics',
        description: 'Real-time key performance indicators including throughput, latency percentiles, error rate, and system health metrics.',
        data: {
          source: {
            type: 'rest',
            routeId: '/metrics',
            method: 'GET',
          },
        },
        layoutHint: {
          w: 3, // Full width
          h: 2,
          minW: 3,
        },
        order: 0,
      },
      {
        id: 'analytics.metrics-latency',
        kind: 'chart',
        title: 'Latency Trends',
        description: 'Average, P50, and P95 latency metrics over time showing performance trends.',
        data: {
          source: {
            type: 'rest',
            routeId: '/metrics-latency',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: true,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 3, // Full width
          h: 4,
          minW: 3,
        },
        order: 1,
      },
      {
        id: 'analytics.metrics-throughput',
        kind: 'chart',
        title: 'Throughput',
        description: 'Events processed per hour showing system capacity and load patterns.',
        data: {
          source: {
            type: 'rest',
            routeId: '/metrics-throughput',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: false,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 2, // 2/3 width
          h: 4,
          minW: 2,
        },
        order: 2,
      },
      {
        id: 'analytics.metrics-errors',
        kind: 'chart',
        title: 'Error Rate',
        description: 'Error rate percentage over time indicating system reliability.',
        data: {
          source: {
            type: 'rest',
            routeId: '/metrics-error-rate',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: false,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 1, // 1/3 width
          h: 4,
          minW: 1,
        },
        order: 3,
      },
      // Usage page widgets
      {
        id: 'analytics.usage-products',
        kind: 'chart',
        title: 'Usage by Product',
        description: 'Event volume distribution across different products showing usage patterns.',
        data: {
          source: {
            type: 'rest',
            routeId: '/usage',
            method: 'GET',
          },
        },
        options: {
          chartType: 'bar',
          showLegend: false,
          showTooltip: true,
          height: 350,
        },
        layoutHint: {
          w: 2, // 2/3 width
          h: 4,
          minW: 2,
        },
        order: 0,
      },
      {
        id: 'analytics.usage-workspaces',
        kind: 'chart',
        title: 'Usage by Workspace',
        description: 'Event distribution across different workspaces showing workspace activity levels.',
        data: {
          source: {
            type: 'rest',
            routeId: '/usage-workspaces',
            method: 'GET',
          },
        },
        options: {
          chartType: 'bar',
          showLegend: false,
          showTooltip: true,
          height: 350,
        },
        layoutHint: {
          w: 1, // 1/3 width
          h: 4,
          minW: 1,
        },
        order: 1,
      },
      {
        id: 'analytics.usage-users',
        kind: 'chart',
        title: 'User Activity',
        description: 'User activity trends over time showing engagement patterns.',
        data: {
          source: {
            type: 'rest',
            routeId: '/usage-users',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: false,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 3, // Full width
          h: 4,
          minW: 3,
        },
        order: 2,
      },
      {
        id: 'analytics.usage-top-users',
        kind: 'table',
        title: 'Top Users',
        description: 'Most active users ranked by event volume with detailed activity metrics.',
        data: {
          source: {
            type: 'rest',
            routeId: '/usage-top-users',
            method: 'GET',
          },
        },
        options: {
          pageSize: 20,
          sortable: true,
          stickyHeader: true,
        },
        layoutHint: {
          w: 3, // Full width
          h: 5,
          minW: 3,
        },
        order: 3,
      },
      // Overview page widgets
      {
        id: 'analytics.overview-summary',
        kind: 'infopanel',
        title: 'Analytics Overview',
        description: 'Summary of key analytics metrics including event statistics, top event types, and product distribution.',
        data: {
          source: {
            type: 'rest',
            routeId: '/overview-summary',
            method: 'GET',
          },
        },
        options: {
          layout: 'sections',
          defaultCollapsed: false,
        },
        layoutHint: {
          w: 3, // Full width (3 columns out of 3 in lg layout)
          h: 3,
          minW: 3,
        },
        order: 0,
      },
      {
        id: 'analytics.overview-timeline',
        kind: 'chart',
        title: 'Events Timeline',
        description: 'Event volume over time showing trends and patterns.',
        data: {
          source: {
            type: 'rest',
            routeId: '/events-timeline',
            method: 'GET',
          },
        },
        options: {
          chartType: 'line',
          showLegend: false,
          showTooltip: true,
          // height не задан - график будет адаптивным
        },
        layoutHint: {
          w: 2, // 2/3 width (2 columns out of 3)
          h: 4,
          minW: 2,
        },
        order: 1,
      },
      {
        id: 'analytics.overview-metrics',
        kind: 'keyvalue',
        title: 'Key Metrics',
        description: 'Real-time performance indicators including throughput, latency, error rate, and system health.',
        data: {
          source: {
            type: 'rest',
            routeId: '/metrics',
            method: 'GET',
          },
        },
        layoutHint: {
          w: 1, // 1/3 width (1 column out of 3)
          h: 4,
          minW: 1,
        },
        order: 2,
      },
    ],
    menus: [
      {
        id: 'analytics-overview',
        label: 'Analytics · Overview',
        target: '/plugins/analytics/overview',
        order: 0,
      },
      {
        id: 'analytics-events',
        label: 'Analytics · Events',
        target: '/plugins/analytics/events',
        order: 1,
      },
      {
        id: 'analytics-performance',
        label: 'Analytics · Performance',
        target: '/plugins/analytics/performance',
        order: 2,
      },
      {
        id: 'analytics-usage',
        label: 'Analytics · Usage',
        target: '/plugins/analytics/usage',
        order: 3,
      },
    ],
    layouts: [
      {
        id: 'analytics.dashboard',
        kind: 'grid',
        title: 'Analytics Dashboard',
        description: 'Overview of buffer and DLQ state.',
        config: {
          cols: { sm: 2, md: 4, lg: 6 },
          rowHeight: 5,
        },
      },
      {
        id: 'analytics.overview',
        kind: 'grid',
        title: 'Analytics Overview',
        description: 'Summary of key analytics data.',
        config: {
          cols: { sm: 1, md: 2, lg: 3 },
          rowHeight: 10,
        },
        widgets: [
          'analytics.overview-summary',
          'analytics.overview-timeline',
          'analytics.overview-metrics',
        ],
      },
      {
        id: 'analytics.events',
        kind: 'grid',
        title: 'Events Analytics',
        description: 'Detailed view of analytics events.',
        config: {
          cols: { sm: 1, md: 2, lg: 3 },
          rowHeight: 10,
        },
        widgets: [
          'analytics.events-table',
          'analytics.events-stats-pie',
          'analytics.events-products-bar',
          'analytics.events-timeline',
        ],
      },
      {
        id: 'analytics.performance',
        kind: 'grid',
        title: 'Performance Analytics',
        description: 'Performance metrics and trends.',
        config: {
          cols: { sm: 1, md: 2, lg: 3 },
          rowHeight: 10,
        },
        widgets: [
          'analytics.metrics-kpi',
          'analytics.metrics-latency',
          'analytics.metrics-throughput',
          'analytics.metrics-errors',
        ],
      },
      {
        id: 'analytics.usage',
        kind: 'grid',
        title: 'Usage Analytics',
        description: 'Usage statistics by product, workspace, and users.',
        config: {
          cols: { sm: 1, md: 2, lg: 3 },
          rowHeight: 10,
        },
        widgets: [
          'analytics.usage-products',
          'analytics.usage-workspaces',
          'analytics.usage-users',
          'analytics.usage-top-users',
        ],
      },
    ],
  },
  capabilities: ['fs:read', 'fs:write'],
  permissions: {
    fs: {
      mode: 'readWrite',
      allow: [...fileAllowList, '**/*.yml', '**/*.yaml'],
      deny: [...fileDenyList, '**/node_modules/**'],
    },
    net: 'none',
    env: {
      allow: ['NODE_ENV', 'KB_CLI_VERSION', 'KB_ANALYTICS_*'],
    },
    quotas: {
      timeoutMs: 60000,
      memoryMb: 768,
      cpuMs: 25000,
    },
    capabilities: ['fs:read', 'fs:write'],
  },
  artifacts: [
    {
      id: 'analytics.buffer.jsonl',
      pathTemplate: '.kb/analytics/buffer/{file}',
      description: 'Buffered analytics events (JSONL).',
    },
    {
      id: 'analytics.dlq.jsonl',
      pathTemplate: '.kb/analytics/dlq/{file}',
      description: 'Dead-letter queue files awaiting replay.',
    },
  ],
});

export default manifest;

