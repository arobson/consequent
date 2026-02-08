# Actor Models

An actor model defines behavior in the system: how the actor responds to [commands](concepts.md#commands) and which [events](events.md) it combines to determine its state. For the conceptual foundation, see [concepts](concepts.md). For a step-by-step walkthrough, see [getting started](GETTING_STARTED.md).

## Modules

Consequent loads modules ending with an `_actor.js` suffix from an `./actors` path by default, but allows this path to be changed during initialization. Each module must export a function that returns an object with the following properties:

 * `actor` — metadata and configuration
 * `state` — default state object or a factory to initialize the actor instance
 * `commands` — command handlers
 * `events` — event handlers

Consequent injects dependencies declared as parameters of the exported function via [fount](https://github.com/arobson/fount).

### Example — actor module structure

```js
// actors/counter_actor.js
export default function (dependency1, dependency2) {
  return {
    actor: {},    // metadata
    state: {},    // initial state
    commands: {}, // command handlers
    events: {}    // event handlers
  }
}
```

## `actor`

The `actor` property describes the model and provides metadata that controls how consequent and the [storage adapters](storage-adapters.md) interact with it.

### Required fields

 * `namespace` — groups related actors; used by storage adapters to organize data
 * `type` — the actor's unique type name; commands and events use this as a prefix (e.g., `account.open`)
 * `identifiedBy` — the name of a state field that acts as the business identifier for this actor. It should be unique across all instances and is what you use to send commands and fetch state. Consequent maintains a separate internal system ID in `_id` (see [identity](concepts.md#identity))

### Optional fields

 * `eventThreshold` — number of events applied before a [snapshot](concepts.md#snapshots) is created (default: 50)
 * `storeEventPack` — store all events contributing to a snapshot as an [event pack](SPECIFICATION.md#29-event-packs) (default: false)
 * `snapshotOnRead` — allow snapshot creation during read operations (default: false)
 * `aggregateFrom` — actor types whose events this actor consumes; populated automatically from prefixed event handler keys (see [event aggregation](#aggregating-events-from-multiple-types))
 * `searchableBy` — state fields to index for [search queries](search-adapter.md); supports dot notation for nested fields (e.g., `'vehicle.location'`)

## State fields

Consequent adds the following system-managed fields to actor state. None of these should ever be manipulated directly. See the [specification](SPECIFICATION.md#22-actor-state) for detailed descriptions of each field.

 * `_id` — system-generated unique [flake ID](SPECIFICATION.md#appendix-flake-ids)
 * `_vector` — serialized [vector clock](concepts.md#vector-clocks)
 * `_version` — scalar version (sum of vector clock components)
 * `_ancestor` — vector clock of the previous snapshot
 * `_eventsApplied` — cumulative count of events applied
 * `_lastEventId` — flake ID of the most recently applied event
 * `_lastCommandId` — flake ID of the most recently processed command
 * `_lastCommandHandledOn` — ISO 8601 timestamp
 * `_lastEventAppliedOn` — ISO 8601 timestamp

### `_id` and `identifiedBy`

`_id` is a [flake ID](SPECIFICATION.md#appendix-flake-ids) that provides efficient storage, guaranteed uniqueness, and immutability. You specify which field in the model serves as the business identifier through `identifiedBy`. This separation avoids cascading updates if the business identifier ever changes and ensures optimal storage performance, since most databases prefer monotonically increasing primary keys over random values. See [identity](concepts.md#identity) for the full rationale.

# Message Handling (Commands & Events)

Consequent supports two types of messages: [commands](concepts.md#commands) and [events](concepts.md#events). Commands express intent and are processed conditionally, producing one or more events. Events represent something that has already happened and are applied to the actor's state.

## Caution — events should not produce events

Consequent may replay the same event against an actor many times before the resulting state is captured as a snapshot. There are no built-in mechanisms to deduplicate events generated as a side effect of replaying another event. See [trade-offs](concepts.md#events-must-not-produce-events).

## Definition

The `commands` and `events` properties are defined as objects where each key is the message type/topic and the value takes one of three formats. Each handler definition has four properties that consequent uses to determine when and how to call the handler. See the [specification](SPECIFICATION.md#3-handler-definitions) for the full normalization rules.

 * `when` — a boolean, predicate function, or state name that controls when the handler is called
 * `then` — the handler function to call
 * `exclusive` — when true, the first handler with a passing `when` is the only handler called (default: true)
 * `map` — controls [argument mapping](SPECIFICATION.md#33-argument-mapping); when true, message properties are mapped to handler parameter names (default: true)

> Events from another actor type must be prefixed with that type's name and a dot: `'vehicle.departed'`

> When `when` is a string, the handler is invoked only if `state.state` matches that string. This enables state-machine patterns.

### Object definition

The only required field is `then`. If that's all you need, provide the handler function directly (see [function only](#handler-function-only) below).

```js
{
  when: true,          // boolean | predicate | state name (default: true)
  then: handler,       // handler function
  exclusive: true,     // boolean (default: true)
  map: true            // boolean (default: true)
}
```

### Array shorthand

Positional shorthand for the object form:

```js
[when, then, exclusive, map]
```

### Handler function only

If the defaults for `when`, `exclusive`, and `map` are sufficient, provide the function directly instead of wrapping it in an object:

```js
commands: {
  open: account.open  // equivalent to { when: true, then: account.open, exclusive: true, map: true }
}
```

## Handler functions

A **command handler** returns an event object or an array of event objects (or a promise that resolves to either). The events describe what happened as a result of the command. See [events](events.md) for the required event structure.

An **event handler** mutates the actor's state directly based on the event data and returns nothing. Consequent clones the state before passing it to event handlers, so direct mutation is safe. See [state reconstruction](concepts.md#state-reconstruction).

### Handler examples

```js
// ── Command handlers ──────────────────────────────────────

// With argument mapping: parameter names match message properties
function handleIncrement (counter, amount) {
  return { type: 'counter.incremented', amount }
}

// Without argument mapping (map: false): receives the full message
function handleIncrement (counter, command) {
  return { type: 'counter.incremented', amount: command.amount }
}

// ── Event handlers ────────────────────────────────────────

// With argument mapping
function onIncremented (counter, amount) {
  counter.value += amount
}

// Without argument mapping
function onIncremented (counter, event) {
  counter.value += event.amount
}
```

### Conditional handlers

The `when` predicate determines which handler is called. Because `exclusive` defaults to `true`, consequent stops evaluating handlers after the first match. Define handlers in priority order with a fallback last.

```js
import account from './account.js'

// ...
  commands: {
    withdraw: [
      { when: account.canWithdraw, then: account.withdraw },
      { when: account.insufficientFunds, then: account.denyWithdrawal }
    ]
  },
  events: {
    withdrawn: account.onWithdraw
  }
```

> Conditional event handling is possible but rarely needed. Because events represent things that have already happened, branching on state during replay can produce surprising results if the state has changed between replays. Use conditional event handlers only if you fully understand the implications.

### Full actor example — state as a default object

```js
// Predicates, command handlers, and event handlers should live in
// a separate model module of pure functions
import model from './model.js'

export default function () {
  return {
    actor: {
      namespace: 'example',
      type: 'counter',
      eventThreshold: 100,
      identifiedBy: 'name'
    },
    state: {
      name: '',
      value: 0
    },
    commands: {
      increment: model.increment
    },
    events: {
      incremented: model.onIncremented
    }
  }
}
```

### Full actor example — state as a factory

A factory function receives the actor's ID and can return a state object or a promise for one. The promise form allows state to be initialized from I/O, which is useful when migrating from a traditional data access approach.

```js
export default function (legacyDatabase) {
  return {
    actor: {
      namespace: 'example',
      type: 'counter',
      eventThreshold: 100,
      identifiedBy: 'name'
    },
    state: function (id) {
      return legacyDatabase.getOriginalRecord(id)
    },
    commands: { /* ... */ },
    events: { /* ... */ }
  }
}
```

## Predicate Functions

Predicates receive the current state as the first argument. Subsequent arguments follow the same [mapping rules](SPECIFICATION.md#33-argument-mapping) as handlers: either mapped from message properties by parameter name, or the full message if mapping is disabled.

```js
// With argument mapping
function canWithdraw (account, amount) {
  return account.open && account.balance >= amount
}

// Without argument mapping
function canWithdraw (account, command) {
  return account.open && account.balance >= command.amount
}
```

## Aggregating Events From Multiple Types

Consequent populates `aggregateFrom` automatically by inspecting event handler keys for type prefixes that differ from the current actor's type. When a trip actor defines a handler for `'vehicle.departed'`, consequent adds `'vehicle'` to the trip's `aggregateFrom` list.

To load events from related actors, consequent needs to determine which instances of the source type belong to the current actor. It resolves this by examining state fields that follow naming conventions:

 * `vehicleId` — a single related ID
 * `vehicleIds` or an array field named for the plural (`vehicles`) containing objects with `id` properties — multiple related IDs

See the [specification](SPECIFICATION.md#511-cross-type-event-aggregation) for the full resolution algorithm.

### Why not load related objects directly?

Loading related objects by foreign key would skip event replay entirely, preventing the actor from applying its own interpretation of those events. Different actors may process the same events in different ways — a reporting model might compute statistics from transaction events, while the account model uses them to track balance. Independent event processing per actor is what makes [view models](concepts.md#models-and-views) possible.

### Example

To aggregate financial transactions for an individual across multiple accounts, define an actor with an `accountIds` array containing the relevant account IDs (or an `accounts` array of objects each with an `id` property). Consequent uses these IDs to load events from those account instances and replays them through the actor's event handlers, allowing it to build its own state representation from those events.
