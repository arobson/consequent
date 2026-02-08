# Consequent System Specification

This document captures the complete design of consequent: data structures, metadata semantics, adapter contracts, and behavioral algorithms. It is intended as a reference precise enough to reimplement the system in another language and achieve identical behavior. For the conceptual rationale, see [concepts](concepts.md). For a hands-on introduction, see [getting started](GETTING_STARTED.md).

## Table of Contents

- [1. Overview](#1-overview)
- [2. Data Structures](#2-data-structures)
  - [2.1 Actor Metadata](#21-actor-metadata)
  - [2.2 Actor State](#22-actor-state)
  - [2.3 Actor Instance](#23-actor-instance)
  - [2.4 Commands](#24-commands)
  - [2.5 Events](#25-events)
  - [2.6 Command Results](#26-command-results)
  - [2.7 Vector Clocks](#27-vector-clocks)
  - [2.8 Snapshots](#28-snapshots)
  - [2.9 Event Packs](#29-event-packs)
  - [2.10 ID Mapping](#210-id-mapping)
- [3. Handler Definitions](#3-handler-definitions)
  - [3.1 Handler Formats](#31-handler-formats)
  - [3.2 Predicates](#32-predicates)
  - [3.3 Argument Mapping](#33-argument-mapping)
  - [3.4 Handler Resolution](#34-handler-resolution)
- [4. Adapter Interfaces](#4-adapter-interfaces)
  - [4.1 Adapter Library Pattern](#41-adapter-library-pattern)
  - [4.2 Actor Store](#42-actor-store)
  - [4.3 Actor Cache](#43-actor-cache)
  - [4.4 Event Store](#44-event-store)
  - [4.5 Event Cache](#45-event-cache)
  - [4.6 Search Adapter](#46-search-adapter)
- [5. Algorithms](#5-algorithms)
  - [5.1 Initialization](#51-initialization)
  - [5.2 Actor Loading](#52-actor-loading)
  - [5.3 Command Dispatch](#53-command-dispatch)
  - [5.4 Event Enrichment](#54-event-enrichment)
  - [5.5 Event Application](#55-event-application)
  - [5.6 State Reconstruction](#56-state-reconstruction)
  - [5.7 Snapshotting](#57-snapshotting)
  - [5.8 Divergence Detection](#58-divergence-detection)
  - [5.9 Ancestor Resolution](#59-ancestor-resolution)
  - [5.10 Divergence Healing](#510-divergence-healing)
  - [5.11 Cross-Type Event Aggregation](#511-cross-type-event-aggregation)
  - [5.12 Search Indexing](#512-search-indexing)
  - [5.13 Event Streams](#513-event-streams)
  - [5.14 Concurrency Control](#514-concurrency-control)

---

## 1. Overview

Consequent is an actor-based event sourcing system. Actors receive commands that produce immutable events. Current state is derived by replaying events against an actor's initial state. Periodic snapshots bound the cost of replay. Vector clocks track causality across nodes, enabling automatic detection and resolution of state divergence caused by network partitions.

The system separates domain logic (pure functions for commands, events, and predicates) from infrastructure (storage, caching, search, messaging) through adapter interfaces. All I/O is asynchronous and adapter-based so that the core algorithms remain independent of any specific storage technology.

### Design Priorities

1. **Availability and partition tolerance** over strong consistency. The system is designed to continue operating during storage node failures, accepting that replicas may diverge and healing them after the fact.
2. **Uniform data access**. All state changes flow through the same command-event-snapshot pipeline regardless of the underlying storage.
3. **Testable domain logic**. Actor models are composed of plain functions with no framework dependencies.

---

## 2. Data Structures

### 2.1 Actor Metadata

Actor metadata is defined by the developer in the actor module and extended by the system during loading.

**Developer-defined fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `namespace` | string | yes | Groups related actors. Used by storage adapters to organize data. |
| `type` | string | yes | The actor's unique type name. Commands and events use this as a prefix. |
| `eventThreshold` | number | no | Number of events applied before a snapshot is created. Default: 50. |
| `identifiedBy` | string | yes | Name of the state field that acts as the business identifier. |
| `searchableBy` | string[] | no | State fields to index for search queries. Supports dot notation for nested fields. |
| `aggregateFrom` | string[] | no | Other actor types whose events this actor consumes. Populated automatically during loading from prefixed event handler keys. |
| `storeEventPack` | boolean | no | Whether to store event packs alongside snapshots. Default: false. |
| `snapshotOnRead` | boolean | no | Whether to create snapshots during read operations. Default: false. |

**System-managed fields (set during loading):**

| Field | Type | Description |
|---|---|---|
| `_actorTypes` | string[] | All actor types this actor handles commands for (derived from command handler keys). |
| `_eventTypes` | string[] | All event types this actor handles (derived from event handler keys). |
| `_eventsRead` | number | Running count of events applied during the current operation. Reset on each fetch. |

### 2.2 Actor State

State is a plain key-value object. The developer defines the initial shape. The system adds metadata fields prefixed with `_`.

**Developer-defined fields:**

The initial state object defines the default shape. When an actor is first fetched, this state is returned with the `identifiedBy` field populated from the request.

**System-managed state fields:**

| Field | Type | Description |
|---|---|---|
| `_id` | string | System-generated unique identifier (base-62 flake ID). Immutable once assigned. Used as the primary storage key. |
| `_vector` | string | Serialized vector clock representing the causal version of this state. Format: `"nodeId:count;nodeId:count"` with keys sorted alphabetically. |
| `_version` | number | Sum of all vector clock component values. Provides a single comparable version number. |
| `_ancestor` | string | The `_vector` of the previous snapshot. Used to walk the ancestor chain during divergence resolution. |
| `_eventsApplied` | number | Total number of events applied to produce this state (cumulative across snapshots). |
| `_lastEventId` | string | Flake ID of the most recently applied event. Used to fetch only newer events on subsequent reads. |
| `_lastCommandId` | string | Flake ID of the most recently processed command. |
| `_lastCommandHandledOn` | string | ISO 8601 timestamp of when the last command was processed. |
| `_lastEventAppliedOn` | string | ISO 8601 timestamp of when the last event was applied. |

### 2.3 Actor Instance

An actor instance is the runtime representation combining metadata, state, and handler definitions.

```
ActorInstance {
  actor: ActorMetadata
  state: Record<string, unknown>
  commands: Record<string, HandlerDefinition[]>
  events: Record<string, HandlerDefinition[]>
}
```

The `commands` and `events` maps use the fully qualified topic as the key (e.g., `"account.open"`, `"vehicle.departed"`). Each key maps to an array of handler definitions, evaluated in order.

### 2.4 Commands

A command is a message sent to an actor requesting a state change. Commands are processed through command handlers which produce events.

**Required fields:**

| Field | Type | Description |
|---|---|---|
| `type` | string | The command topic, formatted as `"actorType.commandName"`. Used to route the command to the correct handlers. Also accepted as `topic`. |

**Optional fields:**

| Field | Type | Description |
|---|---|---|
| `id` | string | Caller-supplied message ID. If absent, the system generates a flake ID. |

All other fields are application-defined and passed through to command handlers. When argument mapping is enabled, field names are matched to handler parameter names.

### 2.5 Events

An event is an immutable record of something that happened. Events are produced by command handlers, enriched with metadata by the system, stored permanently, and applied to actor state through event handlers.

**Application-defined fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Event type, formatted as `"actorType.eventName"`. The prefix identifies which actor type the event primarily belongs to. |

All other fields are application-defined and carry the data needed to apply the event to state.

**System-enriched metadata (added after command handler returns):**

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique flake ID for this event. Flake IDs are time-ordered and globally unique, providing both identity and a relative temporal ordering. |
| `_actorType` | string | The type of the actor this event primarily applies to (derived from the event `type` prefix). |
| `_actorId` | string | The business identifier of the actor instance this event applies to. |
| `_createdBy` | string | The type of the actor that produced this event. |
| `_createdById` | string | The `_id` (system ID) of the actor that produced this event. |
| `_createdByVector` | string | The serialized vector clock of the producing actor at the time the event was created. |
| `_createdByVersion` | number | The `_version` of the producing actor at the time the event was created. |
| `_createdOn` | string | ISO 8601 timestamp of when the event was created. |
| `_initiatedBy` | string | The `type`/`topic` of the command that triggered this event. |
| `_initiatedById` | string | The `id` of the command that triggered this event. |

**Optional application fields for cross-type events:**

| Field | Type | Description |
|---|---|---|
| `_actorId` | string | Override: explicitly set the target actor ID when producing events for a different actor type. |

When a command handler returns an event whose `type` prefix differs from the handling actor's type (e.g., a `trip` actor returns an event with `type: "vehicle.reserved"`), the system enriches `_actorType` from the prefix and attempts to resolve `_actorId` from the event's fields or the handler's state.

### 2.6 Command Results

After processing a command, the system returns one result per matching actor type.

**Successful result:**

| Field | Type | Description |
|---|---|---|
| `message` | Message | The original command message. |
| `actor` | ActorMetadata | Metadata of the actor that processed the command. |
| `state` | Record | The actor's state after applying all produced events. |
| `original` | Record | A clone of the actor's state before the command was processed. |
| `events` | Event[] | The events produced by the command, enriched with system metadata. |

**Rejected result:**

| Field | Type | Description |
|---|---|---|
| `rejected` | true | Indicates the command was rejected. |
| `reason` | Error | The error that caused the rejection. |
| `message` | Message | The original command message. |
| `actor` | ActorMetadata | Metadata of the actor. |
| `state` | Record | The actor's state at the time of rejection (unmodified). |

### 2.7 Vector Clocks

Vector clocks track causal history across nodes. Each node that creates a snapshot increments its own component.

**Representation:**

- In memory: `{ [nodeId: string]: number }`, e.g., `{ "web-1": 3, "web-2": 1 }`
- Serialized: `"web-1:3;web-2:1"` — keys sorted alphabetically, separated by semicolons, each key-value joined by colon.
- Version (scalar): sum of all values, e.g., `4`. Used for quick comparison but not sufficient for causality — two vectors can have the same version sum yet be concurrent.

**Operations:**

- **Increment**: `vector[nodeId] = (vector[nodeId] || 0) + 1`. Performed when a node creates a snapshot.
- **Parse**: string to object. Empty string produces empty object.
- **Stringify**: object to sorted string.
- **To version**: sum all values.

**Causality:**

Vector A "happens before" vector B if, for every node `n`, `A[n] <= B[n]` and for at least one node `n`, `A[n] < B[n]`.

If neither A happens-before B nor B happens-before A, the vectors are **concurrent** — this indicates divergence.

### 2.8 Snapshots

A snapshot is a persisted copy of an actor's state at a specific vector clock. Snapshots serve two purposes:

1. **Performance**: reduce the number of events that must be replayed on each read.
2. **Divergence resolution**: the `_ancestor` field links snapshots into a chain that can be walked to find common ancestors between divergent replicas.

A snapshot consists of the full actor state (including all system `_` fields) stored in the actor store. The key fields for snapshot identity are:

- `_id`: the actor's system ID
- `_vector`: the vector clock at snapshot time
- `_ancestor`: the `_vector` of the previous snapshot (forms the ancestor chain)

When a snapshot is created, the event pack (if enabled) is stored alongside it, keyed by `(_id, _vector)`.

### 2.9 Event Packs

An event pack is the complete set of events that were applied to produce a snapshot. It is stored as a single record keyed by the actor's system ID and vector clock.

**Purpose**: When resolving divergence, the system needs to replay events from a common ancestor forward. Event packs provide these events directly without querying the event log by time range.

**Storage key**: `"${actorId}-${vectorClock}"`

**Contents**: Array of events, in application order.

If the event store does not support event packs, the system falls back to querying events by `_lastEventId`.

### 2.10 ID Mapping

Consequent maintains a bidirectional mapping between business identifiers and system identifiers.

- **Business ID** (`identifiedBy` field): human-readable, potentially mutable (e.g., account number, email). This is what callers use to address actors.
- **System ID** (`_id`): a flake ID, immutable, monotonically increasing. This is the storage primary key.

The mapping is stored in both the actor store and actor cache:

- Forward: `businessId → systemId[]` (array because a business ID could be remapped over time)
- Reverse: `systemId → businessId[]`

When an `asOf` timestamp is provided, the mapping resolves the correct ID for that point in time.

When a command is sent to a business ID for which no system ID exists, the system generates a new system ID and creates the mapping.

---

## 3. Handler Definitions

### 3.1 Handler Formats

Handlers can be defined in three equivalent formats. All are normalized to the canonical form during loading.

**Canonical form (object):**

```
{
  when: boolean | string | predicate function,
  then: handler function,
  exclusive: boolean,   // default: true
  map: boolean          // default: true
}
```

**Array shorthand:**

```
[when, then, exclusive, map]
```

**Function only:**

Equivalent to `{ when: true, then: fn, exclusive: true, map: true }`.

A command or event key can map to a single handler or an array of handlers. Single handlers are wrapped in an array during normalization.

### 3.2 Predicates

The `when` field controls whether a handler is invoked.

| Value | Behavior |
|---|---|
| `true` | Always invoke the handler. |
| `false` | Never invoke the handler. |
| `"stateName"` (string) | Invoke if `instance.state.state === "stateName"`. This enables state-machine patterns. |
| `function(state, ...args)` | Invoke if the function returns truthy. Receives the same mapped arguments as the handler. |

### 3.3 Argument Mapping

When `map` is `true` (the default), the system inspects the handler function's parameter names and maps properties from the incoming message to those parameters by name. The first parameter always receives the actor state; subsequent parameter names are matched against message property names.

For example, a handler `function withdraw(account, amount)` receiving the message `{ type: "account.withdraw", amount: 50 }` will be called as `withdraw(state, 50)`.

When `map` is `false`, the handler receives `(state, message)` where `message` is the full message object.

This mapping is performed by `fauxdash.mapCall()`, which parses function parameter names at load time and generates a wrapper that extracts the matching properties.

### 3.4 Handler Resolution

For a given topic, the system resolves handlers as follows:

1. Look up the handler definitions array for the topic in the actor's `commands` (for commands) or `events` (for events).
2. For each definition in order, evaluate the `when` predicate against the current state and message.
3. If the predicate passes, add the handler to the execution list.
4. If `exclusive` is `true` (the default) and a predicate passed, stop evaluating further handlers.

This means the default behavior is "first match wins" — define handlers in priority order with the fallback last.

**Command handlers** return one event (object) or multiple events (array). The events are immediately applied to the actor's state through the event handlers before the command result is returned.

**Event handlers** mutate the state directly and return nothing. The system clones the state before passing it to event handlers, so mutations are safe.

---

## 4. Adapter Interfaces

### 4.1 Adapter Library Pattern

All adapters follow a factory pattern. Each adapter library exposes a `create(actorType)` method that returns a promise resolving to an adapter instance scoped to that actor type. This allows adapters to maintain per-type connections, tables, or indices.

```
AdapterLibrary<T> {
  create(type: string): Promise<T>
}
```

Adapters are created lazily on first use for each actor type and cached for subsequent operations.

### 4.2 Actor Store

Responsible for durable persistence of actor snapshots and ID mappings.

```
ActorStoreInstance {
  // Retrieve the latest snapshot for the given business ID.
  // MUST return an array if divergent replicas (siblings) exist.
  // Returns undefined/null if no snapshot exists.
  fetch(actorId): Promise<Record | Record[] | undefined>

  // Store a snapshot. Creates an ancestor record from the previous vector.
  // actorId: business ID
  // vectorClock: serialized vector clock string
  // state: the full actor state including system fields
  store(actorId, vectorClock, state): Promise<void>

  // Retrieve the snapshot as it existed after a specific event.
  // Optional — return undefined if not supported.
  fetchByLastEventId?(actorId, lastEventId): Promise<Record | undefined>

  // Retrieve the snapshot as it existed at a specific date.
  // Optional — return undefined if not supported.
  fetchByLastEventDate?(actorId, lastEventDate): Promise<Record | undefined>

  // Map a system ID to a business ID.
  mapIds?(systemId, actorId): Promise<void>

  // Resolve system ID from business ID.
  // Must return undefined if no mapping exists.
  getSystemId?(actorId, asOf?): Promise<string | undefined>

  // Resolve business ID from system ID.
  // Must return undefined if no mapping exists.
  getActorId?(systemId, asOf?): Promise<string | undefined>

  // Walk the ancestor chain to find a common ancestor for divergent replicas.
  // instances: the divergent actor snapshots (siblings)
  // excluded: vectors already visited (cycle detection)
  // Must detect cycles. Should resolve to the shared ancestor snapshot or undefined.
  findAncestor?(actorId, instances, excluded): Promise<Record | undefined>
}
```

**Critical behaviors:**

- `fetch` MUST return an array when multiple snapshots exist for the same business ID with different vector clocks (siblings). This is the signal that triggers divergence resolution.
- `store` must create an ancestor record: the previous `(_id, _vector)` must remain accessible for ancestor walking. Implementations typically append to a snapshot history rather than overwriting.
- `findAncestor` must detect cycles in the ancestor chain to prevent infinite loops.

### 4.3 Actor Cache

Optional read-through/write-through cache for actor snapshots. Interface is a subset of the actor store.

```
ActorCacheInstance {
  fetch(actorId): Promise<Record | undefined>
  store(actorId, vectorClock, state): Promise<void>
  getSystemId?(actorId, asOf?): Promise<string | undefined>
  mapIds?(systemId, actorId): Promise<void>
}
```

The system checks the cache before the store. A cache miss (returning `undefined`) causes a transparent fallback to the store.

The default implementation is a no-op that always returns `undefined`.

### 4.4 Event Store

Responsible for durable persistence of events and event packs.

```
EventStoreInstance {
  // Retrieve events for an actor since a specific event ID.
  // Events MUST be returned ordered by event ID (ascending).
  // If lastEventId is provided, only events with id > lastEventId are returned.
  getEventsFor(actorId, lastEventId?): Promise<Event[]>

  // Store events for an actor.
  storeEvents(actorId, events): Promise<void>

  // Retrieve a pre-packed set of events for a snapshot. Optional.
  // Key: the vector clock of the snapshot that produced the pack.
  getEventPackFor?(actorId, vectorClock): Promise<Event[] | undefined>

  // Store an event pack for a snapshot. Optional.
  storeEventPack?(actorId, vectorClock, events): Promise<void>

  // Return a generator/iterable of ordered events matching the options. Optional.
  getEventStreamFor?(actorId, options): Iterable<Event>

  // Find events by arbitrary criteria. Optional.
  findEvents?(criteria, lastEventId?): Promise<Event[]>

  // Find events by a named index. Optional.
  getEventsByIndex?(indexName, indexValue, lastEventId?): Promise<Event[]>
}
```

**Critical behaviors:**

- Events MUST be returned in ascending order by flake ID. Flake IDs are base-62 encoded 128-bit values that sort lexicographically in time order. Correct ordering is essential for deterministic state reconstruction.
- `storeEvents` is append-only. Events are immutable once stored.
- `getEventStreamFor` options:

| Option | Type | Description |
|---|---|---|
| `sinceId` | string | Start after this event ID (exclusive). |
| `since` | string | Start at this ISO 8601 date (inclusive). |
| `untilId` | string | Stop at this event ID (inclusive). |
| `until` | string | Stop at this date (inclusive). |
| `filter` | function | Predicate: `(event) => boolean`. True = include. |

### 4.5 Event Cache

Optional read-through/write-through cache for events. Interface matches the event store.

```
EventCacheInstance {
  getEventsFor(actorId, lastEventId?): Promise<Event[] | undefined>
  storeEvents(actorId, events): Promise<void>
  getEventPackFor?(actorId, vectorClock): Promise<Event[] | undefined>
  storeEventPack?(actorId, vectorClock, events): Promise<void>
}
```

The system checks the cache first. An empty result or `undefined` causes a fallback to the event store.

The default implementation returns empty arrays / `undefined`.

### 4.6 Search Adapter

Optional adapter for querying actor state by indexed fields.

```
SearchAdapterInstance {
  // Find actor IDs matching criteria.
  // Criteria is a hash of field names to predicates (see below).
  // Returns an array of matching actor business IDs.
  find(criteria): unknown[]

  // Update the search index after a command is processed.
  // fieldList: the searchableBy fields defined on the actor
  // updated: the actor's state after the command
  // original: the actor's state before the command
  update(fieldList, updated, original): Promise<void>
}
```

**Search predicates:**

| Predicate | Format | Meaning |
|---|---|---|
| Equal | `{ field: value }` | Exact match |
| Contains | `{ field: { contains: value } }` | Array contains value |
| Match | `{ field: { match: "pattern" } }` | Regex match |
| In | `{ field: { in: [values] } }` | Value in set |
| Not in | `{ field: { not: [values] } }` | Value not in set |
| Greater than | `{ field: { gt: value } }` | Strict greater than |
| Greater or equal | `{ field: { gte: value } }` | Greater than or equal |
| Less than | `{ field: { lt: value } }` | Strict less than |
| Less or equal | `{ field: { lte: value } }` | Less than or equal |
| Between | `{ field: [lower, upper] }` | Exclusive bounds |

Multiple fields in a single criteria object are AND'd together. The `find` method on the search adapter receives a single criteria object.

The search index is updated eagerly after every command — not just at snapshot time — so search results reflect the most recent state.

---

## 5. Algorithms

### 5.1 Initialization

```
initialize(config):
  1. Configure logging (pino, level from config.logging or 'silent')
  2. Apply default adapters for any not provided:
     - actorStore: in-memory
     - actorCache: no-op
     - eventStore: in-memory
     - eventCache: no-op
     - searchAdapter: in-memory
  3. Initialize DI container (fount) if not provided
  4. Create concurrency queue (haberdasher hash queue, default limit 8)
  5. Load actor modules (see 5.2)
  6. Generate flake ID provider seeded with hostname:pid
  7. Build subscription maps:
     - topic → [actor types] lookup for command routing
     - collect all topics across all actor types
  8. Compose internal modules:
     - actorAdapter: wraps actor store + cache with ID mapping and snapshot logic
     - eventAdapter: wraps event store + cache
     - manager: orchestrates fetch, apply, snapshot
     - search: wraps search adapter
     - dispatcher: routes commands through manager and search
     - streamBuilder: provides async generators for state/event streams
  9. Return public API
```

### 5.2 Actor Loading

```
loadActors(fount, actorsConfig):
  1. Resolve actor source:
     - string: glob the directory for files matching "*_actor.js"
     - array: use directly
     - object: extract values
     - function: call and process result
  2. For each actor module:
     a. Import the module (dynamic import)
     b. Inject dependencies through fount (DI container calls the exported function)
     c. Receive the { actor, state, commands, events } definition
  3. Normalize all handler definitions (see processHandles below)
  4. Build ActorMap: type → { factory, metadata }

processHandles(instance):
  For each key in instance.commands and instance.events:
    1. If the key contains no ".", prefix it with the actor's type + "."
       e.g., "open" becomes "account.open"
    2. Normalize the value to an array of HandlerDefinition objects
    3. For each handler:
       - Function → { when: true, then: fn, exclusive: true, map: true }
       - Array → { when: arr[0], then: arr[1], exclusive: arr[2] ?? true, map: arr[3] ?? true }
       - Object → fill defaults for missing fields
    4. If map is true, wrap the handler's `then` and `when` functions
       with fauxdash.mapCall() to enable argument mapping
  Collect _actorTypes from command key prefixes
  Collect _eventTypes from event key prefixes
  For any event key prefixed with a different actor type, add that type
  to aggregateFrom (if not already present)
```

### 5.3 Command Dispatch

This is the primary write path.

```
handle(id, topic, command):
  1. Look up which actor types handle this topic
     lookup[topic] → [type1, type2, ...]
  2. For each matching actor type:
     a. Fetch or create the actor instance:
        manager.getOrCreate(type, id)
          i.   Resolve system ID from business ID (cache, then store)
          ii.  If no system ID exists: generate one (flake), create mapping
          iii. Fetch latest snapshot (cache, then store)
          iv.  If snapshot is an array → divergent replicas detected (see 5.8)
          v.   Fetch events since snapshot's _lastEventId
          vi.  Apply events to state (see 5.5)
          vii. If actor has aggregateFrom types, fetch and apply their events too (see 5.11)
          viii. Evaluate snapshot threshold (see 5.7)
     b. Apply the command:
        apply(actors, queue, topic, command, instance)
          i.   Resolve matching command handlers (see 3.4)
          ii.  Enqueue execution in the concurrency queue, keyed by actor ID
          iii. Clone the current state as "original"
          iv.  Call the handler: result = handler(state, ...mappedArgs)
          v.   result is one event or an array of events
          vi.  Apply each produced event to the state immediately (see 5.5)
          vii. Return CommandResult { message, actor, state, original, events }
          viii. On error: return { rejected: true, reason: error, message, actor, state }
  3. Enrich events with metadata (see 5.4)
  4. Store events:
     For each event, grouped by (_actorType, _actorId):
       eventAdapter.store(type, actorId, events)
         → store to both event store and event cache
  5. Update search indices:
     For each result with searchableBy fields:
       searchAdapter.update(searchableBy, result.state, result.original)
  6. Return array of CommandResults
```

### 5.4 Event Enrichment

After a command handler returns events, the system adds metadata to each event before storage.

```
enrichEvent(flakes, actorInstance, command, event):
  event.id = flakes()                              // unique, time-ordered ID
  event._createdOn = new Date().toISOString()       // timestamp

  // Determine target actor type from event type prefix
  typeParts = event.type.split(".")
  event._actorType = typeParts[0]

  // If the event targets the same actor type that handled the command:
  if event._actorType == actorInstance.actor.type:
    event._actorId = state[identifiedBy]
    event._createdBy = actorInstance.actor.type
    event._createdById = state._id
  else:
    // Cross-type event: resolve target actor ID from event fields or state
    event._actorId = event._actorId || resolveActorId(event, state)
    event._createdBy = actorInstance.actor.type
    event._createdById = state._id

  event._createdByVector = state._vector
  event._createdByVersion = state._version
  event._initiatedBy = command.type || command.topic
  event._initiatedById = command.id
```

### 5.5 Event Application

Events are applied to actor state through event handlers. This occurs in two contexts: during state reconstruction (replaying stored events) and during command processing (applying freshly produced events).

```
applyEvent(actors, instance, event):
  topic = event.type
  handlers = resolveEventHandlers(instance, topic, event)
  for each handler in handlers:
    handler(instance.state, ...mappedEventArgs)
  // Update tracking fields:
  instance.state._lastEventId = event.id
  instance.state._lastEventAppliedOn = event._createdOn || now
  instance.state._eventsApplied = (instance.state._eventsApplied || 0) + 1
  instance.actor._eventsRead = (instance.actor._eventsRead || 0) + 1

  // For cross-type events, track related actor metadata:
  if event._actorType != instance.actor.type:
    instance.state._related = instance.state._related || {}
    instance.state._related[event._actorType] = {
      _lastEventId: event.id,
      _lastEventAppliedOn: event._createdOn
    }
```

Events MUST be applied in ascending order by event ID. The system sorts all fetched events by ID before application.

### 5.6 State Reconstruction

When an actor's current state is requested, the system reconstructs it from the latest snapshot plus subsequent events.

```
getOrCreate(type, id, readOnly?):
  1. systemId = resolveSystemId(type, id)
     - Check actor cache: cache.getSystemId(id)
     - Check actor store: store.getSystemId(id)
     - If not found and not readOnly: generate new flake ID, mapIds(systemId, id)
     - If not found and readOnly: return initial state with id populated

  2. snapshot = fetchSnapshot(type, systemId)
     - Check actor cache: cache.fetch(systemId)
     - Check actor store: store.fetch(systemId)
     - If array: divergent replicas (see 5.8)
     - If undefined: use initial state

  3. events = fetchEventsSinceSnapshot(type, systemId, snapshot._lastEventId)
     - Check event cache: cache.getEventsFor(systemId, lastEventId)
     - Check event store: store.getEventsFor(systemId, lastEventId)
     - Sort by event ID ascending

  4. If actor.aggregateFrom is non-empty:
     For each source type in aggregateFrom:
       sourceIds = resolveSourceIds(instance, sourceType, id)
       sourceEvents = fetchEvents(sourceType, sourceIds, lastRelatedEventId)
       Merge sourceEvents into events array

  5. Sort ALL events by ID ascending

  6. For each event:
     applyEvent(actors, instance, event)

  7. Evaluate snapshot threshold (see 5.7)

  8. Return instance
```

### 5.7 Snapshotting

Snapshots are created when the number of events applied exceeds the configured threshold.

```
evaluateSnapshot(instance, events, readOnly):
  threshold = instance.actor.eventThreshold || 50
  eventsRead = instance.actor._eventsRead || 0
  totalApplied = events.length + eventsRead

  shouldSnapshot = false
  if instance.actor.snapshotOnRead:
    shouldSnapshot = totalApplied >= threshold
  else if not readOnly:
    shouldSnapshot = totalApplied >= threshold
  else:
    shouldSnapshot = false

  if shouldSnapshot:
    createSnapshot(instance, events)

createSnapshot(instance, events):
  // Record the ancestor: the current vector BEFORE incrementing
  previousVector = instance.state._vector

  // Increment vector clock for this node
  vector = parse(instance.state._vector || "")
  increment(vector, nodeId)
  instance.state._vector = stringify(vector)
  instance.state._version = toVersion(stringify(vector))
  instance.state._ancestor = previousVector

  // Generate snapshot ID
  snapshotId = flakes()

  // Persist snapshot
  actorStore.store(instance.state._id, instance.state._vector, instance.state)
  actorCache.store(instance.state._id, instance.state._vector, instance.state)

  // Persist event pack (if enabled)
  if instance.actor.storeEventPack:
    allEvents = fetchEventsSince(lastEventIdBeforeThisBatch) + events
    // Deduplicate by event ID
    eventStore.storeEventPack(instance.state._id, instance.state._vector, allEvents)
    eventCache.storeEventPack(instance.state._id, instance.state._vector, allEvents)

  // Reset tracking
  instance.actor._eventsRead = 0
```

### 5.8 Divergence Detection

Divergence occurs when two or more nodes create snapshots for the same actor independently — typically during a network partition. Each node increments a different component of the vector clock, producing vectors that are concurrent (neither happens-before the other).

**Detection:**

The actor store's `fetch` method is responsible for detecting siblings. When multiple snapshots exist for the same business ID with concurrent vector clocks, `fetch` MUST return them as an array.

```
When actorStore.fetch(id) returns an array:
  → The actor has divergent replicas
  → The system must resolve the divergence before returning state
```

### 5.9 Ancestor Resolution

When divergent replicas are detected, the system walks the ancestor chain to find the most recent common ancestor — the last snapshot that existed before the partition occurred.

```
findAncestor(actorId, siblings, excluded):
  // siblings: array of divergent actor snapshots
  // excluded: set of vectors already visited (cycle detection)

  For each sibling:
    Walk the _ancestor chain:
      current = sibling
      while current._ancestor:
        if current._ancestor in excluded:
          break  // cycle detected
        excluded.add(current._vector)
        ancestor = store.fetch(actorId, current._ancestor)  // fetch by vector
        if ancestor is shared by all siblings' ancestor chains:
          return ancestor
        current = ancestor

  // The common ancestor is the snapshot where all divergent chains converge.
  // This is the "fork point" — the last known-good state before the partition.
```

The ancestor chain is formed by each snapshot's `_ancestor` field pointing to the `_vector` of the previous snapshot. This creates a linked list of snapshots that can be traversed to find shared history.

### 5.10 Divergence Healing

Once the common ancestor is found, the system heals the divergence by replaying all events that occurred across all replicas since that ancestor.

```
healDivergence(actorId, siblings, ancestor):
  1. Start with the ancestor's state as the baseline

  2. Collect ALL events since the ancestor:
     If event packs are available:
       For each sibling:
         events += eventStore.getEventPackFor(actorId, sibling._vector)
     Else:
       events = eventStore.getEventsFor(actorId, ancestor._lastEventId)

  3. Deduplicate events by event ID
     (The same event may appear in multiple replicas' histories)

  4. Sort all events by event ID ascending
     (Flake IDs provide a deterministic global order)

  5. Apply all events to the ancestor state in order:
     For each event:
       applyEvent(actors, instance, event)

  6. Create a new snapshot from the healed state
     (This snapshot's vector clock will dominate all siblings' vectors)

  7. Return the healed instance
```

**Why this works:**

- Flake IDs are time-ordered and globally unique, so sorting by ID produces a deterministic total order regardless of which node generated each event.
- Event handlers are deterministic functions of `(state, event)`, so replaying the same events in the same order always produces the same state.
- The healed snapshot's vector clock is the merge (component-wise maximum) of all siblings' vectors, so it dominates all of them and future reads will see only this snapshot.

This is analogous to merging divergent git branches by rewinding to the fork point and replaying all commits in timestamp order.

### 5.11 Cross-Type Event Aggregation

Actors can consume events from other actor types. This is configured through the `aggregateFrom` metadata (populated automatically when event handler keys use a different type prefix).

```
aggregateEvents(instance, type, id):
  For each sourceType in instance.actor.aggregateFrom:
    // Determine which instances of the source type are related
    sourceIds = resolveSourceIds(instance.state, sourceType, id)

    // Get the last event ID we've already applied from this source
    lastApplied = instance.state._related?.[sourceType]?._lastEventId

    // Fetch new events from the source type
    sourceEvents = eventAdapter.fetch(sourceType, sourceIds, lastApplied)

    // These events are merged into the main event list and sorted
    // by ID before application, ensuring correct causal ordering
    // across types

resolveSourceIds(state, sourceType, fallbackId):
  // Try multiple naming conventions to find related IDs:
  1. state[sourceType]?.id          → single related object with id
  2. state[plural(sourceType)]      → array of objects with id fields
  3. state[sourceType + "Id"]       → single related ID
  4. state[plural(sourceType + "Id")] or state[sourceType + "Ids"]
                                    → array of related IDs
  5. fallback to the passed id
```

This mechanism enables **view models** — actors that produce no events of their own but build state by aggregating events from several source types.

### 5.12 Search Indexing

After every command, if the actor defines `searchableBy` fields, the search adapter is updated with the new state.

```
updateSearchIndex(type, searchableBy, newState, originalState):
  searchAdapter.update(searchableBy, newState, originalState)

  // The adapter extracts values for each field in searchableBy
  // from both old and new state, updates its indices accordingly.
  // Supports dot-notation fields (e.g., "vehicle.location").
```

Search updates happen immediately after command processing — not deferred to snapshot time. This means search results always reflect the most recent command's effects.

### 5.13 Event Streams

Consequent provides two streaming interfaces for reading event/state history.

**Actor stream** — yields successive state snapshots as events are applied:

```
getActorStream(type, id, options):
  1. Fetch the actor baseline (as of sinceId or since date)
  2. Yield the baseline state
  3. Fetch the event stream for this actor (options control time range)
  4. For each event:
     Apply event to state
     If event type matches eventTypes filter (or no filter):
       Yield the updated state
```

**Event stream** — yields raw events across one or more actor types:

```
getEventStream(options):
  // options.actorTypes, options.actors, or options.actorId specify sources
  // Maintains a per-type queue to ensure causal ordering across types

  For each source type:
    Fetch event stream from event store
    Enqueue events

  Merge queues:
    Yield events in ID order across all queues
    Minimum queue depth of 2 before yielding (ensures ordering)
    At end-of-stream, drain remaining events in order
```

Both interfaces respect the `sinceId`/`since`/`untilId`/`until`/`filter`/`eventTypes` options described in section 4.4.

### 5.14 Concurrency Control

Commands are serialized per actor ID using a hash queue (haberdasher). This ensures that no two commands for the same actor are processed simultaneously on the same node.

```
queue.add(actorId, () => processCommand(...))
```

The queue has a configurable concurrency limit (default: 8) controlling how many different actors can be processed in parallel across the system. Commands for different actors run concurrently; commands for the same actor run sequentially.

This is a local guarantee only. Consequent does not provide distributed locking by default. If multiple nodes can receive commands for the same actor, the system relies on divergence detection and healing (sections 5.8–5.10) rather than preventing concurrent writes.

An optional coordination adapter can provide distributed mutual exclusion for environments that prefer preventing divergence over healing it.

---

## Appendix: Flake IDs

Consequent uses 128-bit flake IDs encoded in base-62 format (alphanumeric characters). Flake IDs have three important properties:

1. **Globally unique**: seeded with `hostname:pid`, no coordination required.
2. **Time-ordered**: IDs generated later sort lexicographically after earlier IDs. This provides a total order for events without requiring synchronized clocks.
3. **Monotonically increasing**: suitable as database primary keys with efficient insert performance.

The flake provider is initialized once at startup with a seed derived from the host and process identity.
