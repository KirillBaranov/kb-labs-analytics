# Package Architecture Description: @kb-labs/analytics-adapters

**Version**: 0.1.0
**Last Updated**: 2025-11-16

## Executive Summary

**@kb-labs/analytics-adapters** provides sink adapters for KB Labs Analytics. It includes file system sink, HTTP sink, S3 sink, and SQLite sink for storing analytics events.

## 1. Package Overview

### 1.1 Purpose & Scope

**Primary Purpose**: Provide sink adapters for analytics.

**Scope Boundaries**:
- **In Scope**: Sink implementations (FS, HTTP, S3, SQLite)
- **Out of Scope**: Core analytics pipeline (in analytics-core), CLI commands (in analytics-cli)

**Domain**: Analytics / Sink Adapters

### 1.2 Key Responsibilities

1. **File System Sink**: Write events to local files
2. **HTTP Sink**: Send events to HTTP endpoints
3. **S3 Sink**: Store events in S3
4. **SQLite Sink**: Store events in SQLite database

## 2. High-Level Architecture

### 2.1 Architecture Diagram

```
Analytics Adapters
    │
    ├──► File System Sink (sinks/fs.ts)
    │   └──► Write to JSONL files
    │
    ├──► HTTP Sink (sinks/http.ts)
    │   └──► POST to HTTP endpoints
    │
    ├──► S3 Sink (sinks/s3.ts)
    │   └──► Store in S3 buckets
    │
    └──► SQLite Sink (sinks/sqlite.ts)
        └──► Store in SQLite database
```

### 2.2 Architectural Style

- **Style**: Adapter Pattern
- **Rationale**: Adapt different storage backends to unified sink interface

## 3. Component Architecture

### 3.1 Component: File System Sink

- **Purpose**: Write events to local files
- **Responsibilities**: Append events to JSONL files
- **Dependencies**: fs

### 3.2 Component: HTTP Sink

- **Purpose**: Send events to HTTP endpoints
- **Responsibilities**: POST events to HTTP endpoints
- **Dependencies**: fetch

### 3.3 Component: S3 Sink

- **Purpose**: Store events in S3
- **Responsibilities**: Upload events to S3 buckets
- **Dependencies**: @aws-sdk/client-s3

### 3.4 Component: SQLite Sink

- **Purpose**: Store events in SQLite database
- **Responsibilities**: Insert events into SQLite database
- **Dependencies**: better-sqlite3

## 4. Data Flow

```
sink.write(event)
    │
    ├──► Validate event
    ├──► Format event (JSONL/JSON/etc)
    ├──► Write to storage (FS/HTTP/S3/SQLite)
    └──► return result
```

## 5. Design Patterns

- **Adapter Pattern**: Adapt different storage backends to unified interface
- **Strategy Pattern**: Different sinks as strategies

## 6. Performance Architecture

- **Time Complexity**: O(1) for sink write, O(n) for batch writes
- **Space Complexity**: O(1)
- **Bottlenecks**: Network I/O for HTTP/S3 sinks

## 7. Security Architecture

- **S3 Credentials**: Secure credential handling
- **HTTP Headers**: Secure header transmission
- **File Permissions**: Secure file permissions

---

**Last Updated**: 2025-11-16

