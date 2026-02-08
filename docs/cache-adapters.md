# Cache Adapters

Cache adapters are optional. Consequent uses read-through/write-through caching: the system checks the cache before the durable store, and cache misses fall through transparently with no impact on functionality. A valid cache adapter should provide a consistent API even if certain methods are effectively no-ops (returning `undefined` or empty results to trigger fallback to the store).

The simplest approach to cache invalidation is to set TTLs on snapshots and event packs, since these records cannot change but become irrelevant over time as newer snapshots supersede them.

For the full adapter contract, see the [specification](SPECIFICATION.md#43-actor-cache). For the durable storage counterparts, see [storage adapters](storage-adapters.md).

# Event Cache

Responsibilities:

 * Cache recent [events](events.md)
 * Flush or remove events once applied to a [snapshot](concepts.md#snapshots)
 * Cache recent [event packs](SPECIFICATION.md#29-event-packs)
 * Retrieve and unpack event packs

## API

> The API mirrors the [event store](storage-adapters.md#api). Implementations can opt out of any method by returning `undefined` or an empty array, causing consequent to fall through to the durable store.

### `create(actorType)`

Returns a promise that resolves to an event cache instance for the specified actor type.

### `getEventsFor(actorId, lastEventId)`

Retrieve cached events for `actorId` that occurred after `lastEventId`.

### `getEventsSince(actorId, date)`

Retrieve cached events for `actorId` that occurred after `date`.

### `getEventStreamFor(actorId, options)`

Return a generator that yields ordered events. Options:

 * `sinceId` — start after this event ID (exclusive)
 * `untilId` — stop at this event ID (inclusive)
 * `since` — start at this date (inclusive)
 * `until` — stop at this date (inclusive)
 * `filter` — predicate function `(event) => boolean`; return true to include

### `getEventPackFor(actorId, vectorClock)` [optional]

Retrieve the cached [event pack](SPECIFICATION.md#29-event-packs) for the snapshot identified by `actorId` and `vectorClock`.

### `storeEvents(actorId, events)`

Cache events for the actor.

### `storeEventPack(actorId, vectorClock, events)` [optional]

Cache the event pack for the snapshot identified by `actorId` and `vectorClock`.

## Event Metadata

Cached events carry the same [system-enriched metadata](events.md#system-enriched-properties) as events in the durable store.

# Actor Cache

Responsibilities:

 * Cache the most recent actor [snapshot](concepts.md#snapshots)
 * Retrieve an actor by ID
 * Cache recent replicas/siblings (for [divergence resolution](concepts.md#divergence-and-healing))
 * Store and retrieve [ID mappings](concepts.md#identity)

## API

> The API mirrors the [actor store](storage-adapters.md#api-1). Implementations can opt out of any method by returning `undefined`, causing consequent to fall through to the durable store.

### `create(actorType)`

Returns a promise that resolves to an actor cache instance for the specified actor type.

### `fetch(actorId)`

Return the cached snapshot for `actorId`. Must include replicas/siblings if they exist.

### `findAncestor(actorId, siblings, ancestry)`

Search for a common [ancestor](SPECIFICATION.md#59-ancestor-resolution) for `actorId` given the siblings list and previously visited vectors in `ancestry`. Must detect cycles in the ancestor chain. Should resolve to the shared ancestor snapshot, or `undefined`.

### `getActorId(systemId, [asOf])`

Resolve the business ID mapped to `systemId`. Must resolve to `undefined` or `null` if no mapping exists.

### `getSystemId(actorId, [asOf])`

Resolve the system ID mapped to the business `actorId`. Must resolve to `undefined` or `null` if no mapping exists.

### `mapIds(systemId, actorId)`

Cache the [bidirectional mapping](SPECIFICATION.md#210-id-mapping) between the system ID (an immutable flake ID) and the business ID.

Because mappings can change over time for a single `systemId`, implementations should store mappings with timestamps so that the correct `systemId` can be resolved for a given `actorId` based on date criteria.

### `store(actorId, vectorClock, actor, identifiedBy, indexBy)`

Cache the latest snapshot and create an ancestor record.

`identifiedBy` specifies the field(s) that provide the business identifier for the actor. `indexBy` specifies additional fields that should be individually indexed for lookup.

The difference between `identifiedBy` and `indexBy`: the fields in `identifiedBy` work together to form a unique key for the actor, while each field in `indexBy` is an independent index.

## Actor Metadata

Cached snapshots include the same [system-managed fields](actor-models.md#state-fields) as snapshots in the durable store.
