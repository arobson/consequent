# Coordination Adapter

The coordination adapter provides distributed mutual exclusion through an external coordination service. It is optional — without it, consequent relies on [divergence detection and healing](concepts.md#divergence-and-healing) to handle concurrent writes from multiple nodes.

When a coordination adapter is configured, consequent acquires a lock before processing any command or event for a given actor. This prevents [divergent replicas](concepts.md#divergence-and-healing) from forming in the first place, at the cost of throughput.

Consequent's preferred alternative is to route commands to nodes via consistent hashing, so that a given actor's commands are always handled by the same node. This avoids system-wide contention from per-ID lock acquisition, which can significantly impact throughput under high read or write loads. See [concurrency control](SPECIFICATION.md#514-concurrency-control) and the [command isolation](concepts.md#command-isolation) trade-off.

For the broader adapter architecture, see [adapters](concepts.md#adapters) in the concepts document.

## API

All methods should return promises.

### `acquire(id, [timeout])`

Acquire a lock for the given actor ID. When in use, consequent will not process a command or event for this actor until the lock has been acquired. The optional `timeout` specifies how long to wait before giving up.

### `release(id)`

Release the lock for the given actor ID.
