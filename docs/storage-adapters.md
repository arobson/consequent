# Storage Adapters

Consequent provides a consistent approach to event sourcing but does not supply I/O implementations itself. Storage adapters allow any application to use consequent with any storage technology. Adapters should be straightforward to implement given the uniform data access model. For the full adapter contract, see the [specification](SPECIFICATION.md#4-adapter-interfaces).

All adapter methods must return promises. Each adapter library exposes a `create(actorType)` factory method that returns a promise resolving to an adapter instance scoped to that actor type. Consequent creates adapter instances lazily on first use and caches them for subsequent operations.

# Event Store

The event store is responsible for durable persistence of [events](events.md) and optional [event packs](SPECIFICATION.md#29-event-packs).

Responsibilities:

 * Store events
 * Retrieve events for an actor since an event ID
 * Retrieve events for an actor since a date
 * Provide an event stream (generator) for an actor
 * Store and retrieve event packs (optional)

## API

> Event pack methods are optional. Some storage technologies may not work efficiently with large binary blobs.

> **Important**: Events must be returned in ascending order by event ID. Event IDs are [flake IDs](SPECIFICATION.md#appendix-flake-ids) in base-62 (alphanumeric) format. They sort lexicographically in time order. Correct ordering is essential for deterministic [state reconstruction](concepts.md#state-reconstruction) and [divergence healing](concepts.md#divergence-and-healing).

### `create(actorType)`

Returns a promise that resolves to an event store instance for the specified actor type.

### `getEventsFor(actorId, lastEventId)`

Retrieve events for the `actorId` that occurred after `lastEventId`. If `lastEventId` is omitted, return all events.

### `getEventsSince(actorId, date)`

Retrieve events for the `actorId` that occurred after `date` (ISO 8601).

### `getEventStreamFor(actorId, options)`

Return a generator that yields ordered events matching the options:

 * `sinceId` — start after this event ID (exclusive)
 * `untilId` — stop at this event ID (inclusive)
 * `since` — start at this date (inclusive)
 * `until` — stop at this date (inclusive)
 * `filter` — predicate function `(event) => boolean`; return true to include

### `getEventPackFor(actorId, vectorClock)` [optional]

Retrieve the [event pack](SPECIFICATION.md#29-event-packs) that was stored when the snapshot identified by `actorId` and `vectorClock` was created.

### `storeEvents(actorId, events)`

Store events for the actor. This operation is append-only — events are immutable once stored.

### `storeEventPack(actorId, vectorClock, events)` [optional]

Store the event pack for the snapshot identified by `actorId` and `vectorClock`.

## Event Metadata

Every stored event carries the following [system-enriched metadata](events.md#system-enriched-properties):

 * `id` — unique [flake ID](SPECIFICATION.md#appendix-flake-ids)
 * `_actorType`
 * `_actorId`
 * `_createdOn` — ISO 8601
 * `_createdBy`
 * `_createdById`
 * `_createdByVector`
 * `_createdByVersion`
 * `_initiatedBy`
 * `_initiatedById`

# Actor Store

The actor store is responsible for durable persistence of actor [snapshots](concepts.md#snapshots) and [ID mappings](concepts.md#identity).

Responsibilities:

 * Store and retrieve ID mappings (business ID to system ID)
 * Retrieve the latest actor snapshot by ID; must return [divergent replicas](concepts.md#divergence-and-healing) (siblings) as an array
 * Store actor snapshots
 * Create and store ancestors (previous snapshots linked by [vector clock](concepts.md#vector-clocks))
 * Retrieve ancestors
 * Detect ancestor cycles and other anomalies

## API

### `create(actorType)`

Returns a promise that resolves to an actor store instance for the specified actor type.

### `fetch(actorId)`

Return the latest snapshot for `actorId`, where `actorId` is the business ID defined by the actor's [`identifiedBy`](actor-models.md#required-fields) property. **Must return an array** if divergent replicas (siblings) exist. This signals [divergence detection](SPECIFICATION.md#58-divergence-detection).

### `findAncestor(actorId, siblings, ancestry)`

Walk the [ancestor chain](SPECIFICATION.md#59-ancestor-resolution) to find a common ancestor for `actorId` given the siblings list and previously visited vectors in `ancestry`. Must detect cycles in the ancestor chain to prevent infinite loops. Should resolve to the shared ancestor snapshot, or `undefined` if none is found.

### `getActorId(systemId, [asOf])`

Resolve the business ID mapped to `systemId`. If `asOf` (a date/time) is provided, select the correct mapping for that point in time. Must resolve to `undefined` or `null` if no mapping exists.

### `getSystemId(actorId, [asOf])`

Resolve the system ID (`_id`) mapped to the business `actorId`. If `asOf` (a date/time) is provided, select the correct mapping for that point in time. Must resolve to `undefined` or `null` if no mapping exists.

### `store(actorId, snapshotId, vectorClock, actor)`

Store a snapshot and create an ancestor record from the previous vector. `actorId` is the business ID defined by [`identifiedBy`](actor-models.md#required-fields).

`snapshotId` is a [flake ID](SPECIFICATION.md#appendix-flake-ids) guaranteed to be unique and monotonically increasing. Using this as the storage primary key provides optimal insert performance.

The previous snapshot must remain accessible by its vector clock for [ancestor walking](SPECIFICATION.md#59-ancestor-resolution). Implementations should append to a snapshot history rather than overwriting.

### `mapIds(systemId, actorId)`

Store a bidirectional mapping between the system ID (an immutable flake ID) and the business ID. See [ID mapping](SPECIFICATION.md#210-id-mapping).

Because mappings can change over time for a single `systemId`, implementations should store mappings with timestamps so that the correct `systemId` can be resolved for a given `actorId` based on date criteria.

## Actor Metadata

Stored snapshots include the following [system-managed fields](actor-models.md#state-fields):

 * `_id` — system-generated snapshot ID
 * `_vector` — serialized [vector clock](concepts.md#vector-clocks)
 * `_version`
 * `_ancestor` — vector clock of the previous snapshot
 * `_eventsApplied`
 * `_lastEventId`
 * `_lastCommandId`
 * `_lastCommandHandledOn` — ISO 8601
 * `_lastEventAppliedOn` — ISO 8601
