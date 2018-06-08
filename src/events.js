const { sortBy, unique } = require('fauxdash')
const log = require('./log')('consequent.events')

function findEvents (getStore, type, criteria, lastEventId, noError) {
  function onEvents (events) {
    return sortBy(events, 'id')
  }

  function onError (err) {
    var error = `Failed to get ${type} events by criteria ${criteria} with error ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      store =>
        store.findEvents(criteria, lastEventId)
          .then(
            onEvents,
            onError
          )
      ,
      onStoreAdapterFailure.bind(null, type)
    )
}

function getAdapter (adapters, lib, io, type) {
  let adapter = adapters[ io ][ type ]
  if (!adapter) {
    adapter = lib.create(type)
    adapters[ io ][ type ] = adapter
  }
  return adapter
}

function getEventsFromCache (getCache, type, id, lastEventId, noError) {
  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get events for '${type}' of '${id}' from cache with ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getCache(type)
    .then(
      cache =>
        cache.getEventsFor(id, lastEventId)
          .then(
            onEvents,
            onError
          )
      ,
      onCacheAdapterFailure.bind(null, type, noError)
    )
}

function getEventsFromStore (getStore, type, id, lastEventId, noError) {
  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get events for '${type}' of '${id}' from store with ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      store =>
        store.getEventsFor(id, lastEventId)
        .then(
          onEvents,
          onError
        )
      ,
      onStoreAdapterFailure.bind(null, type)
    )
}

function getPackFromCache (getCache, type, id, vector) {
  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get eventpack for '${type}' of '${id}' from cache with ${err}`
    log.error(error)
    return []
  }

  return getCache(type)
    .then(
      cache => {
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
      onStoreAdapterFailure.bind(null, type, true)
    )
}

function getPackFromStore (getStore, type, id, vector) {
  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get eventpack for '${type}' of '${id}' from store with ${err}`
    log.error(error)
    return []
  }

  return getStore(type)
    .then(
      store => {
        if (store.getEventPackFor) {
          return store.getEventPackFor(id, vector)
            .then(
              onEvents,
              onError
            )
        } else {
          return Promise.resolve([])
        }
      },
      onStoreAdapterFailure.bind(null, type)
    )
}

function getEvents (getStore, getCache, type, id, lastEventId, noError) {
  function onEvents (cachedEvents) {
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

function getEventsByIndex (getStore, getCache, type, indexName, indexValue, lastEventId, noError) {
  function onEvents (events) {
    return sortBy(events, 'id')
  }

  function onError (err) {
    var error = `Failed to get ${type} events by index ${indexName} of ${indexValue} with error ${err}`
    log.error(error)
    if (noError) {
      return []
    }
    throw new Error(error)
  }

  return getStore(type)
    .then(
      store =>
        store.getEventsByIndex(indexName, indexValue, lastEventId)
          .then(
            onEvents,
            onError
          )
      ,
      onStoreAdapterFailure.bind(null, type)
    )
}

function getEventStream (getStore, getCache, type, id, options) {
  return getStore(type)
    .then(
      store => store.getEventStreamFor(id, options),
      onStoreAdapterFailure.bind(null, type)
    )
}

function getPack (getStore, getCache, type, id, vector) {
  function onEvents (cachedEvents) {
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

function onCacheAdapterFailure (type, noErr, err) {
  const error = `Failed to initialize event cache adapter for type '${type}' with ${err.stack}`
  log.error(error)
  if (noErr) {
    return undefined
  }
  throw new Error(error)
}

function onEitherAdapterFailure (type, err) {
  const error = `Failed to initialize event cache or event store adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function onStoreAdapterFailure (type, err) {
  const error = `Failed to initialize event cache adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function storeEvents (getStore, getCache, type, id, events) {
  function onCacheError (err) {
    let error = `Failed to cache events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored (cache) {
    return cache.storeEvents(id, events)
      .then(null, onCacheError)
  }

  function onStoreError (err) {
    let error = `Failed to store events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return Promise.all([
    getStore(type),
    getCache(type)
  ])
  .then(
    ([store, cache]) => {
      return store.storeEvents(id, events)
        .then(
          onStored.bind(null, cache),
          onStoreError
        )
    },
    onEitherAdapterFailure.bind(null, type)
  )

}

function storePack (getStore, getCache, type, id, vector, lastEventId, events) {
  events = Array.isArray(events) ? events : [ events ]

  function onCacheError (err) {
    let error = `Failed to cache eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored (cache, pack) {
    return cache.storeEventPack(id, vector, pack)
      .then(
        null,
        onCacheError
      )
  }

  function onStoreError (err) {
    let error = `Failed to store eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onEvents (store, cache, loadedEvents) {
    let pack = unique(loadedEvents.concat(events), function (x) {
      return x.id
    })
    return store.storeEventPack(id, vector, pack)
      .then(
        onStored.bind(null, cache, pack),
        onStoreError
      )
  }

  function onEventsError (err) {
    let error = `Failed to fetch events to pack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return Promise.all([
    getStore(type),
    getCache(type)
  ])
  .then(
    ([store, cache]) => {
      if (store.storeEventPack) {
        return getEvents(getStore, getCache, type, id, lastEventId)
          .then(
            onEvents.bind(null, store, cache),
            onEventsError
          )
      } else {
        return Promise.resolve()
      }
    },
    onEitherAdapterFailure.bind(null, type)
  )
}

module.exports = function (eventStoreLib, eventCacheLib) {
  const adapters = {
    store: {},
    cache: {}
  }

  const getCache = getAdapter.bind(null, adapters, eventCacheLib, 'cache')
  const getStore = getAdapter.bind(null, adapters, eventStoreLib, 'store')

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
