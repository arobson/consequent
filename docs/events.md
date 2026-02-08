# Events

An event describes something that has taken place in the system. Events are immutable — once stored, they are never modified or deleted. They form the permanent record from which all [actor state](concepts.md#state-reconstruction) is derived.

Events should be self-contained: they must carry all the information necessary to describe what happened. An event should never require a read from another system to be understood. For the conceptual role events play, see [concepts](concepts.md#events). For the precise data structure, see the [specification](SPECIFICATION.md#25-events).

## Required Properties

The `type` field is always required. It must include a type prefix that identifies which [actor](actor-models.md) the event primarily applies to, formatted as `actorType.eventName`:

```js
{
  type: 'account.deposited'
}
```

When an event targets a different actor type than the one producing it (a [cross-type event](concepts.md#event-aggregation)), include an identifier for the target actor either explicitly via `_actorId` or implicitly through fields that consequent can resolve using its [naming conventions](SPECIFICATION.md#511-cross-type-event-aggregation).

## System-Enriched Properties

Consequent adds the following metadata to every event after it is returned from a command handler. These fields connect the event to its causal origin and give it a deterministic position in the global timeline.

```js
{
  id: '',                // unique flake ID — provides identity and temporal ordering
  _actorType: '',        // the actor type this event applies to (from the type prefix)
  _actorId: '',          // the business identity of the target actor
  _createdOn: '',        // ISO 8601 timestamp of when the event was created
  _createdBy: '',        // the type of the actor that produced this event
  _createdById: '',      // the system ID (_id) of the producing actor
  _createdByVector: '',  // the vector clock of the producing actor at creation time
  _createdByVersion: 0,  // the version of the producing actor at creation time
  _initiatedBy: '',      // the command type/topic that triggered this event
  _initiatedById: ''     // the ID of the command that triggered this event
}
```

See [event enrichment](SPECIFICATION.md#54-event-enrichment) for the algorithm that populates these fields, and [flake IDs](SPECIFICATION.md#appendix-flake-ids) for the properties of the `id` field.

## Optional Properties

These fields can be set by command handlers to control how consequent processes the event.

```js
{
  // Override the target actor type and ID when producing cross-type events.
  // Normally these are inferred from the event's type prefix and state fields.
  _actorId: '',    // explicitly set the target actor's business ID

  // Index the event for later retrieval via eventStore.getEventsByIndex().
  // As an object: key-value pairs where keys are index names and values are index values.
  _indexBy: {
    indexName: 'indexValue'
  },
  // As an array: names of event properties whose values should be indexed.
  _indexBy: [
    'propertyName'
  ]
}
```
