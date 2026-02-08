# Getting Started

This guide walks through building actors with consequent using a bank account as the running example. By the end you will understand how commands, events, and state fit together and how to wire up your own actors. For the underlying design rationale, see [concepts](concepts.md). For precise data structures and algorithms, see the [specification](SPECIFICATION.md).

## The Core Idea

In traditional CRUD, you overwrite state directly. In event sourcing, every change is captured as an immutable **event**. The current state of any entity is derived by replaying its events in order. This gives you a complete history and makes it straightforward to build new views of the same data after the fact.

Consequent layers the **actor model** on top of event sourcing:

1. You send a **command** to an actor (identified by type and id).
2. The actor's command handler inspects the current state and returns one or more **events** describing what happened.
3. Each event is stored permanently, then applied to the actor's state through event handlers that mutate it directly.
4. After enough events accumulate, consequent creates a **snapshot** so future reads don't need to replay the entire history.

The result is that your domain logic lives in small, testable functions — predicates, command handlers, and event handlers — and consequent handles identity, ordering, snapshotting, and state reconstruction.

## Project Structure

A typical setup looks like this:

```
project/
  actors/
    account.js          # Pure functions: predicates, command handlers, event handlers
    account_actor.js    # Actor definition: metadata, initial state, wiring
  index.js              # Initialize consequent and start handling commands
```

Actor modules must end with `_actor.js`. Consequent discovers them automatically from the actors directory.

## Step 1: Define the Model

The model is a plain module of pure functions. It has no dependencies on consequent. Separate your domain logic here so it stays easy to test in isolation.

```js
// actors/account.js

// ── Command Handlers ──────────────────────────────────────
// Receive the current state and command properties.
// Return one event (object) or several (array).

function open (account, accountHolder, accountNumber, initialDeposit) {
  return [
    {
      type: 'account.opened',
      accountHolder,
      accountNumber
    },
    {
      type: 'account.deposited',
      initial: true,
      amount: initialDeposit
    }
  ]
}

function deposit (account, amount) {
  return {
    type: 'account.deposited',
    amount
  }
}

function withdraw (account, amount) {
  return {
    type: 'account.withdrawn',
    amount
  }
}

function close () {
  return { type: 'account.closed' }
}

// ── Predicates ────────────────────────────────────────────
// Used in conditional handler definitions (see Step 2).
// Receive the current state and the same mapped arguments.

function canWithdraw (account, amount) {
  return account.open && account.balance >= amount
}

function isOpen (account) {
  return account.open
}

// ── Event Handlers ────────────────────────────────────────
// Receive the current state and event properties.
// Mutate state directly — consequent clones it first.

function onOpen (account, accountHolder, accountNumber) {
  account.holder = accountHolder
  account.number = accountNumber
  account.open = true
}

function onDeposit (account, amount) {
  account.balance += amount
  account.transactions.push({ credit: amount, debit: 0 })
}

function onWithdraw (account, amount) {
  account.balance -= amount
  account.transactions.push({ credit: 0, debit: amount })
}

function onClose (account) {
  account.transactions.push({ credit: 0, debit: account.balance })
  account.balance = 0
  account.open = false
}

export default {
  // predicates
  canWithdraw,
  isOpen,

  // command handlers
  open,
  deposit,
  withdraw,
  close,

  // event handlers
  opened: onOpen,
  deposited: onDeposit,
  withdrawn: onWithdraw,
  closed: onClose
}
```

A few things to notice:

- **Command handlers** return event objects. They never touch state. The `type` field on each event follows the convention `actorType.eventName`.
- **Event handlers** mutate state in place. Consequent clones the state before passing it in, so you don't need to worry about immutability.
- **Argument mapping**: when a handler declares named parameters beyond the first (`account`), consequent maps properties from the incoming message to those parameter names. So `deposit(account, amount)` receives `command.amount` as `amount` automatically. This means your handler signatures double as documentation of the message shape. See [argument mapping](SPECIFICATION.md#33-argument-mapping) in the specification for details.

## Step 2: Define the Actor

The actor module wires the model functions into consequent's structure. It must export a function (not a plain object) that returns four properties: `actor`, `state`, `commands`, and `events`.

```js
// actors/account_actor.js
import account from './account.js'

export default function () {
  return {
    actor: {
      namespace: 'ledger',
      type: 'account',
      eventThreshold: 5,
      identifiedBy: 'number'
    },
    state: {
      number: '',
      holder: '',
      balance: 0,
      open: false,
      transactions: []
    },
    commands: {
      open: account.open,
      close: account.close,
      deposit: [
        { when: account.isOpen, then: account.deposit },
        () => {}
      ],
      withdraw: [
        { when: account.canWithdraw, then: account.withdraw },
        () => {}
      ]
    },
    events: {
      opened: account.opened,
      closed: account.closed,
      deposited: account.deposited,
      withdrawn: account.withdrawn
    }
  }
}
```

### Actor metadata

| Field | Purpose |
|---|---|
| `namespace` | Groups related actors. Used by storage adapters to organize data. |
| `type` | The actor's name. Commands and events are prefixed with this (`account.open`, `account.opened`). |
| `eventThreshold` | After this many events are applied, consequent creates a snapshot to keep reads fast. |
| `identifiedBy` | Which state field acts as the friendly identifier. You use this value when sending commands and fetching state. Consequent maintains a separate internal system id behind the scenes. |

### Initial state

The `state` object defines the default shape of a new actor instance. When you fetch an actor that doesn't exist yet, you get this state back with the identifier populated.

### Command definitions

Each key under `commands` is a command topic. The value can be:

- **A function** — always called, like `open: account.open`.
- **An array of handlers** — tried in order. Each handler can be a function (always matches) or an object with `when`/`then`. The first handler whose `when` passes is called (exclusive by default). The `() => {}` fallback at the end means "do nothing if no predicate matches" instead of throwing an error.

This is how the `withdraw` command rejects insufficient funds — `canWithdraw` checks the balance, and the empty fallback handles the denial silently.

### Event definitions

Each key under `events` maps an event name to the handler that applies it to state. The key is the event name without the actor type prefix — `opened` handles events with `type: 'account.opened'`.

## Step 3: Initialize and Use

```js
import consequent from 'consequent'

const service = await consequent({
  actors: './actors'
})

// Send a command
const results = await service.handle('0000001', 'account.open', {
  type: 'account.open',
  accountHolder: 'Jane Smith',
  accountNumber: '0000001',
  initialDeposit: 500
})

// results is an array — one entry per actor affected
// results[0].events  → the events produced
// results[0].state   → the actor's state after applying those events
// results[0].original → the state before the command

// Read current state
const instance = await service.fetch('account', '0000001')
// instance.state.balance → 500
// instance.state.open → true
```

### `handle(id, topic, command)`

Sends a command to the actor identified by `id`. The `topic` matches a key in the actor's `commands` definition. Returns an array of result objects.

### `fetch(type, id)`

Loads the latest snapshot, applies any events since that snapshot, and returns the actor instance. If the actor doesn't exist, you get the initial state with the identifier filled in.

### `fetchAll(options)`

Fetch several actors at once. Pass an object where keys are actor types and values are ids:

```js
const records = await service.fetchAll({
  vehicle: 'ABCD0001',
  passenger: 'Test Passenger 1'
})
// records.vehicle.state, records.passenger.state
```

### `find(type, criteria)`

Search for actors by indexed fields (requires `searchableBy` on the actor and a search adapter):

```js
const trips = await service.find('trip', {
  'vehicle.location': '31001',
  'passengers.name': { match: 'Test' }
})
```

## Step 4: Cross-Type Events

One of the most powerful features of event sourcing is that a single command can produce events that affect multiple actor types, and an actor can subscribe to events from other actors.

Consider a trip booking system with three actors: `trip`, `vehicle`, and `passenger`. When a trip is booked, the command handler on the trip actor returns events for both the trip and the vehicle:

```js
function book (trip, vehicle, passengers, origin, destination) {
  return [
    {
      type: 'trip.booked',
      vehicle, passengers, origin, destination
    },
    {
      type: 'vehicle.reserved',
      vehicle, destination
    }
  ]
}
```

The trip actor also listens for events produced by the vehicle and passenger actors:

```js
// In trip_actor.js
events: {
  booked: trip.booked,
  'vehicle.departed': trip.departed,
  'vehicle.arrived': trip.arrived,
  'vehicle.reserved': trip.reserved,
  'passenger.boarded': trip.boarded,
  'passenger.exited': trip.exited
}
```

When an event key is prefixed with another actor's type (like `vehicle.departed`), consequent knows to load events from that type and apply them here. It figures out which instances are related by looking at fields on the state — a `vehicleId` field, a `vehicles` array with `id` properties, etc.

This is how you build **view models** that aggregate state from multiple sources without coupling the source actors to the consumer.

## Dependency Injection

If your model functions need external dependencies (database connections, API clients, etc.), the actor module's exported function can declare them as parameters. Consequent uses [fount](https://github.com/arobson/fount) to inject them:

```js
export default function (emailService) {
  return {
    actor: { ... },
    state: { ... },
    commands: {
      // emailService is available in closure scope
    },
    events: { ... }
  }
}
```

Register dependencies with fount before initializing consequent, or pass your own fount instance in the config.

## Configuration

The minimum configuration is the path to your actor modules:

```js
const service = await consequent({
  actors: './actors'
})
```

Consequent ships with in-memory defaults for all adapters, which is useful for development and testing. For production, supply storage adapters:

```js
const service = await consequent({
  actors: './actors',
  actorStore: myActorStore,
  eventStore: myEventStore,
  actorCache: myActorCache,     // optional
  eventCache: myEventCache,     // optional
  searchAdapter: mySearchAdapter, // optional, enables find()
  concurrencyLimit: 8,          // max parallel operations in the hash queue
  nodeId: 'web-1',              // identifies this node in vector clocks
  logging: { level: 'info' }    // pino log level
})
```

See the [adapter docs](INDEX.md#io-adapter-apis) for the API contracts each adapter must implement.

## What to Read Next

- [Concepts](concepts.md) — Deeper coverage of snapshots, vector clocks, divergent replicas, and consistency trade-offs.
- [Actor Models](actor-models.md) — Full reference for actor metadata, handler definition formats, and predicate functions.
- [Events](events.md) — Event metadata, optional properties, and indexing.
