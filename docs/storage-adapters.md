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

Creates an eventStore instance for a specific type of actor.

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

 * retrieve the latest actor (snapshot) by id; must provide replicas/siblings
 * store an actor snapshot
 * create & store ancestors
 * retrieve ancestors
 * detect ancestor cycles & other anomalies

## API

### `create (actorType)`

Creates an actor store instance for a specific type of actor.

### `fetch (actorId)`

Return the latest snapshot for the `actorId`. Must provide replicas/siblings if they exist.

### `findAncestor (actorId, siblings, ancestry)`

Search for a common ancestor for the actorId given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

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
