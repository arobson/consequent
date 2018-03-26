const { sortBy, unique } = require('fauxdash')
const log = require('./log')('consequent.events')

function findEvents (adapters, storeLib, type, criteria, lastEventId, noError) {
  const store = getStore(adapters, storeLib, type)

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

  return store.findEvents(criteria, lastEventId)
    .then(onEvents, onError)
}

function getAdapter (adapters, lib, io, type) {
  let adapter = adapters[ io ][ type ]
  if (!adapter) {
    adapter = lib.create(type)
    adapters[ io ][ type ] = adapter
  }
  return adapter
}

function getCache (adapters, cacheLib, type) {
  return getAdapter(adapters, cacheLib, 'cache', type)
}

function getStore (adapters, storeLib, type) {
  return getAdapter(adapters, storeLib, 'store', type)
}

function getEventsFromCache (adapters, cacheLib, type, id, lastEventId, noError) {
  let cache = getCache(adapters, cacheLib, type)

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

  return cache
    .getEventsFor(id, lastEventId)
    .then(onEvents, onError)
}

function getEventsFromStore (adapters, storeLib, type, id, lastEventId, noError) {
  let store = getStore(adapters, storeLib, type)

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

  return store
    .getEventsFor(id, lastEventId)
    .then(onEvents, onError)
}

function getPackFromCache (adapters, cacheLib, type, id, vector) {
  let cache = getCache(adapters, cacheLib, type)

  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get eventpack for '${type}' of '${id}' from cache with ${err}`
    log.error(error)
    return []
  }

  return cache
    .getEventPackFor(id, vector)
    .then(onEvents, onError)
}

function getPackFromStore (store, type, id, vector) {
  function onEvents (events) {
    return events || []
  }

  function onError (err) {
    let error = `Failed to get eventpack for '${type}' of '${id}' from store with ${err}`
    log.error(error)
    return []
  }

  return store
    .getEventPackFor(id, vector)
    .then(onEvents, onError)
}

function getEvents (adapters, storeLib, cacheLib, type, id, lastEventId, noError) {
  function onEvents (cachedEvents) {
    if (cachedEvents.length === 0) {
      return getEventsFromStore(adapters, storeLib, type, id, lastEventId, noError)
    } else {
      return cachedEvents
    }
  }

  return getEventsFromCache(adapters, cacheLib, type, id, lastEventId, noError)
    .then(onEvents)
    .then(function (events) {
      return sortBy(events, 'id')
    })
}

function getEventsByIndex (adapters, storeLib, cacheLib, type, indexName, indexValue, lastEventId, noError) {
  let store = getStore(adapters, storeLib, type)

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

  return store.getEventsByIndex(indexName, indexValue, lastEventId)
    .then(onEvents, onError)
}

function getEventStream (adapters, storeLib, cacheLib, type, id, options) {
  let store = getStore(adapters, storeLib, type)
  return store.getEventStreamFor(id, options)
}

function getPack (adapters, storeLib, cacheLib, type, id, vector) {
  let store = getStore(adapters, storeLib, type)

  function onEvents (cachedEvents) {
    if (cachedEvents.length === 0) {
      return getPackFromStore(store, type, id, vector)
    } else {
      return cachedEvents
    }
  }

  if (store.getEventPackFor) {
    return getPackFromCache(adapters, cacheLib, type, id, vector)
      .then(onEvents)
      .then(function (events) {
        return sortBy(events, 'id')
      })
  } else {
    return Promise.resolve([])
  }
}

function storeEvents (adapters, storeLib, cacheLib, type, id, events) {
  let store = getStore(adapters, storeLib, type)
  let cache = getCache(adapters, cacheLib, type)

  function onCacheError (err) {
    let error = `Failed to cache events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored () {
    return cache.storeEvents(id, events)
      .then(null, onCacheError)
  }

  function onStoreError (err) {
    let error = `Failed to store events for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return store
    .storeEvents(id, events)
    .then(onStored, onStoreError)
}

function storePack (adapters, storeLib, cacheLib, type, id, vector, lastEventId, events) {
  events = Array.isArray(events) ? events : [ events ]
  let store = getStore(adapters, storeLib, type)
  let cache = getCache(adapters, cacheLib, type)

  function onCacheError (err) {
    let error = `Failed to cache eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored (pack) {
    return cache.storeEventPack(id, vector, pack)
      .then(null, onCacheError)
  }

  function onStoreError (err) {
    let error = `Failed to store eventpack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onEvents (loadedEvents) {
    let pack = unique(loadedEvents.concat(events), function (x) {
      return x.id
    })
    return store.storeEventPack(id, vector, pack)
      .then(onStored.bind(null, pack), onStoreError)
  }

  function onEventsError (err) {
    let error = `Failed to fetch events to pack for '${type}' of '${id}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  if (store.storeEventPack) {
    return getEvents(adapters, storeLib, cacheLib, type, id, lastEventId)
      .then(onEvents, onEventsError)
  } else {
    return Promise.resolve()
  }
}

module.exports = function (eventStoreLib, eventCacheLib) {
  const adapters = {
    store: {},
    cache: {}
  }
  return {
    adapters: adapters,
    fetch: getEvents.bind(null, adapters, eventStoreLib, eventCacheLib),
    fetchByIndex: getEventsByIndex.bind(null, adapters, eventStoreLib, eventCacheLib),
    fetchStream: getEventStream.bind(null, adapters, eventStoreLib, eventCacheLib),
    fetchPack: getPack.bind(null, adapters, eventStoreLib, eventCacheLib),
    store: storeEvents.bind(null, adapters, eventStoreLib, eventCacheLib),
    storePack: storePack.bind(null, adapters, eventStoreLib, eventCacheLib)
  }
}
