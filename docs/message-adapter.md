# Message Adapter

The message adapter's job is to connect an external transport (message bus, queue, pub/sub system) to consequent's [command and event](concepts.md#commands) pipeline. It plugs incoming commands and events into the actor system and publishes outgoing events that result from command processing.

The message adapter should handle all transport-related concerns:

 * Connectivity management (connections, reconnection, health checks)
 * Serialization and deserialization of messages
 * Routing, subscriptions, and other transport-specific implementation
 * Delivery of incoming commands and events to consequent
 * Publishing events produced by command processing

For the broader adapter architecture, see [adapters](concepts.md#adapters) in the concepts document.

## API

All methods should return promises.

### `onMessages(consequent.handle)`

Wire consequent's [`handle`](GETTING_STARTED.md#handleid-topic-command) method into the transport. The adapter should route incoming commands and events from the transport to this method.

### `handleEvents(consequent)`

Wire outgoing [events](events.md) into the transport. This method receives the consequent instance and should subscribe to events emitted during command processing, publishing them to the transport for consumption by other services or consequent instances.
