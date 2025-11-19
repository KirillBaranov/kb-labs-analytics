import { z } from 'zod';

export const AnalyticsFileEntrySchema = z.object({
  file: z.string(),
  size: z.number(),
  mtime: z.string(),
});

export const AnalyticsBufferStatusSchema = z.object({
  totalFiles: z.number(),
  files: z.array(AnalyticsFileEntrySchema),
});

export const AnalyticsDlqStatusSchema = z.object({
  totalFiles: z.number(),
  files: z.array(AnalyticsFileEntrySchema),
});

// Query schemas for events endpoints
export const AnalyticsEventsQuerySchema = z.object({
  type: z.string().optional(),
  product: z.string().optional(),
  workspace: z.string().optional(),
  timeRange: z.string().optional(), // 'today' | 'week' | 'month' | ISO range
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const AnalyticsEventsStatsQuerySchema = z.object({
  timeRange: z.string().optional(),
  type: z.string().optional(),
  product: z.string().optional(),
  workspace: z.string().optional(),
});

export const AnalyticsEventsTimelineQuerySchema = z.object({
  timeRange: z.string().optional(),
  type: z.string().optional(),
  product: z.string().optional(),
  workspace: z.string().optional(),
  groupBy: z.string().optional(), // 'hour' | 'day' | 'week'
});

export const AnalyticsMetricsQuerySchema = z.object({
  timeRange: z.string().optional(),
  type: z.string().optional(),
  product: z.string().optional(),
  workspace: z.string().optional(),
});

export const AnalyticsUsageQuerySchema = z.object({
  timeRange: z.string().optional(),
  type: z.string().optional(),
  product: z.string().optional(),
  workspace: z.string().optional(),
});

// Response schemas
export const AnalyticsEventsResponseSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
});

export const AnalyticsEventsStatsResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsEventsStatsBarResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsTimelineResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsMetricsResponseSchema = z.object({
  items: z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number()]),
  })),
});

export const AnalyticsMetricsLatencyResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsMetricsThroughputResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsMetricsErrorRateResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsUsageProductsResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsUsageWorkspacesResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsUsageUsersResponseSchema = z.object({
  series: z.array(z.object({
    name: z.string(),
    points: z.array(z.object({
      x: z.string(),
      y: z.number(),
    })),
  })),
});

export const AnalyticsUsageTopUsersResponseSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
});

// InfoPanel format schema for overview-summary
export const AnalyticsOverviewSummaryResponseSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    data: z.unknown(), // Can be object, array, or primitive
    format: z.enum(['json', 'text', 'keyvalue']).optional(),
    collapsible: z.boolean().optional(),
  })),
});

export type AnalyticsBufferStatus = z.infer<typeof AnalyticsBufferStatusSchema>;
export type AnalyticsDlqStatus = z.infer<typeof AnalyticsDlqStatusSchema>;
export type AnalyticsEventsQuery = z.infer<typeof AnalyticsEventsQuerySchema>;
export type AnalyticsEventsResponse = z.infer<typeof AnalyticsEventsResponseSchema>;
export type AnalyticsEventsStatsResponse = z.infer<typeof AnalyticsEventsStatsResponseSchema>;
export type AnalyticsEventsStatsBarResponse = z.infer<typeof AnalyticsEventsStatsBarResponseSchema>;
export type AnalyticsTimelineResponse = z.infer<typeof AnalyticsTimelineResponseSchema>;
export type AnalyticsMetricsResponse = z.infer<typeof AnalyticsMetricsResponseSchema>;
export type AnalyticsMetricsLatencyResponse = z.infer<typeof AnalyticsMetricsLatencyResponseSchema>;
export type AnalyticsMetricsThroughputResponse = z.infer<typeof AnalyticsMetricsThroughputResponseSchema>;
export type AnalyticsMetricsErrorRateResponse = z.infer<typeof AnalyticsMetricsErrorRateResponseSchema>;
export type AnalyticsUsageProductsResponse = z.infer<typeof AnalyticsUsageProductsResponseSchema>;
export type AnalyticsUsageWorkspacesResponse = z.infer<typeof AnalyticsUsageWorkspacesResponseSchema>;
export type AnalyticsUsageUsersResponse = z.infer<typeof AnalyticsUsageUsersResponseSchema>;
export type AnalyticsUsageTopUsersResponse = z.infer<typeof AnalyticsUsageTopUsersResponseSchema>;
export type AnalyticsOverviewSummaryResponse = z.infer<typeof AnalyticsOverviewSummaryResponseSchema>;


