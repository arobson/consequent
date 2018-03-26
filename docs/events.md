# Event

An event describes a thing that has taken place in the system and becomes a part of your system's permanent record. They cannot (and must never) be changed or altered.

Events should contain 100% of the information necessary to describe what happened. An event should never require a read from a secondary system in order to understand what happened.

## Required Properties

A type is **always** required and should include a type prefix which specifies which actor model the event applies to primarily. In most cases, this will be type of the actor model producing the event.

```js
{
  type: 'model.eventName'
}
```

In cases where another model's type is returned, it is important that an identifier for that model is included explicitly via `_actorId` or implicitly by including metadata on the event itself that consequent can read.

## Supplied Properties

The properties supplied by consequent provide important metadata

```js
{
  id: '', // this will be a generated flake id for this event
  _actorNamespace: '' // inferred from the model emitting the event
  _actorType: '', // the type of the model the event was generated for
  _actorId: '', // this is the addressable identity of the owning model
  _createdOn: '', // UTC ISO date time string when event was created
  _createdBy:  '', // the type of the actor instantiating the event
  _createdById:  '', // the id of the actor instantiating the event
  _createdByVector:  '', // the vector of the actor instantiating the event
  _createdByVersion: '', // the version of the actor instantiating the event
  _initiatedBy: '', // the command type/topic that triggered the event
  _initiatedById: '', // the id of the message that triggered the event
}
```

## Optional Properties
```js
{
  _modelType: '', // override this to produce an event for another model
  _modelId: '', // override to control the id of the model the event is created for
  _indexBy: { // if indexing by values not already defined on the event
    indexName: "indexValue" // key value to index the event by
  },
  _indexBy: [ // if indexing by event properties
    indexName, // the name of the event property to index by for future lookup
  ]
}
```
