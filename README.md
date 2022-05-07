# Consequent

An actor based, event-sourcing library.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Version npm][version-image]][version-url]
[![npm Downloads][downloads-image]][downloads-url]
[![Dependencies][dependencies-image]][dependencies-url]

Conequent provide's a consistent approach to event sourcing apart from technology choices for concerns such as storage, caching, and messaging. Consequent works best when models are implemented as modules of simple functions.

#### Please read the [concepts document](/docs/concepts.md) before getting started.

## Use

Initialization requires three I/O adapters with the opportunity to enhance behavior several more. Separate npm packages provide Adapters are provided for a small set of popular solutions. The API docs for each is linked under the [I/O Adapters](#io-adapters) section.

```javascript
const fount = require( 'fount' )
const consequentFn = require( 'consequent' )

// minimum I/O adapters
// actor store
const actors = require( ... )
// event store
const events = require( ... )
// message bus
const messages = require( ... )

const consequent = consequentFn(
	{
		actorStore: actors,
		eventStore: events,
		messageBus: messages,
		fount: fount
	})


// additional I/O adapters shown
// coordination provider
const coordinator = require( ... )
// actorCache
const actorCache = require( ... )
// eventCache
const eventCache = require( ... )

// searchProvider
cibst search = require( ... )

const consequent = consequentFn(
	{
		actorStore: actors,
		actorCache: actorCache,
		eventStore: events,
		eventCache: eventCache,
		messageBus: messages,
		coordinator: coordinator,
		search: search
		actorPath: './actors' // optional path to actor modules
	} );
```

# API

## `apply( actor, events )`

Applies a series of events to an actor instance in order. The promise returned will resolve to a new instance of the actor that is the result of applying ordered events against the actor's initial state or reject with an error.

## `fetch( actorType, actorId )`

Get the actor's current state by finding the latests snapshot and applying events since that snapshot was taken. The promise returned will either resolve to the actor or reject with an error.

## `fetchAll( options )`

Works like fetch but for multiple actors where options provides key values pairs that specify the type-id or type-ids to fetch. The result is a key value hash itself where the key is the actor type and the values are one or more actors corresponding to id(s) and order they were provided.

## `find( actorType, criteria )`

Attempts to find an actor matching the criteria specified and return the latest snapshot and then apply any events since the snapshot was taken.

Due to the way search adapters are updated after each command with the the latest state, search indexes should be capable of supplying results based on the most recent events.

## `getActorStream( actorType, actorId, options )`

Returns a generator that yields actor snapshots ordered by the event changes that created each one for every event that has occurred since the start specified by the event Id or date in the options hash.

The `eventTypes` allows you to limit which events result in a snapshot that emits a model to the stream. This does not reduce the number of events loaded in total, only which events will yield a snapshot. This is because omitting the total set of events from the model would affect the accuracy or completeness of the snapshots emitted.

__options__
```javascript
{
	sinceDate: '', // this or sinceEventId required
	sinceEventId: '', // this or sinceDate required
	until: '', // stop at date
	untilEventId: '', stop at eventId
	eventTypes: [], // optional
}
```

## `getEventStream( options )`

Returns a generator that yields ordered events occurr across the actor selection criteria since the start specified by the `sinceEventId` or `sinceDate` in the options hash and optionally stopping by `until` or `untilEventId`.

`actorTypes`, `actorIds` or `actors` are mutually exclusive selectors that determine how events will be sourced for the stream. The `actors` hash in particular is intended to be a key/value hash where each key is an actor type and each value is an array of ids belonging to that type.

Keep in mind that this is a potentially expensive operation that will likely span a number of feeds and requires some advanced logic and memory overhead in consequent to provide ordering guarantees for the events yielded.

__options__
```javascript
{
	actorTypes: [], // this, actorIds or actors required
	actorIds: [], // this, actorIds or actors required
	actors: {}, // this, actorIds or actors required
	since: '', // this or sinceEventId required
	sinceEventId: '', // this or sinceDate required
	until: '', // stop at date
	untilEventId: '', stop at eventId
	eventTypes: [], // optional
}
```

## `handle( actorId, topic|type, command|event )`

Process a command or event and return a promise that resolves to an array of objects that will contain the originating message, the actor snapshot and resulting events. The promise will reject if any problems occur while processing the message.

Successful resolution should provide an array of hashes with the following structure:
```javascript
{
	message: {}, // initiating command message
	actor: {}, // actor metadata
	state: {}, // updated state
	original: {}, // original state
	events: [] // the resulting events
}
```

Rejection will result in one or more hashes with the following structure:
```javascript
{
	rejected: true,
	reason: err, // error
	message: {}, // initiating
	actor: {}, // actor metadata
	state: {} // original/current state
}
```

> Note: in the event of an error, the state property will be a clone of the latest snapshot without the events applied.

## Documentation

 * [concepts](/docs/concepts.md) - how consequent and common terminology used
 * [actor models](/docs/actor-models.md) - how to write actor models, snapshots and their metadata
 * [events](/docs/events.md) - describes the role events play and the metadata they contain

### I/O Adapter Documentation

These documents explain the APIs and behavior expected

 * [storage adapters](/docs/storage-adapters.md) - storage adapter API
 * [cache adapters](/docs/cache-adapters.md) - cache adapter API
 * [search adapters](/docs/search-adapter.md) - search adapter API
 * [message adapters](/docs/message-adapter.md) - message adapter API
 * [coordination adapters](/docs/coordination-adapter.md) - coordination adapter API

## Dependencies

 * haberdasher
 * node-flakes
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
[dependencies-image]: https://img.shields.io/david/arobson/consequent.svg?style=flat
[dependencies-url]: https://david-dm.org/arobson/consequent
