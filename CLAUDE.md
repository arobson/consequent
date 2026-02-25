# consequent

An actor-based event sourcing framework implementing CQRS. Actors receive commands, produce events, and have their state rebuilt by replaying those events. Built on `fount` (DI), `node-flakes` (IDs), and pluggable storage/cache/search adapters.

## Mental Model

**Command** → handler inspects state → returns **events** → events are stored + applied to state → **new snapshot**.

- Command handlers: decide *what* happened. Return events. Never mutate state directly.
- Event handlers: apply *what* happened. Mutate state directly. Must be pure/deterministic — no I/O, clocks, or randomness.
- State is rebuilt on read by: latest snapshot + events since snapshot.

## Actor Module Structure

Actor files must end in `_actor.js` (or `_actor.ts`) and live in `./actors/` (configurable). Each exports a default function — parameters are injected by `fount`.

```typescript
// actors/account_actor.ts
export default function (/* fount-injected deps */) {
  return {
    actor: {
      namespace: 'banking',          // groups related types in storage
      type: 'account',               // prefix for all events: 'account.opened', etc.
      identifiedBy: 'accountNumber', // the business ID field in state
      eventThreshold: 50,            // create snapshot every N events (default: 50)
      searchableBy: ['status', 'owner.email']  // fields to index for find()
    },
    state: {                         // default initial state (or a factory fn)
      accountNumber: '',
      balance: 0,
      status: 'pending'
    },
    commands: {
      // Handler function only (simplest form)
      open: handleOpen,

      // Conditional handlers (evaluated in order, exclusive: true stops at first match)
      withdraw: [
        { when: canWithdraw, then: handleWithdraw },
        { when: insufficientFunds, then: denyWithdrawal }
      ]
    },
    events: {
      opened: onOpened,
      deposited: onDeposited,
      withdrawn: onWithdrawn,

      // Cross-type event: prefix must match source actor's type
      'payment.processed': onPaymentProcessed
    }
  }
}
```

## Command Handlers

```typescript
// Parameter names are mapped from the command message by default (map: true)
function handleOpen(account: AccountState, initialDeposit: number) {
  return { type: 'account.opened', initialDeposit }  // single event
}

// Or return an array of events (can target other actor types)
function handleWithdraw(account: AccountState, amount: number, payeeId: string) {
  return [
    { type: 'account.withdrawn', amount },
    { type: 'payment.queued', amount, payeeId }  // routes to 'payment' actor type
  ]
}

// map: false — receives the full message object
function handleOpen(account: AccountState, command: { initialDeposit: number }) {
  return { type: 'account.opened', initialDeposit: command.initialDeposit }
}
```

## Event Handlers

```typescript
// Must be deterministic pure functions — no I/O, clocks, random
// Mutate state directly (consequent clones before passing)
function onOpened(account: AccountState, initialDeposit: number) {
  account.status = 'open'
  account.balance = initialDeposit
}

function onWithdrawn(account: AccountState, amount: number) {
  account.balance -= amount
}
```

## Predicates (for conditional commands)

```typescript
function canWithdraw(account: AccountState, amount: number) {
  return account.status === 'open' && account.balance >= amount
}

// String shorthand: when: 'open' is equivalent to (state) => state.state === 'open'
```

## State Machine Pattern

```typescript
commands: {
  submit: { when: 'draft', then: handleSubmit },  // only when state.state === 'draft'
  approve: { when: 'pending', then: handleApprove }
}
events: {
  submitted: (order, _) => { order.state = 'pending' },
  approved: (order, _) => { order.state = 'approved' }
}
```

## Initialization

```typescript
import consequent from 'consequent'
import { initialize as pgAdapters } from 'consequent-postgres'

const stores = pgAdapters({ connectionString: 'postgresql://...' })

const system = await consequent({
  // Required: storage adapters
  actorStore: stores.actor,         // durable snapshot storage
  eventStore: stores.event,         // durable event log

  // Optional: performance adapters
  actorCache: stores.actorCache,    // fast snapshot reads (e.g. Redis)
  eventCache: stores.eventCache,    // fast event reads
  searchAdapter: stores.search,     // enable find() queries

  // Optional: configuration
  actors: './src/actors',           // path to actor modules (default: ./actors)
  concurrencyLimit: 8,              // per-actor command queue depth
  fount: myFountInstance,           // custom DI container (auto-imported if omitted)
  nodeId: 'node-1'                  // for vector clocks (default: process.title-pid)
})
```

## API

```typescript
// Process a command — routes to matching actor type by topic prefix
await system.handle(actorId, 'account.withdraw', { amount: 50 })

// Fetch current actor state (creates if not exists)
const account = await system.fetch('account', 'ACC-001')
const accounts = await system.fetchAll('account', ['ACC-001', 'ACC-002'])

// Search (requires searchAdapter + searchableBy fields on actor)
const results = await system.find('account', [{ status: 'active' }])

// Apply events to an actor instance directly (bypass command routing)
await system.apply(actorInstance, event)

// Streaming
const actorSnapshots = system.getActorStream('account', 'ACC-001', options)
const events = system.getEventStream(options)
for await (const snapshot of actorSnapshots) { ... }
```

## Event Structure

Command handlers return these fields; consequent enriches the rest:

```typescript
{
  type: 'account.withdrawn',   // REQUIRED: actorType.eventName
  amount: 50,                  // any payload fields

  // Optional overrides:
  _actorId: 'other-actor-id', // target a different actor instance explicitly
  _indexBy: { byDate: '2024-01-01' }  // index for getEventsByIndex()
}
```

## Cross-Type Event Aggregation

A view actor can consume events from other actor types:

```typescript
// In the view actor:
events: {
  'account.withdrawn': onWithdrawn,   // 'account' prefix → consequent loads account events
  'payment.processed': onProcessed    // 'payment' prefix → loads payment events
}
```

Consequent discovers *which* instances to load by examining the view actor's state for fields like `accountId`, `accountIds`, or `accounts: [{ id: '...' }]`.

## Gotchas

- **Event handlers must be pure**: They are replayed many times. Any side effects (HTTP calls, DB writes, random values, timestamps) will multiply and corrupt state during healing.
- **Events must not produce events**: No mechanism deduplicates side-effect events during replay.
- **Single writer per actor**: On a single node, consequent queues commands per actor. Across nodes, you must route by actor ID (consistent hashing) or use the coordination adapter.
- **`identifiedBy` field**: This is the business key you pass to `handle()` and `fetch()`. The system ID (`_id`, a flake ID) is internal — don't reference it in application code.
- **Actor files**: Must end in `_actor.js` or `_actor.ts`. The loader ignores other files in the actors directory.
- **`when` string shorthand**: Checks `state.state === 'stateName'`, not `state.status`. Ensure your state machine field is named `state`.

## Used With

- `consequent-postgres` — provides `actorStore`, `eventStore`, `searchAdapter`
- `fount` — DI container for actor module dependencies
- `node-flakes` — generates event and actor IDs internally
