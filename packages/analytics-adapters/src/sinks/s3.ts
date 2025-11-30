/**
 * S3 Sink - Upload events to S3
 * Uses AWS SDK v3 for proper S3 operations
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { AnalyticsEventV1 } from '@kb-labs/analytics-contracts';
import type { SinkConfig } from '@kb-labs/analytics-contracts';

export interface S3SinkConfig extends SinkConfig {
  type: 's3';
  bucket?: string; // S3 bucket name (required)
  region?: string; // AWS region (default: us-east-1)
  keyPrefix?: string; // Key prefix for objects (default: "events/")
  accessKeyId?: string; // AWS access key (from env: AWS_ACCESS_KEY_ID)
  secretAccessKey?: string; // AWS secret key (from env: AWS_SECRET_ACCESS_KEY)
  endpoint?: string; // Custom S3 endpoint (for S3-compatible services)
  idempotencyKey?: string; // Metadata key for idempotency (default: "idempotency-key")
}

export class S3Sink {
  private config: {
    type: 's3';
    id?: string;
    bucket: string;
    region: string;
    keyPrefix: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    idempotencyKey: string;
  };
  private s3Client: S3Client;
  private writtenObjects = new Set<string>(); // Track uploaded object keys for idempotency

  constructor(config: S3SinkConfig) {
    if (!config.bucket) {
      throw new Error('S3Sink requires bucket configuration');
    }

    // Get credentials from config or environment
    const accessKeyId = (config.accessKeyId as string | undefined) || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      (config.secretAccessKey as string | undefined) || process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3Sink requires AWS credentials (accessKeyId and secretAccessKey)');
    }

    this.config = {
      type: 's3',
      id: config.id as string | undefined,
      bucket: config.bucket as string,
      region: (config.region as string | undefined) || 'us-east-1',
      keyPrefix: (config.keyPrefix as string | undefined) || 'events/',
      accessKeyId,
      secretAccessKey,
      endpoint: config.endpoint as string | undefined,
      idempotencyKey: (config.idempotencyKey as string | undefined) || 'idempotency-key',
    };

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId!,
        secretAccessKey: this.config.secretAccessKey!,
      },
      endpoint: this.config.endpoint,
    });
  }

  /**
   * Initialize sink
   */
  async init(): Promise<void> {
    // No initialization needed - S3 operations are stateless
  }

  /**
   * Write events to S3
   */
  async write(events: AnalyticsEventV1[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Generate object key with timestamp and event IDs
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const eventIds = events.map((e) => e.id).join('-').substring(0, 50);
    const key = `${this.config.keyPrefix}${timestamp}-${eventIds}.jsonl`;

    // Check idempotency
    if (this.writtenObjects.has(key)) {
      return; // Already uploaded
    }

    // Prepare JSONL content
    const content = events.map((event) => JSON.stringify(event)).join('\n') + '\n';
    const body = Buffer.from(content, 'utf-8');

    // Upload to S3
    await this.uploadToS3(key, body, events);

    // Mark as written
    this.writtenObjects.add(key);
  }

  /**
   * Upload data to S3 using AWS SDK v3
   */
  private async uploadToS3(key: string, body: Buffer, events: AnalyticsEventV1[]): Promise<void> {
    // Build metadata for idempotency
    const metadata: Record<string, string> = {
      [this.config.idempotencyKey]: events[0]?.id || `batch_${Date.now()}`,
    };

    // Prepare S3 PutObject command
    const input: PutObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/jsonl',
      Metadata: metadata,
      // Optional: enable server-side encryption
      // ServerSideEncryption: 'AES256',
    };

    const command = new PutObjectCommand(input);

    // Upload to S3
    await this.s3Client.send(command);
  }

  /**
   * Get idempotency key for event
   */
  getIdempotencyKey(event: AnalyticsEventV1): string {
    return event.id;
  }

  /**
   * Close sink
   */
  async close(): Promise<void> {
    // No cleanup needed
  }
}

