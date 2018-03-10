# Consequent

An actor based, event-sourcing library.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Version npm][version-image]][version-url]
[![npm Downloads][downloads-image]][downloads-url]
[![Dependencies][dependencies-image]][dependencies-url]

Conequent provide's a consistent approach to event sourcing apart from technology choices for concerns such as storage, caching, and messaging. Consequent works best when models are implemented as modules of simple functions.

#### Please read the [concepts section](#concepts) before getting started.

## Use

Initialization requires three I/O adapters with the opportunity to enhance behavior with an additional 3. Separate npm packages provide Adapters are provided for a small set of popular solutions. The API for each is specified under the [I/O Adapters](#io-adapters) section.

```javascript
const fount = require( "fount" );
const consequentFn = require( "consequent" );

// minimum I/O adapters
// actor store
const actors = require( ... );
// event store
const events = require( ... );
// message bus
const messages = require( ... );

const consequent = consequentFn(
	{
		actorStore: actors,
		eventStore: events,
		messageBus: messages,
		fount: fount
	} );


// additional I/O adapters shown
// coordination provider
const coordinator = require( ... );
// actorCache
const actorCache = require( ... );
// eventCache
const eventCache = require( ... );
const consequent = consequentFn(
	{
		actorStore: actors,
		actorCache: actorCache,
		eventStore: events,
		eventCache: eventCache,
		messageBus: messages,
		coordinator: coordinator,
		actorPath: "./actors" // optional path to actor modules
	} );
```

# API

## `apply( actor, events )`

Applies a series of events to an actor instance in order. The promise returned will resolve to a new instance of the actor that is the result of applying ordered events against the actor's initial state or reject with an error.

## `fetch( actorType, actorId )`

Get the actor's current state by finding the latests snapshot and applying events since that snapshot was taken. The promise returned will either resolve to the actor or reject with an error.

## `fetchAll( options )`

Works like fetch but for multiple actors where options provides key values pairs that specify the type-id or type-ids to fetch. The result is a key value hash itself where the key is the actor type and the values are one or more actors corresponding to id(s) and order they were provided.

## `getActorStream( actorType, actorId, options )`

Returns an event emitter that emits ordered events for actor instances for every event that has occurred since the start specified by the event Id or date. The event types allows you to limit which events result in a snapshot that emits a model to the stream. It does not reduce the number of events loaded. This is because, in most cases, omitting the total set of events from the model would cause it to provide incomplete results.

__options__
```javascript
{
	sinceDate: '', // this or sinceEventId required
	sinceEventId: '', // this or sinceDate required
	eventTypes: [], // optional
}
```

## `getEventStream( options )`

__options__
```javascript
{
	actorTypes: [], // required
	sinceDate: '', // this or sinceEventId required
	sinceEventId: '', // this or sinceDate required
	eventTypes: [], // optional
}
```


## `handle( actorId, topic|type, command|event )`

Process a command or event and return a promise that resolves to the originating message, the actor snapshot and resulting events. The promise will reject if any problems occur while processing the message.

Successful resolution should provide a hash with the following structure:
```javascript
{
	message: {},
	actor: {},
	events: []
}
```

Rejection will give an error object with the following structure:
```javascript
{
	rejected: true,
	reason: "",
	message: {},
	actor: {}
}
```

> Note: the actor property will be a clone of the latest snapshot without the events applied.

## Actor

Consequent will load actor modules ending with `_actor.js` from an `./actors` path . This location can be changed during initialization. The actor module's function should return a hash with the expected structure which includes the following properties:

 * `actor` - metadata and configuration properties
 * `state` - default state hash or a factory to initialize the actor instance
 * `commands` - command handlers
 * `events` - event handlers

Any arguments listed in the actor module's exported function will be supplied via `fount`.

### Actor fields

#### Required field

 * `type` - provides a name/namespace for the actor

#### Optional fields

 * `eventThreshold` - set the number of events that will trigger a new snapshot
 * `snapshotDuringPartition` - sets whether snapshots can be created during partitions*
 * `snapshotOnRead` - sets whether or not snapshots should be created on reads
 * `aggregateFrom` - a list of actor types to aggregate events from

>* It is the actor store's responsibility to determine this, in most cases, databases don't provide this capability.

### State fields

Consequent will add the following fields to actor state:

 * `id`
 * `vector`
 * `ancestor`
 * `lastEventId`
 * `lastCommandId`
 * `lastCommandHandledOn` - ISO8601
 * `lastEventAppliedOn` - ISO8601

Other than id, none of these fields should _ever_ be manipulated directly.

## Messages (Commands & Events)

Consequent supports two types of messages - commands and events. Commands represent a message that is processed conditionally and results in one or more events as a result. Events represent something that's already taken place and will get applied against the actor's state.

### Caution - events should not result in events

Consequent may replay the same event against an actor **many** times in a system before the resulting actor state is captured as a snapshot. There are no built-in mechanisms to identify or eliminate events that result from replaying an event multiple times.

### Definition

The `commands` and `events` properties should be defined as a hash where each key is the message type/topic and the value can take one of three possible formats. Each definition has four properties that consequent uses to determine when and how to call the handler in question.

 * when - a boolean value, predicate function or state that controls when the handler is called
 * then - the handler function to call
 * exclusive - when true, the first handler with a passing when will be the only handler called
 * map - a boolean or argument to message map that will cause consequent to map message properties to handler/predicate arguments

#### Predicates
The form of a predicate function can take one of two forms:

```js
// when not using a map
function( state, message ) {
	// return true or false based on state and the message
}

// when using a map
// if map is a boolean
//		then the argument names should match message property names
// if map is a hash
//		then the argument names would be the keys and message property names would be the values
function( state, property1, property2 ) {
	// return true or false based on state and the arguments provided
}
```

When the predicate is a string, the handler will be invoked when the actor's state has a `state` property that matches.

#### Hash definition

> Note: while the only required field is `then`, if that's all you need, just provide the handler function by itself (see handler function only).

```js
{
	when: boolean|predicate|state name (defaults to true),
	then: handler function
	exclusive: boolean (defaults to true),
	map: argument->property map or false (defaults to true)
}
```

#### Array definition

This is a short-hand form of the hash form. It's probably not worth sacrificing clarity to use it, but here it is:

```js
	[ when, then, exclusive, map ]
```

#### Handler function only
If the default values for `when`, `exclusive` and `map` are what you need, just provide the function instead of a hash with only the `then` property.

### Handler functions
A command handler returns an array of events or a promise that resolves to one. An event handler mutates the actor's state directly based on the event and returns nothing.

_Example_
```javascript
// command handler example
function handleCommand( actor, command ) {
	return [ { type: "counterIncremented" } ];
}

// event handler example
function handleCounterIncremented( actor, event ) {
	actor.counter = actor.counter + event.amount;
}
```

#### Example
In this case, the when is a predicate used to determine which handler(s) (specified by the `then` property) should be called.

```javascript
var account = require( "./account" ); // model
...
	commands: {
		withdraw: [
			{ when: account.sufficientBalance, then: account.makeWithdrawal },
			{ when: account.insufficientBalance, then: account.denyWithdrawal }
		]
	},
	events: {
		withdrawn: [
			{ when: account.sufficientBalance, then: account.withdraw },
			{ when: account.insufficientBalance, then: account.overdraft }
		]
	}
```

__Actor Format - State as a hash of defaults__
```javascript

// predicates, command handlers and event handlers should be placed outside the actor defintion
// in a module that defines the model using pure functions

module.exports = function() {
	return {
		actor: { // defaults shown
			type: "", // required - no default
			eventThreshold: 100,
			snapshotDuringPartition: false,
			snapshotOnRead: false,
		},
		state: {
			// *reserved fields*
			id: "",
			vector: "",
			ancestor: "",
			lastEventId: 0,
			// other properties that track state
		},
		commands:
		{
			...
		},
		events:
		{
			...
		}
	}
};
```

__Actor Format - State as a factory method__
```javascript

// a factory method is called with an id and can return a state hash or promise for one.
// the promise form is so that state can be initialized by accessing I/O - this is
// especially useful if migrating to this approach from a more traditional data access approach.

module.exports = function(oldDatabase) {
	return {
		actor: { // defaults shown
			type: "", // required - no default
			eventThreshold: 100,
			snapshotDuringPartition: false,
			snapshotOnRead: false,
		},
		state: function( id ) {
			return oldDatabase.getOriginalRecord(id);
		},
		commands:
		{
			...
		},
		events:
		{
			...
		}
	}
};
```

# Concepts

## High Level

Models you provide are treated as [actors](https://en.wikipedia.org/wiki/Actor_model) that receive commands, return events and process events. Events are always "played" or "applied" against the model in order as one of the guarantees that consequent provides (provided that all I/O adapters follow the rules).

Events are stored individually and provide the primary "source of truth" in the system. In addition, consequent can publish these events via a messaging adapter in order to make integration and real time, asynchronous state propagation possible.

Snapshots are created from model's state after periodic replays of events in order to reduce the number of events that need to be replayed each time a model's state is needed.

View models can be created that simply exist to aggregate events from several other models in order to provide information/answer questions.

### A Note About Prior Art

This approach borrows from event sourcing, CQRS and CRDT work done by others. It is not original, but does borrow heavily from each of these ideas to provide a uniform data access pattern that adapts to various distributed systems challenges.

### Events

An event represents a discrete set of changes that have happened in the system as the result of processing a command message. Consequent adds metadata to the event so that it has:
 * information about the command that generated it
 * the type that generated it
 * the (primary) type that it mutates
 * a correlationId linking it to the primary actor id it should mutate
 * the vector clock of the model at the time it was generated
 * a flake id that gives it a relative global order
 * a timestamp

When the actor's present state is desired, events are loaded and ordered by time + the event's flake id and then applied after latest available actor snapshot resulting in the 'best known current actor state'.

### Actors

An actor is identified by a unique id and a vector clock. Instead of mutating and persisting actor state after each message, actors return one or more events as the result of processing a command.

Before a command handle is called, the actor's latest available state is determined by

 * loading the latest available snapshot
 * all events since the snapshot from storage
 * applying all events to the actor's event handlers

__The Importance of Isolation__

The expectation in this approach is that actors' command messages will be processed in isolation at both a machine and process level. No two command messages for an actor should be processed at the same time in an environment. Allowing multiple commands to be processed in parallel is the same as creating a network partitions.

### Snapshotting

After some threshold of applied events is crossed, the resulting actor will be persisted with a new vector clock to prevent the number of events that need to be applied from creating an unbounded negative impact to performance over time.

If reads are allowed in parallel, then a read-only flag is required to prevent race conditions or conflicts during snapshot creation. The trade-off here is that read-heavy/write-light will either need to set very low snapshot thresholds or risk reading a lot of events on every read.

### Divergent Replicas

In the event of a network partition, if commands or events are processed for the same actor on more than one partition, replicas can result. A replica is another copy of the same actor but with different/diverged state. When this happens, multiple actor instances will be retrieved the next time its state is fetched.

To resolve this divergence, the system will walk the replicas' ancestors to find the first shared ancestor and apply all events that have occured since that ancestor to produce a 'correct' actor state. Think of this like merging two timelines of events by rewinding to the spot where they split and forcing the all the events that happened on both sides to happen in one and then tossing out the other so it's like the split never occurred.

### Ancestors
An ancestor is a previous snapshot identified by the combination of the actor id and the vector clock. Ancestors exist primarily to resolve divergent replicas that may occur during a partition.

> Note - some persistence adapaters may include configuration to control what circumstances snapshots (and therefore ancestors) can be created under. Avoiding divergence is preferable but will trade performance for simplicity if partitions are frequent or long-lived.

### Event Packs

During snapshot creation, all events that were applied are optionally stored as a single record identified by the actor's vector and id. Whenever divergent actors are being resolved, if event packs are supported by the event store, they will be loaded to provide a deterministic set of events to apply against the common ancestor.

If the event store does not support these (and many storage technologies may have difficulty with large binary blobs) consequent will load the events themselves from their stores instead of using the packs.

### Vector Clocks

The ideal circumstances should limit the number of nodes that would participate in creation of a snpashot. A small set of nodes participating in mutation of a record should result in a manageable vector clock. In reality, there could be a large number of nodes participating over time. The vector clock library in use allows for pruning these to keep them managable.

> Note - consequent does not allow the database to supply these since it handles detection of divergence and merging. It doesn't matter if the database provides one, it won't get used.

### k-ordered ids

I just liked saying k-ordered. It just means "use flake". This uses our node library, [sliver](https://npmjs.org/sliver) which provides 128 bit keys in a base 62 format string.

### Models vs. Views

Actors can be thought of as a model, an actor that processes commands and produces events, or a view, an actor that only aggregates events produced by other models. The intent is to represent application behavior and features through models and use views to simply aggregate events to provide read models or materialized views for the application.

This provides CQRS at an architectural level in that model actors and view actors can be hosted in separate processes that use specialized transports/topologies for communication.

## If LWW Is All You Need

Event sourcing is a bit silly if you don't mind losing data. Chances are if LWW is fine then you're dealing with slowly changing dimensions that have very low probability of conflicting changes.

Traditional LWW approaches miss out on uniform data access models and other advantages of using events but they are more common.

## Preventing Divergence / Strong Consistency Guarantees

This library is intended to prioritize availability and partition tolerance and sacrifices strong consistency by throwing it straight out the window in the event of storage node failures.

There's no way to get selectively strong consistency in consequent for now. It relies entirely on the storage provider to ensure connectivity or identical responses from all servers during every read/write.

This also means accepting that in the event of any node failure in your storage layer that every operation would fail.

# I/O Adapters

This section defines the expected behavior and API for each type of I/O adapter. For additional guidance on implementing a particular adapter, please see the [documents folder](.\/tree\/master\/doc).

--

# Storage Adapters
Consequent provides a consistent approach to event sourcing but avoids any direct I/O. This allows any application to use it with any storage technology that an adapter exists for.

All adapter calls should return a promise.

## Event store
Responsibilities:

 * store events
 * retrieve events for an actor since an event id
 * retrieve an event stream for an actor since an event id
 * store event packs (optional)
 * retreive, unpack and merge event packs (optional)

### API
> Note: event pack method implementation is optional partially due to how difficult it may be for some database technologies to work efficiently with large binary blobs.

#### create( actorType )
Creates an eventStore instance for a specific type of actor.

#### getEventsFor( actorId, lastEventId )
Retrieve events for the `actorId` that occurred since the `lastEventId`.

#### getEventStreamFor( actorId, since, filter )
> **IMPORTANT**: Events returned in the stream must already be ordered

Should return an event emitter. The emitter will begin emitting `event` events for each event, in order, once a listener is attached. The emitter should raise a { type: `streamComplete` } event after all events have been emitted and will remove the listener automatically.

#### getEventPackFor( actorId, vectorClock )
Fetch and unpack events that were stored when the snapshot identified by `actorId` and `vectorClock` was created.

#### storeEvents( actorId, events )
Store events for the actor.

#### storeEventPack( actorId, vectorClock, events )
Pack and store the events for the snapshot identified by `actorId` and `vectorClock`.

## Actor store
Responsibilities

 * retrieve the latest actor (snapshot) by id; must provide replicas/siblings
 * store an actor snapshot
 * create & store ancestors
 * retrieve ancestors
 * detect ancestor cycles & other anomalies

### API

#### create( actorType )
Creates an actor store instance for a specific type of actor.

#### fetch( actorId )
Return the latest snapshot for the `actorId`. Must provide replicas/siblings if they exist.

#### findAncestor( actorId, siblings, ancestry )
Search for a common ancestor for the actorId given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

#### store( actorId, vectorClock, actor )
Store the latest snapshot and create ancestor.

# Caching Adapters
While there may not always be a sensible way to implement all the same features in a caching adapter, a valid caching adapter should provide a consistent API even if certain calls are effectively a no-op. Consequent uses read-through/write-through such that cache misses should not have any impact on functionality.

Without detailed analysis, the simplest approach to cache invalidation is to set TTLs on snapshots and eventpacks since these cannot change but should become irrelevant over time.

## Event cache
Responsibilities:

 * store recent events
 * flush/remove events once applied to a snapshot
 * store recent eventpacks
 * retrieve, unpack and merge event packs

### API
> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

#### create( actorType )
Creates an eventCache instance for a specific type of actor.

#### getEventsFor( actorId, lastEventId )
Retrieve events for the `actorId` that occurred since the `lastEventId`.

#### getEventPackFor( actorId, vectorClock )
Fetch and unpack events that were stored when the snapshot identified by `actorId` and `vectorClock` was created.

#### storeEvents( actorId, events )
Store events for the actor.

#### storeEventPack( actorId, vectorClock, events )
Pack and store the events for the snapshot identified by `actorId` and `vectorClock`.

## Actor cache
Responsibilities:

 * keep most recent actor/snapshot in cache
 * retrieve an actor by id
 * cache recent replicas/siblings
 * cache recent snapshots

### API
> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

#### create( actorType )
Creates an actor cache instance for a specific type of actor.

#### fetch( actorId )
Return the latest snapshot for the `actorId`. Must provide replicas/siblings if they exist.

#### findAncestor( actorId, siblings, ancestry )
Search for a common ancestor for the actorId given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

#### store( actorId, vectorClock, actor )
Store the latest snapshot and create ancestor.

# Coordination Adapter
Consequent can opt into using an external coordination service to provide guarantees around distributed mutual exclusion.

The expectation is that a lock will be acquired by a service using consequent and held during the lifecycle of the service. This assumes that commands and events will be routed via some form of consistent hashing. This is important as it avoids system-wide log-jams behind acquisition of a lock for ids that are seeing a lot of activity.

### API
Calls should return promises.

#### acquire( id, [timeout] )
Acquires a lock for an id. When in use, Consequent will not attempt to process a command or event until after the lock has been acquired.

#### release( id )
Release the lock to a specific id.

# Message Adapter
The message adapters job is to plug a potential stream of incoming commands and events into Consequent's actors while also providing a means to publish events that result from processing commands.

The message adapter should handle all transport related concerns.

Responsibilites:

 * Manage connectivity to the transport
 * Serialization/Deserialization of messages
 * Routing, subscriptions and other transport implementations
 * Delivery of commands and events to Consequent
 * Publishing events that result from processing commands

### API
Calls should return promises.

#### onMessages( consequent.handle )
Wires consequent's `handle` method into the transport abstraction. This should handle both incoming and outgoing data as the `handle` method returns all events that result from processing incoming messages.

## Dependencies

 * hashqueue
 * sliver
 * vectorclock
 * fount
 * globulesce
 * fauxdash
 * postal
 * bole
 * debug
 * pluralize

[travis-image]: https://travis-ci.org/arobson/consequent.svg?branch=master
[travis-url]: https://travis-ci.org/arobson/consequent
[coveralls-url]: https://coveralls.io/github/arobson/consequent?branch=master
[coveralls-image]: https://coveralls.io/repos/github/arobson/consequent/badge.svg?branch=master
[version-image]: https://img.shields.io/npm/v/consequent.svg?style=flat
[version-url]: https://www.npmjs.com/package/consequent
[downloads-image]: https://img.shields.io/npm/dm/consequent.svg?style=flat
[downloads-url]: https://www.npmjs.com/package/consequent
[dependencies-image]: https://img.shields.io/david/arobson/
consequent.svg?style=flat
[dependencies-url]: https://david-dm.org/arobson/consequent
