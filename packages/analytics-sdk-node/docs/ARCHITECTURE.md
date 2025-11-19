# Package Architecture Description: @kb-labs/analytics-sdk-node

**Version**: 0.1.0
**Last Updated**: 2025-11-16

## Executive Summary

**@kb-labs/analytics-sdk-node** provides an ergonomic Node.js SDK for KB Labs Analytics. It offers a simple, fire-and-forget API for emitting analytics events with automatic initialization, run scopes, and task helpers.

## 1. Package Overview

### 1.1 Purpose & Scope

**Primary Purpose**: Provide ergonomic Node.js SDK for analytics.

**Scope Boundaries**:
- **In Scope**: Ergonomic helpers, singleton instance, run scopes
- **Out of Scope**: Core analytics engine (in analytics-core), sinks (in analytics-adapters)

**Domain**: Analytics / SDK

### 1.2 Key Responsibilities

1. **Ergonomic API**: Simple, intuitive API for emitting events
2. **Automatic Initialization**: Lazy initialization with singleton pattern
3. **Run Scopes**: Group events by run/actor/context
4. **Task Helpers**: Lightweight helpers for common patterns

## 2. High-Level Architecture

### 2.1 Architecture Diagram

```
Analytics SDK Node
    │
    ├──► Singleton Instance (lazy-initialized)
    │   └──► Analytics class from analytics-core
    │
    ├──► Ergonomic Helpers
    │   ├──► emit(event)
    │   ├──► task(eventType, payload)
    │   └──► runScope(options, fn)
    │
    └──► Utility Functions
        ├──► getMetrics()
        ├──► getBackpressureState()
        ├──► flush()
        └──► dispose()
```

### 2.2 Architectural Style

- **Style**: Facade Pattern
- **Rationale**: Simple facade over analytics-core

## 3. Component Architecture

### 3.1 Component: Singleton Instance

- **Purpose**: Lazy-initialized analytics instance
- **Responsibilities**: Initialize on first use, provide singleton access
- **Dependencies**: analytics-core

### 3.2 Component: Ergonomic Helpers

- **Purpose**: Provide simple API
- **Responsibilities**: Wrap analytics-core with ergonomic helpers
- **Dependencies**: analytics-core

## 4. Data Flow

```
emit(event)
    │
    ├──► Get singleton instance
    ├──► Call analytics.emit(event)
    └──► return EmitResult

runScope(options, fn)
    │
    ├──► Get singleton instance
    ├──► Create run scope
    ├──► Execute function with scope.emit
    ├──► Finish scope
    └──► return result
```

## 5. Design Patterns

- **Facade Pattern**: Simple facade over analytics-core
- **Singleton Pattern**: Single instance per process
- **Lazy Initialization**: Initialize on first use

## 6. Performance Architecture

- **Time Complexity**: O(1) for emit, O(1) for runScope
- **Space Complexity**: O(1)
- **Bottlenecks**: Underlying analytics-core performance

## 7. Security Architecture

- **Fire-and-forget**: Never throws, always succeeds
- **PII Handling**: Handled by analytics-core middleware

---

**Last Updated**: 2025-11-16

