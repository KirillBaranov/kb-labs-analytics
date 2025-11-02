# ADR-0013: PII Hashing Strategy

**Date:** 2025-10-31
**Status:** Accepted
**Deciders:** KB Labs Team
**Last Reviewed:** 2025-11-03
**Tags:** [security, data]

## Context

KB Labs Analytics must protect user privacy while maintaining analytics value:
- **GDPR compliance**: Anonymize personal data
- **CCPA compliance**: Reduce PII exposure
- **SOC 2**: Data protection requirements
- **Analytics value**: Hash must be reversible for correlation (via salt)

We need:
- **Strong hashing**: Prevent reverse engineering
- **Salt management**: Rotate salts for security
- **Field-level hashing**: Only hash specific fields
- **Audit trail**: Track hashing algorithm and salt ID

Alternatives considered:
- No PII hashing (rejected - privacy violation)
- Encryption (rejected - adds key management complexity)
- Full redaction (rejected - loses analytics value)
- One-way hash only (rejected - no correlation possible)

## Decision

Use **HMAC-SHA256 with configurable salt** for PII hashing:
- **Algorithm**: HMAC-SHA256 (keyed hash)
- **Salt source**: Environment variable (`KB_ANALYTICS_SALT`)
- **Salt rotation**: Configurable interval (`rotateAfterDays`)
- **Field-level**: Hash only configured fields (`pii.fields`)
- **Metadata**: Store `hashMeta` in event (algo, saltId)

### Hashing Process

```
PII Field Value (e.g., "user-123")
    │
    ▼
HMAC-SHA256(salt, value)
    │
    ▼
"hmac-sha256:abc123def456..."
    │
    ▼
Replace original value in event
    │
    ▼
Add hashMeta { algo: "hmac-sha256", saltId: "salt-v1-2024-01" }
```

### Salt Management

- **Initial salt**: From environment variable `KB_ANALYTICS_SALT`
- **Salt ID**: Generated on first use (format: `salt-v{N}-{YYYY-MM}`)
- **Rotation**: New salt ID generated after `rotateAfterDays`
- **Historical queries**: Old hashes remain valid (multiple salts active)

### Hash Format

Hashed values prefixed with algorithm:

```
Original: "user-123"
Hashed: "hmac-sha256:abc123def456..."
```

## Consequences

### Positive

- **Privacy**: PII anonymized while maintaining correlation
- **Compliance**: GDPR/CCPA compliant anonymization
- **Reversibility**: Can correlate events with same salt (for analytics)
- **Audit trail**: `hashMeta` tracks algorithm and salt ID
- **Flexibility**: Field-level configuration

### Negative

- **Salt management**: Must securely store and rotate salts
- **Correlation complexity**: Need salt to correlate hashed values
- **Performance**: HMAC-SHA256 adds minimal overhead

### Alternatives Considered

- **SHA-256 only**: Rejected - no key management
- **AES encryption**: Rejected - adds key management complexity
- **Full redaction**: Rejected - loses analytics value
- **K-anonymity**: Rejected - too complex for MVP

## Implementation

Located in `@kb-labs/analytics-core/src/middleware/hash-pii.ts`:

- `PIIHashMiddleware` processes events
- Extracts PII fields via JSON paths
- Hashes values using HMAC-SHA256
- Adds `hashMeta` to event

### Configuration

```json
{
  "pii": {
    "hash": {
      "enabled": true,
      "saltEnv": "KB_ANALYTICS_SALT",
      "rotateAfterDays": 30
    },
    "fields": [
      "actor.id",
      "actor.email",
      "ctx.user",
      "payload.userId"
    ]
  }
}
```

### Environment Variable

```bash
export KB_ANALYTICS_SALT=your-secret-salt-value
```

### Example

**Before:**
```json
{
  "actor": { "id": "user-123" },
  "payload": { "email": "user@example.com" }
}
```

**After:**
```json
{
  "actor": { "id": "hmac-sha256:abc123..." },
  "payload": { "email": "hmac-sha256:def456..." },
  "hashMeta": {
    "algo": "hmac-sha256",
    "saltId": "salt-v1-2024-10"
  }
}
```

## References

- [HMAC](https://en.wikipedia.org/wiki/HMAC)
- [GDPR Compliance](https://gdpr.eu/)
- Related: ADR-0011 (Middleware Pipeline)

