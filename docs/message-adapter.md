# Message Adapter
The message adapters job is to plug a potential stream of incoming commands and events into Consequent's actors while also providing a means to publish events that result from processing commands.

The message adapter should handle all transport related concerns.

Responsibilites:

 * Manage connectivity to the transport
 * Serialization/Deserialization of messages
 * Routing, subscriptions and other transport implementations
 * Delivery of commands and events to Consequent
 * Publishing events that result from processing commands

## API

Calls should return promises.

### `onMessages (consequent.handle)`

Wires consequent's `handle` method into the transport abstraction. This should handle incoming commands and events.

### `handleEvents (consequent)`

Provides the opportunity to wire in events emitted by consequent during command processing to the transport.
