# Concepts

This document explains the ideas behind consequent: what problem it solves, how the pieces fit together, and why certain decisions were made. For precise data structures and algorithms, see the [specification](SPECIFICATION.md). For a hands-on introduction, see [getting started](GETTING_STARTED.md).

## Event Sourcing

In a traditional system, when something changes you overwrite the current record with the new values. The previous state is gone. If you need an audit trail, you build one separately. If you later realize you need to answer a question about your data that your schema doesn't support, you are out of luck — the information was discarded at write time.

Event sourcing takes a different approach. Instead of storing the current state directly, you store every change as an immutable event. The current state is derived by replaying those events in order. The event log becomes the system of record — a complete, append-only history of everything that has happened.

This has several practical consequences. You can reconstruct state at any point in time by replaying events up to that moment. You can build entirely new views of your data after the fact, because the raw events are still available. And because events are immutable and append-only, concurrent writes to the same record don't silently overwrite each other — they produce distinct events that can be reasoned about.

## Actors

Consequent organizes behavior around the actor model. An actor is an entity with an identity, a current state, and a set of rules for how it responds to messages. Each actor type defines its own command handlers, event handlers, and predicates as plain functions. Consequent handles identity, state reconstruction, persistence, and concurrency.

When you send a command to an actor, consequent first reconstructs its current state (from the latest snapshot plus any subsequent events), then passes the command to the appropriate handler. The handler inspects the state and returns one or more events describing what happened. Those events are stored permanently and applied to the state through event handlers.

This separation — commands describe intent, events describe outcomes — is central to the design. Command handlers decide *what* should happen based on the current state. Event handlers apply those decisions to the state mechanically. This keeps decision logic and state mutation in separate, testable functions.

## Commands

A command is a message expressing intent: "open this account," "withdraw this amount," "book this trip." Commands are addressed to a specific actor by type and identity, and routed to matching command handlers.

Command handlers receive the actor's current state and the command's data. They return events — one object for a single change, an array for several. They never modify state directly. If the command should be rejected (insufficient funds, invalid state transition), the handler can throw an error or simply return no events. Predicate functions attached to handlers provide a declarative way to express when a handler applies, enabling patterns like state machines where different handlers activate depending on the actor's current state.

A single command can produce events that target different actor types. A trip booking command, for example, might return both a "trip booked" event and a "vehicle reserved" event. Consequent routes each event to the correct actor type based on the event's type prefix.

## Events

An event is an immutable record of something that happened. Events carry enough information to fully describe the change — they should never require reading from another system to be understood. Once stored, events are never modified or deleted.

When consequent stores an event, it enriches it with metadata: a globally unique flake ID that provides both identity and temporal ordering, the identity and vector clock of the producing actor, the command that triggered it, and a timestamp. This metadata connects every event to its causal origin and gives it a deterministic position in the global timeline.

Events are the source of truth. Snapshots, search indices, and any other derived state can always be rebuilt from the event log.

## State Reconstruction

An actor's current state is never stored as a single mutable record that gets updated in place. Instead, it is computed each time it is needed:

1. Load the latest snapshot (if one exists).
2. Fetch all events that occurred after that snapshot.
3. Sort events by their flake ID (which provides a deterministic time-based order).
4. Apply each event to the state through the actor's event handlers.

The result is the best known current state. Event handlers mutate the state object directly — consequent clones it before handing it to the handlers, so there is no risk of corrupting a stored snapshot.

This process is deterministic. Given the same snapshot and the same sequence of events, replaying always produces the same state. This property is what makes divergence healing possible.

## Snapshots

Replaying every event from the beginning of an actor's life on every read would become expensive as the event count grows. Snapshots solve this by periodically persisting a copy of the actor's state so that future reads only need to replay events that occurred after the snapshot.

A snapshot is created when the number of events applied during a single read exceeds a configurable threshold (default 50). The snapshot records the full state along with a vector clock and a pointer to the previous snapshot (the ancestor). This ancestor link forms a chain that the system uses to resolve divergence.

When a snapshot is created, the system can optionally store an event pack alongside it — the complete set of events that were applied to produce that snapshot, bundled as a single record. Event packs speed up divergence resolution by providing the exact events for a snapshot without querying the event log by time range.

## Identity

Actors have two identities. The business identity is the human-readable field you address commands to — an account number, a VIN, a username. The system identity is an internal flake ID that serves as the storage primary key.

The separation exists for three reasons. Business identifiers sometimes change (a user updates their email, a vehicle is re-registered), and tying every foreign key in the system to a mutable value would make such changes cascade through storage, events, and search indices. Flake IDs are monotonically increasing, which gives most databases better insertion and indexing performance than random or human-readable values. And when multiple fields combine to identify an actor, a single system ID avoids propagating composite keys throughout the system.

Consequent maintains a bidirectional mapping between the two. When you send a command to a business ID that has no mapping yet, the system generates a new flake ID and creates the mapping automatically.

## Vector Clocks

Every snapshot carries a vector clock — a small data structure that records which nodes have contributed to the actor's state and how many snapshots each node has created. When a node creates a snapshot, it increments its own component of the vector.

Vector clocks capture causal relationships. If every component of clock A is less than or equal to the corresponding component of clock B, and at least one is strictly less, then A happened before B — the state that produced B is a successor of the state that produced A. But if A has some components greater than B and B has some components greater than A, neither happened before the other. The two states were produced independently, during a partition. They are concurrent — and this is how consequent detects divergence.

Consequent manages vector clocks internally. It does not rely on the database to supply them, because it needs to control the semantics of versioning and divergence detection directly.

## Divergence and Healing

In a distributed system, network partitions are a fact of life. When a partition occurs, two nodes may independently process commands for the same actor. Each node creates snapshots with its own vector clock component incremented, producing two copies of the actor with different state and concurrent vectors. These are called siblings or divergent replicas.

Consequent detects divergence at read time. When the actor store returns multiple snapshots for the same actor (an array instead of a single record), the system knows a partition has occurred and initiates healing.

The healing process works by rewinding to the point where the timelines diverged and replaying all events from both sides in a single, deterministic order:

1. Walk each sibling's ancestor chain (following the snapshot-to-previous-snapshot links) until a common ancestor is found — the last snapshot that existed before the partition.
2. Collect all events that occurred after that ancestor across all replicas. If event packs are available, use them; otherwise query the event log.
3. Deduplicate events by ID (the same event may appear in multiple replicas' histories).
4. Sort all events by flake ID, producing a single deterministic ordering.
5. Replay every event against the ancestor's state.
6. Create a new snapshot from the result. Its vector clock is the component-wise merge of all siblings' clocks, so it dominates all of them and future reads see only the healed state.

The key insight is that flake IDs provide a global time-based ordering and event handlers are deterministic functions of state and event data. So replaying the union of all events in ID order always converges to the same result, regardless of which node performs the healing. The divergent timelines are merged as if the partition never happened.

## Models and Views

Actors serve two roles. A model actor processes commands and produces events — it represents the behavior and business rules of an entity. A view actor produces no events of its own; it aggregates events from other actor types to build a derived representation.

This distinction maps naturally to CQRS (Command Query Responsibility Segregation). Models handle writes. Views handle reads. They can run in separate processes with different scaling characteristics, communicating through the event log.

## Event Aggregation

An actor can subscribe to events from other actor types by defining event handlers with a cross-type prefix. If a trip actor has a handler for `vehicle.departed`, consequent knows to load events from the vehicle actor and apply them to the trip's state.

The system determines which vehicle instances are related to a given trip by examining the trip's state for fields that follow naming conventions: a `vehicleId` field, a `vehicles` array containing objects with `id` properties, and similar patterns. This convention-based resolution avoids explicit foreign key declarations.

Event aggregation is what makes view models possible. A reporting actor can aggregate transaction events from accounts, payment events from processors, and fee events from a billing system — all without any of those source actors knowing the reporting actor exists.

## Adapters

Consequent separates domain logic from infrastructure through adapter interfaces. The core algorithms for command dispatch, event application, snapshotting, and divergence resolution are independent of how data is actually stored, cached, or transmitted.

Five adapter types cover the infrastructure concerns:

- **Actor store and actor cache**: persist and retrieve actor snapshots and ID mappings. The store is durable; the cache is optional and speeds up reads.
- **Event store and event cache**: persist and retrieve events and event packs. Same durable/cache split.
- **Search adapter**: indexes actor state fields for query operations.

Additional adapters exist for messaging (plugging external transports into the command/event pipeline) and coordination (distributed mutual exclusion). The system ships with in-memory defaults for all adapters, suitable for development and testing.

This separation means adopting consequent does not commit you to a specific database, cache, or message bus. The adapter contracts are described in the [specification](SPECIFICATION.md) and the individual adapter documents linked from the [index](INDEX.md).

---

## Trade-offs and Caveats

### Availability over consistency

Consequent prioritizes availability and partition tolerance. During a storage node failure or network partition, the system continues to accept commands on any reachable node. Divergent state is healed after the fact rather than prevented. There is no mechanism for opting into strong consistency on a per-actor or per-operation basis — consistency depends entirely on the storage provider's own guarantees during normal operation.

### Command isolation

The system assumes that no two commands for the same actor are processed simultaneously across the entire environment. Processing commands for the same actor in parallel — whether on the same node or across nodes — is equivalent to creating a partition. On a single node, consequent enforces this through a per-actor concurrency queue. Across nodes, it is the operator's responsibility through routing (consistent hashing) or the optional coordination adapter.

### Event handler determinism

Divergence healing depends on the guarantee that replaying the same events in the same order always produces the same state. Event handlers must be deterministic functions of their inputs. They should not read clocks, generate random values, or perform I/O. Any non-determinism in an event handler will cause different nodes to arrive at different state after healing, silently corrupting the actor.

### Events must not produce events

Consequent may replay the same event against an actor many times over its lifetime — once when first applied, again each time the actor is reconstructed from a snapshot, and again during divergence healing. There is no built-in mechanism to deduplicate events generated as a side effect of replaying another event. If an event handler produces new events, those events will multiply with each replay.

### Snapshot threshold tuning

The event threshold controls the balance between write cost (creating snapshots) and read cost (replaying events). A low threshold means frequent snapshots and fast reads, but more storage writes. A high threshold means fewer snapshots but slower reads as more events accumulate between them. Read-heavy workloads benefit from lower thresholds or enabling `snapshotOnRead`.

### Read-only flag

By default, snapshots are only created during write operations (command handling). If reads vastly outnumber writes, actors can accumulate many events that are replayed on every read without triggering a snapshot. The `snapshotOnRead` option addresses this, but introduces the risk of snapshot contention if many readers reconstruct the same actor simultaneously. The `readOnly` flag on fetch operations suppresses snapshot creation entirely, which is appropriate when the caller does not need the most compact state representation.

### Vector clock growth

Vector clocks grow by one component for each distinct node that creates a snapshot for a given actor. In systems where many nodes participate over time, clocks can become large. Pruning strategies (removing components for nodes that are no longer active) can keep them manageable, but consequent does not enforce a specific pruning policy.

### When event sourcing is unnecessary

If your domain has slowly changing data with low probability of conflicting writes, and you do not need historical state reconstruction or derived views, a traditional last-writer-wins approach is simpler and sufficient. Event sourcing introduces complexity in exchange for a complete history, deterministic state reconstruction, and partition-tolerant divergence resolution. That trade-off is only worthwhile when you need those properties.
