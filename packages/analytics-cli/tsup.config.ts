import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node.js';
import globby from 'globby';

export default defineConfig({
  ...nodePreset,
  entry: [
    'src/index.ts',
    'src/manifest.v2.ts',
    'src/setup/handler.ts',
    'src/contracts/analytics.schema.ts',
    'src/rest/handlers/buffer-handler.ts',
    'src/rest/handlers/dlq-handler.ts',
    'src/rest/handlers/events-handler.ts',
    'src/rest/handlers/events-stats-handler.ts',
    'src/rest/handlers/events-stats-bar-handler.ts',
    'src/rest/handlers/events-timeline-handler.ts',
    'src/rest/handlers/overview-summary-handler.ts',
    'src/rest/handlers/metrics-handler.ts',
    'src/rest/handlers/metrics-latency-handler.ts',
    'src/rest/handlers/metrics-throughput-handler.ts',
    'src/rest/handlers/metrics-error-rate-handler.ts',
    'src/rest/handlers/usage-handler.ts',
    'src/rest/handlers/usage-products-handler.ts',
    'src/rest/handlers/usage-workspaces-handler.ts',
    'src/rest/handlers/usage-users-handler.ts',
    'src/rest/handlers/usage-top-users-handler.ts',
    ...globby.sync('src/cli/commands/*.ts'),
  ],
  tsconfig: "tsconfig.build.json", // Use build-specific tsconfig without paths
  // nodePreset already includes all workspace packages as external via tsup.external.json
});

