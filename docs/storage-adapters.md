# Storage Adapters

Consequent provides a consistent approach to event sourcing but avoids supplying I/O implementations itself. This allows any application to use it with any storage technology that an adapter exists for. Adapters should be relatively simple to implement given that the requirements are straight-forward and the data access model is uniform.

All adapter calls must return a promise.

# Event store

Responsibilities:

 * store events
 * retrieve events for an actor since an event id
 * retrieve events for an actor since a date
 * retrieve an event stream for an actor since an event id
 * retrieve an event stream for an actor since a date
 * store event packs (optional)
 * retreive, unpack and merge event packs (optional)

## API

> Note: event pack method implementation is optional due to how difficult it may be for some database technologies to work efficiently with large binary blobs.

> **IMPORTANT**: Events returned must be ordered by the event id. Id will always be a flake id in base 62 (alphanumeric) format. Be certain you

### `create (actorType)`

Returns a promise the should resolve to an eventStore instance for a specific type of actor.

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

# Actor store

Responsibilities

 * store and retrieve id mappings
 * retrieve the latest actor (snapshot) by id/fields; must provide replicas/siblings
 * store an actor snapshot
 * create & store ancestors
 * retrieve ancestors
 * detect ancestor cycles & other anomalies

## API

### `create (actorType)`

Returns a promise that resolve to an actor store instance for a specific type of actor.

### `fetch (actorId)`

Return the latest snapshot for the `actorId` where `actorId` is is the 'friendly' id defined by the models `identifiedBy` property. Must provide replicas/siblings if they exist.

### `findAncestor (actorId, siblings, ancestry)`

Search for a common ancestor for the `actorId` given the siblings list and ancestry where `actorId` is a key/value map of field/values used to identify the model. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

### `getActorId (actorId, [asOf])`

Resolves to a promise for the `actorId` mapped to the `systemId`. If a date/time is provided for the optional `asOf` argument - it should be used to select the correct `actorId` between multiple possible matches for a given `systemId`.

> Must resolve to `undefined` or `null` if no mapping exists

### `getSystemId (actorId, [asOf])`

Resolves to a promise for the `systemId` mapped to the `actorId`. If a date/time is provided for the optional `asOf` argument - it should be used to select the correct `systemId` between multiple possible matches for a given `actorId`.

> Must resolve to `undefined` or `null` if no mapping exists

### `store (actorId, snapshotId, vectorClock, actor)`

Store the latest snapshot and create ancestor. `actorId` is is the 'friendly' id defined by the models `identifiedBy` property.

`snapshotId` is a node-flakes generated unique id guaranteed to be unique and increasing in value. Using this as the storage system's primary key/record id is generally preferable as ever increasing keys provide  the best insertion and delete times.

`identifiedBy` is one or more user defined fields that provides a "friendly" unique identifier for the model but does not server as the primary key.

### `mapIds(systemId, actorId)`

Stores a mapping between the system id for the record (which is a definitive flake id that must never change) and a friendly id.

This is most commonly used when looking up events by `actorId` for which no snapshot exists.

Because mappings can change over time for a single `systemId` it is recommended to implement storage such so that the `systemId` can be selected for a given `actorId` based on date criteria.

## Actor Metadata

 * `_id` - system generated snapshot id
 * `_vector`
 * `_version`
 * `_ancestor`
 * `_eventsApplied`
 * `_lastEventId`
 * `_lastCommandId`
 * `_lastCommandHandledOn` - ISO8601
 * `_lastEventAppliedOn` - ISO8601
