# Coordination Adapter

Consequent can opt into using an external coordination service to provide guarantees around distributed mutual exclusion.

The expectation is that a lock will be acquired by a service using consequent and held during the lifecycle of the service.

Consequent's preference is for commands and events to be routed to instances via a form of consistent hashing. This avoids system-wide log-jams behind lock acquisition per id which can make a **big difference** in throughput under high read or write loads.

## API

Calls should return promises.

### `acquire (id, [timeout])`

Acquires a lock for an id. When in use, Consequent will not attempt to process a command or event until after the lock has been acquired.

### `release (id)`

Release the lock for a specific id.
