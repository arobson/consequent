# Search Adapter

> ! Experimental ! - this API is highly experimental and subject to changes.

The goal behind this adapter is to provide a search abstraction that various storage technologies can implement.

If an actor provides a list of `searchableBy` fields, then the storage adpater should receive "eager" updates, not limited by snapshot behavior, by which it can update its search data for the model.

Without this, search results will only be as valid and recent as the last snapshot for the model.

## API

### `create (actorType)`

Creates and returns a searchAdapter instance for a specific type of actor.

### find( criteria )

Criteria is an array with one or more element where each element is a set of criteria which must be true. Each individual element in the array should effectively be OR'd together.

Specific operations are represented as unique key/value sets. Any adapter implementing this API should throw exceptions for any unsupported operations.

### update ( type, fieldList, state, original )

Sends the latest version of state generated from applying all events, including any returned from the latest command.

`fieldlist` contains the list of fields (specified on the actor by `searchableBy`) that the model should be individually searchable by.

### operations

#### equal

```js
{
  x: 100
}
```

#### contains

```js
{
  x: { contains: 100 }
}
```

#### matching / like

```js
{
  x: { match: "pattern" }
}
```

#### in

```js
{
  x: { in: [ 100, 101, 102 ] }
}
```

#### not in

```js
{
  x: { not: [ 100, 101, 102 ] }
}
```

#### greater than

```js
{
  x: { gt: 100 }
}
```

#### less than

```js
{
  x: { lt: 100 }
}
```

#### greater than or equal to

```js
{
  x: { gte: 100 }
}
```

#### less than or equal to

```js
{
  x: { lte: 100 }
}
```

#### between

```js
{
  x: [ lower, upper ]
}
```
