# Actor Models

An actor model defines behavior in the system by defining how the model will respond to specific **commands** and which **events** it combines to determine its state.

## Modules

Consequent loads modules ending with an `_actor.js` postfix from an `./actors` path by default but allows this path to be changed during initialization. The actor module must return a function that returns a hash with the following properties:

 * `actor` - metadata and configuration properties
 * `state` - default state hash or a factory to initialize the actor instance
 * `commands` - command handlers
 * `events` - event handlers

Consequent will supply dependencies specified in the the actor module's exported function via `fount`.

### Example - actor module structure

```js
// an incomplete example
module.exports = function (dependency1, dependency2) {
  return {
    actor: {}, \\ metadata
    state: {}, \\ initial state
    commands: {}, \\ command handlers
    events: {} \\ event handlers
  }
}
```

## `actor`

The `actor` property describes the model and provides metadata for how the storage adapters will interact with it.

### Required fields

 * `namespace`
 * `type` - the model name

### Optional fields

 * `eventThreshold` - set the number of events that will trigger a new snapshot
 * `storeEventPack` - store all events contributing to snapshot in a pack, default is false
 * `snapshotDuringPartition` - allow snapshots during partitions*
 * `snapshotOnRead` - allow snapshot creation during read
 * `aggregateFrom` - a list of actor types to aggregate events from (populated automatically)
 * `searchableBy` - a list of fields to pass on to a search adapter if one is present
 * `identifiedBy` - identifies a property on the model that will act as a natural key - it should be unique for across all instances of the model and will be what you use to send commands or lookup instances using. Consequent will provide an underlying unique system id in `_id`

>* It is the model store's responsibility to determine if this is possible, in most cases, databases don't provide this capability.

## State fields

Consequent will add the following fields to actor state:

 * `_id`
 * `_vector`
 * `_version`
 * `_ancestor`
 * `_eventsApplied`
 * `_lastEventId`
 * `_lastCommandId`
 * `_lastCommandHandledOn` - ISO8601
 * `_lastEventAppliedOn` - ISO8601

None of these fields should _ever_ be manipulated directly.

### `_id` and `identifiedBy`

`_id` will be populated by a flake id for efficient storage, guaranteed uniqueness and immutability. You are expected to specify which field in the model serve as the id that you will use to send commands and request state by. This is done to avoid circumstances where a change to this value would result in the need to update every foreign key relationship in the system and to ensure the most efficient storage implementation (most databases prefer increasing ids for primary keys vs random values)

# Message Handling (Commands & Events)

Consequent supports two types of messages - commands and events. Commands represent a message that is processed conditionally and results in one or more events as a result. Events represent something that's already taken place and will get applied against the actor's state.

## Caution - events should not result in events

Consequent may replay the same event against an actor **many** times in a system before the resulting actor state is captured as a snapshot. There are no built-in mechanisms to identify or eliminate events that result from replaying an event multiple times.

## Definition

The `commands` and `events` properties should be defined as a hash where each key is the message type/topic and the value can take one of three possible formats. Each definition has four properties that consequent uses to determine when and how to call the handler in question.

 * `when` - a boolean value, predicate function or state that controls when the handler is called
 * `then` - the handler function to call
 * `exclusive` - when true, the first handler with a passing when will be the only handler called
 * `map` - a boolean or argument to message map that will cause consequent to map message properties to handler/predicate arguments

> If the event comes from another type, you must prefix the event with the type name and a `.`: `type.event`

> If the `when` the predicate is a string, the handler will be invoked if the actor's state has a `state` property with a matching string.

### Hash definition

> Note: while the only required field is `then`, if that's all you need, just provide the handler function by itself (see handler function only).

```js
{
  when: boolean|predicate|state name (defaults to true),
  then: handler function
  exclusive: boolean (defaults to true),
  map: argument->property map or false (defaults to true)
}
```

### Array definition

This is a short-hand form of the hash form. It's probably not worth sacrificing clarity to use it, but here it is:

```js
  [ when, then, exclusive, map ]
```

### Handler function only

If the default values for `when`, `exclusive` and `map` are what you need, just provide the function instead of a hash with only the `then` property.

## Handler functions

A command handler returns an array of events or a promise that resolves to an array of events.

An event handler mutates the actor's state directly based on the event and returns nothing.

#### Handler Examples
```javascript
// command handler examples

// a command handler that accepts the entire command as an argument
function handleCommand(actor, command) {
  return { type: 'counterIncremented', amount: command.amount };
}

// a command that uses property-argument mapping
function handleCommand(actor, amount) {
  return { type: 'counterIncremented', amount };
}

// event handler examples

// an event handler that accepts the entire event as an argument
function handleCounterIncremented(actor, event) {
  actor.counter = actor.counter + event.amount;
}

// an event handler that accepts the entire event as an argument
function handleCounterIncremented(actor, amount) {
  actor.counter = actor.counter + amount;
}
```

### Definition Example

The when is a predicate used to determine which handler (specified by the `then` property) should be called. Because the predicates are mutually exclusive, the `exclusive` flag defaulting to `true` prevents consequent from trying every predicate once a predicate returns `true`.

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

> Note: this is a somewhat advanced (controversial?) example where an event is handled conditionally. "Why would there be a need for conditional event handling?" This is the right question to ask - the short answer is that most systems will never need to address it. The point here is that it is possible but you should only use it if you're absolutely certain you need it and understand **all** the implications.

__Actor Format - State as a hash of defaults__
```javascript

// predicates, command handlers and event handlers should be placed outside the actor defintion
// in a module that defines the model using pure functions

module.exports = function() {
  return {
    actor: { // defaults shown
      namespace: '', // required - no default
      type: '', // required - no default
      eventThreshold: 100, // required - no default
      snapshotDuringPartition: false,
      snapshotOnRead: false
    },
    state: {
      // *reserved fields*
      id: ''
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
      namespace: '', // required - no default
      type: '', // required - no default
      eventThreshold: 100,
      snapshotDuringPartition: false,
      snapshotOnRead: false,
    },
    state: function( id ) {
      return oldDatabase.getOriginalRecord(id)
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

### Predicate Functions

Predicates accept the current state and either the entire command as an argument or properties from the command mapped to the remaining arguments.

```js
// when not using a map
function hasThing (state, commmand) {
  return state.collection.indexOf(command.thing) >= 0
}

// with argument mapping
function hasThing (state, thing) {
  return state.collection.indexOf(thing) >= 0
}
```

## Aggregating Events From Multiple Types

consequent will populate `aggregateFrom` automatically by looking at prefixed event types and noting any event prefix with a type name other than the current type. consequent will attempt to load events for these types but needs to be able to determine which type instances are related to the owning type in order to load the correct events.

It does this by looking at field names and trying to determine which of them may contain identities for each type. It will attempt to look at any field that begins with the type and testing to see if it ends in `Id`, has an `id` property, is an array ending in `Ids` or is a field named for the plural of the type and contains an array of objects with `id` properties.

### Why Not Just Load Objects via Foreign Keys?

Without the opportunity to independently process each event of interest, different models would not be possible. It's also important to not that given the complexity of various types of event processing (i.e. statisical analysis) it may be desirable to have very different kinds of snapshotting behavior per type of model.

### Example

You may be trying to find all financial transactions that belong to an indivial. If an `account` type produced transaction events, you could put an `accountIds` array field on the new type containing all the accounts beloning to the individual. You could also have an `accounts` array containing `account` objects, each with its own `id` field. In each case, consequent would use these ids to load the events for those account instances and then play them against the object's event handlers allowing it to build up its own state representation based on those events.
