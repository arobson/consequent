# Consequent
An actor based, event-sourcing library.

Conequent's goal is to provide a consistent approach to event sourcing while avoiding I/O implementation details (messaging transports and storage). Consequent is very opinionated and works best when models are implemented as modules of pure functions.

#### Please read the [concepts section](#concepts) before getting started.

## Use
Initialization requires three I/O adapters with the opportunity to enhance behavior with an additional 3. The API for each is specified under the [I/O Adapters](#io-adapters) section.

```javascript
var consequentFn = require( 'consequent' );

// minimum I/O adapters
// actor store
var actors = require( ... );
// event store
var events = require( ... );
// message bus
var messages = require( ... );

var consequent = consequentFn(
	{
		actorStore: actors,
		eventStore: events,
		messageBus: messages
	} );


// additional I/O adapters shown
// coordination provider
var coordinator = require( ... );
// actorCache
var actorCache = require( ... );
// eventCache
var eventCache = require( ... );
var consequent = consequentFn(
	{
		actorStore: actors,
		actorCache: actorCache,
		eventStore: events,
		eventCache: eventCache,
		messageBus: messages,
		coordinator: coordinator,
		actorPath: './actors' // optional path to actor modules
	} );
```

## API

### apply( actor, events )
Applies a series of events to an actor instance. The promise returned will resolve to a new instance of the actor that is the result of applying ordered events against the actor's initial state or reject with an error.

### fetch( actorType, actorId )
Get the actor's current state by finding the latests snapshot and applying events since that snapshot was taken. The promise returned will either resolve to the actor or reject with an error.

### handle( actorId, topic|type, command|event )
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
Consequent will load actor modules from an `./actors` path. This location can be changed during initialization. The actor module should return a hash with the expected structure which includes the following properties:

 * `actor` - metadata and configuration properties
 * `state` - default state hash or a factory to initialize the actor instance
 * `commands` - command processors
 * `events` - event processors

### Actor fields

#### Required field

 * `type` - provides a name/namespace for the actor

#### Optional fields

 * `eventThreshold` - set the number of events that will trigger a new snapshot
 * `snapshotDuringPartition` - sets whether snapshots can be created during partitions*
 * `snapshotOnRead` - sets whether or not snapshots should be created on reads
 * `aggregateFrom` - a list of actor types to aggregate events from - this is advanced

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
Consequent supports two types of messages - commands and events. Commands represent a message that is processed conditionally and results in one or more events as a result. Events represent something that's already taken place and get applied against the actor's state.

### Caution - events should not result in events
Consequent may replay the same event against an actor many times in a system before the resulting actor state is captured as a snapshot. There are no built-in mechanisms to identify or eliminate events that result from replaying an event multiple times.

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
	return [ { type: 'counterIncremented' } ];
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

module.exports = function() {
	return {
		actor: { // defaults shown
			type: "", // required - no default
			eventThreshold: 100,
			snapshotDuringPartition: false,
			snapshotOnRead: false,
		},
		state: function( id ) {
			return {
				// stuff and things
			};
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


## Concepts
Here's a breakdown of the primitives involved in this implementation:

### Event Sourced Actors
This approach borrows from event sourcing, CQRS and CRDT work done by others. It's not original, but perhaps a slightly different take on event sourcing.

### Events
An event is generated as a result of an actor processing a comand message. Actor mutation happens later as a result of applying events against the actor.

Each event will have a correlation id to specify which actor produced the event. It will also have an event id, timestamp and initiatedBy field to indicate the command message id and type that triggered the event creation.

Any time an actor's present state is required (on read or on processing a command), events are loaded and ordered by time + event id (as a means to get some approximation of total ordering) and then applied to the last actor state to provide a 'best known current actor state'.

### Actors
An actor is identified by a unique id and a vector clock. Instead of mutating and persisting actor state after each message, actors generate events when processing a message. Before processing a message, an actor's last available persisted state is loaded from storage, all events generated since the actor was persisted are loaded and applied to the actor.

After some threshold of applied events is crossed, the resulting actor will be persisted with a new vector clock to prevent the number of events that need to be applied from creating an unbounded negative impact to performance over time.

__The Importance of Isolation__
The expectation in this approach is that actors' messages will be processed in isolation at both a machine and process level. Another way to put this is that no two messages for an actor should be processed at the same time in an environment. The exception to this assumption is network partitions. Read on to see how this approach deals with partitions.

#### Models vs. Views
Actors can represent either a model, an actor that processes commands and produces events, or a view, an actor that only aggregates events produced by other models. The intent is to represent application behavior and features through models and use views to simply aggregate events to provide read models or materialized views for the application.

This provides CQRS at an architectural level in that model actors and view actors can be hosted in separate processes that use specialized transports/topologies for communication.

### Divergent Replicas
In the event of a network partition, if commands or events are processed for the same actor on more than one partition, replicas can be created. These replicas may result in multiple copies of the same actor with different state. When this happens, multiple actors will be retrieved when the next message is processed.

To resolve this divergence, the system will walk the actors' ancestors to find the latest shared ancestor and apply all events that have occured since that ancestor to produce a 'correct' actor state.

### Ancestors
An ancestor is a previous snapshot identified by the combination of the actor id and the vector clock. Ancestors exist primarily to resolve divergent replicas that may occur during a partition.

> Note - some persistence adapaters may include configuration to control what circumstances snapshots (and therefore ancestors) can be created under. Avoiding divergence is preferable but will trade performance for simplicity if partitions are frequent or long-lived.

### Event Packs
Whenever a new snapshot is created, all events that were applied will be stored as a single record identified by the actor's vector and id. Whenever divergent actors are being resolved, event packs will be loaded to provide a deterministic set of events to apply against the common ancestor.

### Vector Clocks
The ideal circumstances should limit the number of nodes that would participate in creation of a snpashot. A small set of nodes participating in mutation of a record should result in a manageable vector clock. In reality, there could be a large number of nodes participating over time. The vector clock library in use allows for pruning these to keep them managable.

> Note - we don't rely on a database to supply these since we're handling detection of divergence and merging.

### k-ordered ids
I just liked saying k-ordered. It just means "use flake". This uses our node library, [sliver](https://npmjs.org/sliver).

## If LWW Is All You Need
Event sourcing is a bit silly if you don't mind losing data. Chances are if LWW is fine then you're dealing with slowly changing dimensions that have very low probability of conflicting changes.

## If Only Strong Consistency Will Do
This will be supported one day. For now, you shouldn't use this library for this case. This library is intended to prioritize availability and partition tolerance and sacrifices consistency by throwing it straight out the window.

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
 * store event packs
 * retreive, unpack and merge event packs

### API

#### create( actorType )
Creates an eventStore instance for a specific type of actor.

#### getEventsFor( actorId, lastEventId )
Retrieve events for the `actorId` that occurred since the `lastEventId`.

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

 * sliver
 * pvclock
 * postal
 * monologue
 * machina
 * lodash
 * when
