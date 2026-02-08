# Search Adapter

The search adapter provides an abstraction for querying [actor state](concepts.md#state-reconstruction) by indexed fields. It is optional — consequent functions without one, but the [`find()`](GETTING_STARTED.md#findtype-criteria) API requires it.

If an actor defines [`searchableBy`](actor-models.md#optional-fields) fields, the search adapter receives eager updates after every [command](concepts.md#commands) — not just at [snapshot](concepts.md#snapshots) time. This ensures search results reflect the most recent state. See [search indexing](SPECIFICATION.md#512-search-indexing) in the specification.

For the full adapter contract, see the [specification](SPECIFICATION.md#46-search-adapter).

## API

### `create(actorType)`

Returns a promise that resolves to a search adapter instance for the specified actor type.

### `find(criteria)`

Find actors matching the given criteria. Criteria is an object where each field maps to a predicate (see [operations](#operations) below). All fields in a single criteria object are AND'd together.

Adapters should throw an error for any unsupported operations.

### `update(fieldList, state, original)`

Update the search index with the latest state produced by applying all events, including those from the most recent command.

`fieldList` contains the fields declared in the actor's [`searchableBy`](actor-models.md#optional-fields) property. `state` is the updated actor state; `original` is the state before the command. The adapter can diff these to determine which index entries need updating.

## Operations

### equal

```js
{ x: 100 }
```

### contains

```js
{ x: { contains: 100 } }
```

### match (regex)

```js
{ x: { match: 'pattern' } }
```

### in

```js
{ x: { in: [100, 101, 102] } }
```

### not in

```js
{ x: { not: [100, 101, 102] } }
```

### greater than

```js
{ x: { gt: 100 } }
```

### less than

```js
{ x: { lt: 100 } }
```

### greater than or equal to

```js
{ x: { gte: 100 } }
```

### less than or equal to

```js
{ x: { lte: 100 } }
```

### between (exclusive bounds)

```js
{ x: [lower, upper] }
```
