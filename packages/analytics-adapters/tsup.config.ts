import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node.js';

export default defineConfig({
  ...nodePreset,
  entry: {
    index: 'src/index.ts',
    'sinks/fs': 'src/sinks/fs.ts',
    'sinks/http': 'src/sinks/http.ts',
    'sinks/s3': 'src/sinks/s3.ts',
    'sinks/sqlite': 'src/sinks/sqlite.ts',
  },
  tsconfig: "tsconfig.build.json", // Use build-specific tsconfig without paths
  // nodePreset already includes all workspace packages as external via tsup.external.json
});

