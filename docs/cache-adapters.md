# Caching Adapters

There may not always be a sensible way to implement all features in a caching adapter, a valid caching adapter should provide a consistent API even if certain calls are effectively a no-op. Consequent uses read-through/write-through such that cache misses should not have any impact on functionality.

Without detailed analysis, the simplest approach to cache invalidation is to set TTLs on snapshots and eventpacks since these cannot change but should become irrelevant over time.

# Event cache

Responsibilities:

 * store recent events
 * flush/remove events once applied to a snapshot
 * store recent eventpacks
 * retrieve, unpack and merge event packs

## API

> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

### `create (actorType)`

Creates and returns an eventCache instance for a specific type of actor.

### `getEventsFor (actorId, lastEventId)`

Retrieve events for the `actorId` that occurred since the `lastEventId`.

### `getEventsSince (actorId, date)`

Retrieve events for the `actorId` that occurred since the `date`.

### `getEventStreamFor (actorId, options)`

Should return a generator that yields ordered events.

Where options is a hash:

 * `sinceId` - the event id to start from (exclusive)
 * `untilId` - the event id to stop (inclusive)
 * `since` - the date to start at (inclusive)
 * `until` - the date top stop at (inclusive)
 * `filter` - a predicate filter function to apply to each event (true means include the event, false means exclude the event)

### `getEventPackFor (actorId, vectorClock)` [OPTIONAL]

Fetch and unpack events that were stored when the snapshot identified by `actorId` and `vectorClock` was created.

### `storeEvents (actorId, events)`

Store events for the actor.

### `storeEventPack (actorId, vectorClock, events)` [OPTIONAL]

Pack and store the events for the snapshot identified by `actorId` and `vectorClock`.

## Event Metadata

 * `id`
 * `_actorNamespace`
 * `_actorType`
 * `_actorId`
 * `_createdOn` - ISO8601
 * `_createdBy`
 * `_createdById`
 * `_createdByVector`
 * `_createdByVersion`
 * `_initiatedBy`
 * `_initiatedById`

# Actor cache

Responsibilities:

 * keep most recent actor/snapshot in cache
 * retrieve an actor by id
 * cache recent replicas/siblings
 * cache recent snapshots
 * store and retrieve id mappings

## API

> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

### `create (actorType)`

Creates and returns actor cache instance for a specific type of actor.

### `fetch (actorId)`

Return the latest snapshot for the `actorId`. Must provide replicas/siblings if they exist.

### `findAncestor (actorId, siblings, ancestry)`

Search for a common ancestor for the `actorId` given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

### `getActorId (actorId, [asOf])`

Resolves to a promise for the `actorId` mapped to the `systemId`. If a date/time is provided for the optional `asOf` argument - it should be used to select the correct `actorId` between multiple possible matches for a given `systemId`.

> Must resolve to `undefined` or `null` if no mapping exists

### `getSystemId (actorId, [asOf])`

Resolves to a promise for the `systemId` mapped to the `actorId`. If a date/time is provided for the optional `asOf` argument - it should be used to select the correct `systemId` between multiple possible matches for a given `actorId`.

> Must resolve to `undefined` or `null` if no mapping exists

### `mapIds(systemId, actorId)`

Stores a mapping between the system id for the record (which is a definitive flake id that must never change) and a friendly id.

This is most commonly used when looking up events by `actorId` for which no snapshot exists.

Because mappings can change over time for a single `systemId` it is recommended to implement storage such so that the `systemId` can be selected for a given `actorId` based on date criteria.

### `store (actorId, vectorClock, actor, identifiedBy, indexBy)`

Store the latest snapshot and create ancestor.

`identifiedBy` is one or more user defined fields that provides a "friendly" unique identifier for the model but does not server as the primary key.

`indexBy` provides a list of optional fields specified by the actor that it should be individually indexed by.

The practical difference between `identifiedBy` and `indexedBy` is that the fields in `identifiedBy` work together to create a unique lookup for the model while `indexedBy` are each individual indexes.

## Actor Metadata

 * `id`
 * `_vector`
 * `_version`
 * `_ancestor`
 * `_eventsApplied`
 * `_lastEventId`
 * `_lastCommandId`
 * `_lastCommandHandledOn` - ISO8601
 * `_lastEventAppliedOn` - ISO8601

