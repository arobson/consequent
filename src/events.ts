import fd from 'fauxdash'
const { sortBy, unique } = fd
import logFn from './log.js'
import type { AdapterLibrary, EventStoreInstance, EventCacheInstance, Event } from './types.js'

const log = logFn('consequent.events')

function findEvents(
  getStore: (type: string) => Promise<EventStoreInstance>,
  type: string,
  criteria: unknown,
  lastEventId: unknown,
  noError?: boolean
): Promise<Event[]> {
  function onEvents(events: Event[]) {
    return sortBy(events, 'id')
  }

  function onError(err: Error) {
    const error = `Failed to get ${type} events by criteria ${criteria} with error ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      (store) =>
        store.findEvents!(criteria, lastEventId)
          .then(
            onEvents,
            onError
          ),
      onStoreAdapterFailure.bind(null, type) as () => never
    )
}

function getAdapter(
  adapters: { store: Record<string, Promise<EventStoreInstance>>; cache: Record<string, Promise<EventCacheInstance>> },
  lib: AdapterLibrary<EventStoreInstance> | AdapterLibrary<EventCacheInstance>,
  io: 'store' | 'cache',
  type: string
): Promise<EventStoreInstance | EventCacheInstance> {
  let adapter = (adapters[io] as Record<string, Promise<unknown>>)[type]
  if (!adapter) {
    adapter = lib.create(type);
    (adapters[io] as Record<string, Promise<unknown>>)[type] = adapter
  }
  return adapter as Promise<EventStoreInstance | EventCacheInstance>
}

function getEventsFromCache(
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  lastEventId: unknown,
  noError?: boolean
): Promise<Event[]> {
  function onEvents(events: Event[] | undefined) {
    return events || []
  }

  function onError(err: Error) {
    const error = `Failed to get events for '${type}' of '${id}' from cache with ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getCache(type)
    .then(
      (cache) =>
        cache.getEventsFor(id, lastEventId)
          .then(
            onEvents,
            onError
          ),
      onCacheAdapterFailure.bind(null, type, noError) as () => never | undefined
    ) as Promise<Event[]>
}

function getEventsFromStore(
  getStore: (type: string) => Promise<EventStoreInstance>,
  type: string,
  id: unknown,
  lastEventId: unknown,
  noError?: boolean
): Promise<Event[]> {
  function onEvents(events: Event[] | undefined) {
    return events || []
  }

  function onError(err: Error) {
    const error = `Failed to get events for '${type}' of '${id}' from store with ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      (store) =>
        store.getEventsFor(id, lastEventId)
          .then(
            onEvents,
            onError
          ),
      onStoreAdapterFailure.bind(null, type) as () => never
    )
}

function getPackFromCache(
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  vector: string
): Promise<Event[] | undefined> {
  function onEvents(events: Event[] | undefined) {
    return events || []
  }

  function onError(err: Error) {
    const error = `Failed to get eventpack for '${type}' of '${id}' from cache with ${err}`
    log.error(error)
    return []
  }

  return getCache(type)
    .then(
      (cache) => {
        if (cache.getEventPackFor) {
          return cache.getEventPackFor(id, vector)
            .then(
              onEvents,
              onError
            )
        } else {
          return undefined
        }
      },
      (onStoreAdapterFailure as (type: string, err: Error) => undefined).bind(null, type) as () => undefined
    )
}

function getPackFromStore(
  getStore: (type: string) => Promise<EventStoreInstance>,
  type: string,
  id: unknown,
  vector: string
): Promise<Event[]> {
  function onEvents(events: Event[] | undefined) {
    return events || []
  }

  function onError(err: Error) {
    const error = `Failed to get eventpack for '${type}' of '${id}' from store with ${err}`
    log.error(error)
    return []
  }

  return getStore(type)
    .then(
      (store) => {
        if (store.getEventPackFor) {
          return store.getEventPackFor(id, vector)
            .then(
              onEvents,
              onError
            ) as Promise<Event[]>
        } else {
          return Promise.resolve([])
        }
      },
      onStoreAdapterFailure.bind(null, type) as () => never
    )
}

function getEvents(
  getStore: (type: string) => Promise<EventStoreInstance>,
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  lastEventId: unknown,
  noError?: boolean
): Promise<Event[]> {
  function onEvents(cachedEvents: Event[]) {
    if (cachedEvents.length === 0) {
      return getEventsFromStore(getStore, type, id, lastEventId, noError)
    } else {
      return cachedEvents
    }
  }

  return getEventsFromCache(getCache, type, id, lastEventId, noError)
    .then(onEvents)
    .then(function (events) {
      return sortBy(events, 'id')
    })
}

function getEventsByIndex(
  getStore: (type: string) => Promise<EventStoreInstance>,
  _getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  indexName: string,
  indexValue: unknown,
  lastEventId: unknown,
  noError?: boolean
): Promise<Event[]> {
  function onEvents(events: Event[]) {
    return sortBy(events, 'id')
  }

  function onError(err: Error) {
    const error = `Failed to get ${type} events by index ${indexName} of ${indexValue} with error ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      (store) =>
        store.getEventsByIndex!(indexName, indexValue, lastEventId)
          .then(
            onEvents,
            onError
          ),
      onStoreAdapterFailure.bind(null, type) as () => never
    )
}

function getEventStream(
  getStore: (type: string) => Promise<EventStoreInstance>,
  _getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  options: Record<string, unknown>
): Promise<unknown> {
  return getStore(type)
    .then(
      (store) => store.getEventStreamFor!(id, options),
      onStoreAdapterFailure.bind(null, type) as () => never
    )
}

function getPack(
  getStore: (type: string) => Promise<EventStoreInstance>,
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  vector: string
): Promise<Event[]> {
  function onEvents(cachedEvents: Event[] | undefined) {
    if (!cachedEvents || cachedEvents.length === 0) {
      return getPackFromStore(getStore, type, id, vector)
    } else {
      return cachedEvents
    }
  }

  return getPackFromCache(getCache, type, id, vector)
    .then(onEvents)
    .then(function (events) {
      return sortBy(events, 'id')
    })
}

function onCacheAdapterFailure(type: string, noErr: boolean | undefined, err: Error): undefined | never {
  const error = `Failed to initialize event cache adapter for type '${type}' with ${err.stack}`
  log.error(error)
  if (noErr) {
    return undefined
  }
  throw new Error(error)
}

function onEitherAdapterFailure(type: string, err: Error): never {
  const error = `Failed to initialize event cache or event store adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function onStoreAdapterFailure(type: string, err: Error): never {
  const error = `Failed to initialize event cache adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function storeEvents(
  getStore: (type: string) => Promise<EventStoreInstance>,
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  events: Event[]
): Promise<void> {
  function onCacheError(err: Error): never {
    const error = `Failed to cache events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored(cache: EventCacheInstance) {
    return cache.storeEvents(id, events)
      .then(undefined, onCacheError)
  }

  function onStoreError(err: Error): never {
    const error = `Failed to store events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return Promise.all([
    getStore(type),
    getCache(type)
  ])
    .then(
      ([store, cache]) => {
        return (store as EventStoreInstance).storeEvents(id, events)
          .then(
            () => onStored(cache as EventCacheInstance),
            onStoreError
          )
      },
      onEitherAdapterFailure.bind(null, type) as () => never
    )
}

function storePack(
  getStore: (type: string) => Promise<EventStoreInstance>,
  getCache: (type: string) => Promise<EventCacheInstance>,
  type: string,
  id: unknown,
  vector: string,
  lastEventId: unknown,
  events: Event[]
): Promise<void> {
  events = Array.isArray(events) ? events : [events]

  function onCacheError(err: Error): never {
    const error = `Failed to cache eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored(cache: EventCacheInstance, pack: Event[]) {
    return cache.storeEventPack!(id, vector, pack)
      .then(
        undefined,
        onCacheError
      )
  }

  function onStoreError(err: Error): never {
    const error = `Failed to store eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onEventsResult(store: EventStoreInstance, cache: EventCacheInstance, loadedEvents: Event[]) {
    const pack = unique(loadedEvents.concat(events), function (x: Event) {
      return x.id
    })
    return store.storeEventPack!(id, vector, pack)
      .then(
        () => onStored(cache, pack),
        onStoreError
      )
  }

  function onEventsError(err: Error): never {
    const error = `Failed to fetch events to pack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return Promise.all([
    getStore(type),
    getCache(type)
  ])
    .then(
      ([store, cache]) => {
        if ((store as EventStoreInstance).storeEventPack) {
          return getEvents(getStore, getCache, type, id, lastEventId)
            .then(
              onEventsResult.bind(null, store as EventStoreInstance, cache as EventCacheInstance),
              onEventsError
            )
        } else {
          return Promise.resolve()
        }
      },
      onEitherAdapterFailure.bind(null, type) as () => never
    )
}

export default function (eventStoreLib: AdapterLibrary<EventStoreInstance>, eventCacheLib: AdapterLibrary<EventCacheInstance>) {
  const adapters = {
    store: {} as Record<string, Promise<EventStoreInstance>>,
    cache: {} as Record<string, Promise<EventCacheInstance>>
  }

  const getCache = getAdapter.bind(null, adapters, eventCacheLib, 'cache') as (type: string) => Promise<EventCacheInstance>
  const getStore = getAdapter.bind(null, adapters, eventStoreLib, 'store') as (type: string) => Promise<EventStoreInstance>

  return {
    adapters: adapters,
    fetch: getEvents.bind(null, getStore, getCache),
    fetchByIndex: getEventsByIndex.bind(null, getStore, getCache),
    fetchStream: getEventStream.bind(null, getStore, getCache),
    fetchPack: getPack.bind(null, getStore, getCache),
    store: storeEvents.bind(null, getStore, getCache),
    storePack: storePack.bind(null, getStore, getCache)
  }
}
