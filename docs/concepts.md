# Concepts

Terminology used throughout this library and documentation may be unfamiliar or, worse, have a slightly different application than what you are accustomed to if you have a formal CS background or have worked with other distributed systems.

In other words - read this or you may have a bad time.

## High Level

Models defined are treated as [actors](https://en.wikipedia.org/wiki/Actor_model) that receive commands, in order to produce events which are later used in order to affect changes to the actor's state. Events are always "played" or "applied" against the model in the order they were produced as one of the guarantees that consequent provides.

Events are stored individually and provide a system of record and serve as the "source of truth" for the system. Consequent can publish and consume these events between instances via a messaging adapter in order to make integration and asynchronous state propagation possible.

Snapshots are created from model's state after periodic replays of events in order to reduce the number of events that need to be replayed each time a model's state is needed.

View models can be created that simply exist to aggregate events from several other models in order to provide information/answer questions.

Search operations against snapshots of the model's state are made possible by defining which properties on a model should be indexed by the (optional) search adapter to support future search operations.

### A Note About Prior Art

This approach borrows from event sourcing, CQRS and CRDT work done by others. It is not original, but does borrow heavily from each of these ideas to provide a uniform data access pattern that adapts to various distributed systems challenges.

### Events

An event represents a discrete set of changes that have happened in the system as the result of processing a command message. Consequent adds metadata to the event so that it has:
 * information about the command that generated it
 * the type that generated it
 * the (primary) type that it mutates
 * a actorId linking it to the primary actor id it should mutate
 * the vector clock of the model at the time it was generated
 * a flake id that gives it a relative global order
 * a timestamp

When the actor's present state is desired, events are loaded and ordered by time + the event's flake id and then applied after latest available actor snapshot resulting in the 'best known current actor state'.

> Note: the actorId will be the flake id generated for the actor vs. any friendly identifier assigned to the actor instance by the model/application. See the Actor Identity section for a full explanation why.

### Actors

An actor is identified by a unique flake id and a vector clock. Instead of mutating and persisting actor state after each message, actors return one or more events as the result of processing a command.

Before a command handle is called, the actor's latest available state is determined by

 * loading the latest available snapshot
 * all events since the snapshot from storage
 * applying all events to the actor's event handlers

__The Importance of Isolation__

The expectation in this approach is that actors' command messages will be processed in isolation at both a machine and process level. No two command messages for an actor should be processed at the same time in an environment. Allowing multiple commands to be processed in parallel is the same as creating a network partitions.

#### Actor Identity

The type metadata allows your model to specify one or more fields that provide a friendly unique identifier for the actor that you will send commands to and request state by so that you do not need to know the flake id for the instance. This is to prevent any possible situation where this identifier may change needing to update every place in the system where the friendly id was used since it is only used to look up the instance and not used as the true record id. This is also done because most storage systems will perform better against consistently increasing values vs. random values (which human friendly identifiers almost always are). It is also done in the event that multiple fields are desired to identify an instance in which case storing these as a clustered index that's only purpose is used for lookup prevents this kind of identity from propagating through the system into things like event and search storage.

#### Aggregating Events From Related Types

A major advantage of eventsourcing (and consequent) is the ability to construct new view models which answer specific questions by aggregating the events produced by multiple types. In order to do this the model only needs to have enough metadata to derive which events from each target type effectively belong to it. (more specifics are available in the [actor models document](/docs/actor-models.md))

#### A Note About Functional Purity And State Mutation

Event handlers mutate state directly instead of returning a new copy of the actor's state with a change made. Consequent makes an initial clone of the state and then passes that to each event handler with the each respective event.

This removes the need for the developer to think about how to implement certain mutations as pure functions.

### Snapshotting

After some threshold of applied events is crossed, the resulting actor will be persisted with a new vector clock to prevent the number of events that need to be applied from creating an unbounded negative impact to performance over time.

If reads are allowed in parallel, then a read-only flag is required to prevent race conditions or conflicts during snapshot creation. The trade-off here is that read-heavy/write-light will either need to set very low snapshot thresholds or risk reading a lot of events on every read.

### Divergent Replicas

In the event of a network partition, if commands or events are processed for the same actor on more than one partition, replicas can result. A replica is another copy of the same actor but with different/diverged state. When this happens, multiple actor instances will be retrieved the next time its state is fetched.

To resolve this divergence, the system will walk the replicas' ancestors to find the first shared ancestor and apply all events that have occured since that ancestor to produce a 'correct' actor state. Think of this like merging two timelines of events by rewinding to the spot where they split and forcing the all the events that happened on both sides to happen in one and then tossing out the other so it's like the split never occurred.

### Ancestors
An ancestor is a previous snapshot identified by the combination of the actor id and the vector clock. Ancestors exist primarily to resolve divergent replicas that may occur during a partition.

> Note - some persistence adapaters may include configuration to control what circumstances snapshots (and therefore ancestors) can be created under. Avoiding divergence is preferable but will trade performance for simplicity if partitions are frequent or long-lived.

### Event Packs

During snapshot creation, all events that were applied are optionally stored as a single record identified by the actor's vector and id. Whenever divergent actors are being resolved, if event packs are supported by the event store, they will be loaded to provide a deterministic set of events to apply against the common ancestor.

If the event store does not support these (and many storage technologies may have difficulty with large binary blobs) consequent will load the events themselves from their stores instead of using the packs.

### Vector Clocks

The ideal circumstances should limit the number of nodes that would participate in creation of a snpashot. A small set of nodes participating in mutation of a record should result in a manageable vector clock. In reality, there could be a large number of nodes participating over time. The vector clock library in use allows for pruning these to keep them managable.

> Note - consequent does not allow the database to supply these since it handles detection of divergence and merging. It doesn't matter if the database provides one, it won't get used.

### k-ordered ids

I just liked saying k-ordered. It just means "use flake". This uses our node library, [node-flakes](https://npmjs.org/node-flakes) which provides 128 bit keys in a base 62 format string.

### Models vs. Views

Actors can be thought of as a model, an actor that processes commands and produces events, or a view, an actor that only aggregates events produced by other models. The intent is to represent application behavior and features through models and use views to simply aggregate events to provide read models or materialized views for the application.

This provides CQRS at an architectural level in that model actors and view actors can be hosted in separate processes that use specialized transports/topologies for communication.

## If LWW Is All You Need

Event sourcing is a bit silly if you don't mind losing data. Chances are if LWW is fine then you're dealing with slowly changing dimensions that have very low probability of conflicting changes.

Traditional LWW approaches miss out on uniform data access models and other advantages of using events but they are more common.

## Preventing Divergence / Strong Consistency Guarantees

This library is intended to prioritize availability and partition tolerance and sacrifices strong consistency by throwing it straight out the window in the event of storage node failures.

There's no way to get selectively strong consistency in consequent for now. It relies entirely on the storage provider to ensure connectivity or identical responses from all servers during every read/write.

This also means accepting that in the event of any node failure in your storage layer that every operation would fail.
