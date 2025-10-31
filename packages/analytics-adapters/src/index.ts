/**
 * @kb-labs/analytics-adapters
 * Sinks and middleware adapters
 */

// FS Sink
export { FSSink } from './sinks/fs';
export type { FSSinkConfig } from './sinks/fs';

// HTTP Sink
export { HTTPSink } from './sinks/http';
export type { HTTPSinkConfig } from './sinks/http';

// S3 Sink
export { S3Sink } from './sinks/s3';
export type { S3SinkConfig } from './sinks/s3';

// SQLite Sink
export { SQLiteSink } from './sinks/sqlite';
export type { SQLiteSinkConfig } from './sinks/sqlite';

