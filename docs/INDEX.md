# Documentation

## Getting Started

- [Getting Started](GETTING_STARTED.md) — Build your first actor, send commands, and read state. Start here.

## Concepts and Design

- [Concepts](concepts.md) — How consequent implements event sourcing: actors, events, snapshots, vector clocks, divergence resolution, and the trade-offs involved.
- [Actor Models](actor-models.md) — Defining actor modules: metadata, state, command handlers, event handlers, predicates, and cross-type event aggregation.
- [Events](events.md) — Event structure, required and optional properties, and the metadata consequent attaches automatically.

## System Specification

- [Specification](SPECIFICATION.md) — Complete design specification: data structures, metadata semantics, adapter contracts, and all behavioral algorithms. Intended as a reference for reimplementation in other languages.

## I/O Adapter APIs

Consequent separates storage and infrastructure concerns into adapter interfaces. These documents describe the API contract each adapter must satisfy.

- [Storage Adapters](storage-adapters.md) — Actor store and event store APIs for durable persistence.
- [Cache Adapters](cache-adapters.md) — Actor cache and event cache APIs for read-through/write-through caching.
- [Search Adapter](search-adapter.md) — Search adapter API for querying actor state by indexed fields.
- [Message Adapter](message-adapter.md) — Message adapter API for plugging external transports (message buses, queues) into consequent.
- [Coordination Adapter](coordination-adapter.md) — Coordination adapter API for distributed mutual exclusion.
