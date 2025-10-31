# PII Handling

## Overview

KB Labs Analytics provides **built-in PII (Personally Identifiable Information) hashing** to protect user privacy while maintaining analytics value.

## PII Hashing

PII hashing uses **HMAC-SHA256** with a configurable salt to anonymize sensitive data:

```json
{
  "analytics": {
    "pii": {
      "hash": {
        "enabled": true,
        "saltEnv": "KB_ANALYTICS_SALT",
        "rotateAfterDays": 30
      },
      "fields": ["actor.id", "ctx.user"]
    }
  }
}
```

### How It Works

1. **Identify PII fields** via configuration (`pii.fields`)
2. **Extract values** from event JSON paths (e.g. `actor.id`)
3. **Hash values** using HMAC-SHA256 with salt
4. **Replace original values** with hashed versions
5. **Store metadata** in `hashMeta` field

### Example

**Before hashing:**
```json
{
  "id": "01234567-89ab-cdef-0123-456789abcdef",
  "type": "user.login",
  "actor": {
    "type": "user",
    "id": "user-123"
  },
  "payload": {
    "email": "user@example.com"
  }
}
```

**After hashing:**
```json
{
  "id": "01234567-89ab-cdef-0123-456789abcdef",
  "type": "user.login",
  "actor": {
    "type": "user",
    "id": "hmac-sha256:abc123def456..."
  },
  "payload": {
    "email": "user@example.com"
  },
  "hashMeta": {
    "algo": "hmac-sha256",
    "saltId": "salt-v1-2024-01"
  }
}
```

## Configuration

### Enable PII Hashing

```json
{
  "analytics": {
    "pii": {
      "hash": {
        "enabled": true,
        "saltEnv": "KB_ANALYTICS_SALT"
      }
    }
  }
}
```

### Specify PII Fields

Use JSON paths to specify which fields contain PII:

```json
{
  "analytics": {
    "pii": {
      "fields": [
        "actor.id",
        "actor.email",
        "ctx.user",
        "payload.userId",
        "payload.email"
      ]
    }
  }
}
```

### Salt Management

**Environment Variable:**

```bash
export KB_ANALYTICS_SALT=your-secret-salt-value
```

**Salt Rotation:**

```json
{
  "analytics": {
    "pii": {
      "hash": {
        "rotateAfterDays": 30
      }
    }
  }
}
```

When salt rotates, a new `saltId` is generated and stored in `hashMeta`. Old hashes remain valid for historical queries.

## Best Practices

### 1. Hash in Actor Field

Place PII in the `actor` field rather than `payload`:

```typescript
// Good
await emit({
  type: 'user.login',
  actor: { type: 'user', id: 'user-123' }, // Hashed automatically
  payload: { method: 'oauth' },
});

// Bad
await emit({
  type: 'user.login',
  payload: { userId: 'user-123' }, // Must explicitly configure
});
```

### 2. Avoid PII in Logs

**Never log events with PII in plain text:**

```typescript
// Bad
console.log('Event:', JSON.stringify(event)); // May contain PII

// Good
console.log('Event type:', event.type); // Only non-sensitive info
```

### 3. Use Consistent PII Fields

Standardize PII field names across products:

- `actor.id` - User/actor identifier
- `actor.email` - Email address
- `ctx.user` - User context
- `ctx.session` - Session identifier

### 4. Test PII Hashing

Verify PII hashing in development:

```bash
# Set test salt
export KB_ANALYTICS_SALT=test-salt

# Emit test event
kb analytics emit --type test.pii --payload '{"userId":"test-123"}'

# Check hashed output
kb analytics tail | grep test.pii
```

## Privacy Policy

### Default Policy: No PII in Logs

- **Never log events** with PII to console/files
- **Use structured logging** with redaction
- **Hash PII** before storing in buffers
- **Rotate salts** regularly for additional security

### Compliance

PII hashing helps with:
- **GDPR compliance** - Anonymization of personal data
- **CCPA compliance** - Reduced exposure of personal information
- **SOC 2** - Data protection requirements

### Audit Trail

The `hashMeta` field provides an audit trail:
- **Algorithm** used for hashing
- **Salt ID** for key rotation tracking
- **Timestamp** (via `ingestTs`) for compliance

## Redaction

In addition to hashing, use redaction for non-analytics-sensitive fields:

```json
{
  "analytics": {
    "middleware": {
      "redact": {
        "keys": ["password", "token", "secret", "apiKey"]
      }
    }
  }
}
```

Redacted fields are removed entirely (not hashed).

## Examples

### User Login Event

```typescript
await emit({
  type: 'user.login',
  actor: { type: 'user', id: 'user-123' }, // Hashed
  payload: {
    method: 'oauth',
    provider: 'github',
    success: true,
  },
});
```

### File Access Event

```typescript
await emit({
  type: 'file.accessed',
  actor: { type: 'user', id: 'user-123' }, // Hashed
  ctx: { workspace: 'my-workspace' },
  payload: {
    file: 'src/index.ts',
    action: 'read',
  },
});
```

