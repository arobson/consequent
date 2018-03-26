const { clone, defaults, map } = require('fauxdash')
const clock = require('./vector')
const log = require('./log')('consequent.actors')

function fetchAll (fetch, options) {
  const results = {}
  const promises = map(options, (ids, type) => {
    if (Array.isArray(ids)) {
      return Promise.all(ids.map((id, index) =>
        fetch(type, id)
          .then(
            instance => {
              if (!results[type]) {
                results[type] = []
              }
              results[type][index] = instance
            },
            err => {
              results[type][index] = err
            }
          )
      ))
    } else {
      return fetch(type, ids)
        .then(
          instance => {
            results[type] = instance
          },
          err => {
            results[type] = err
          }
        )
    }
  })
  return Promise.all(promises)
    .then(
      () => results
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

function getCache (adapters, cacheLib, type) {
  return getAdapter(adapters, cacheLib, 'cache', type)
}

function getStore (adapters, storeLib, type) {
  return getAdapter(adapters, storeLib, 'store', type)
}

function getActorFromCache (actors, adapters, cacheLib, type, id) {
  let cache = getCache(adapters, cacheLib, type)

  function onInstance (instance) {
    let copy
    if (instance) {
      copy = clone(actors[ type ].metadata)
      copy.state = instance
      copy.state.id = id
    }
    return copy
  }

  function onError (err) {
    let error = `Failed to get instance '${id}' of '${type}' from cache with ${err}`
    log.error(error)
    return undefined
  }

  return cache.fetch(id)
    .then(onInstance, onError)
}

function getActorFromStore (actors, adapters, storeLib, type, id) {
  let store = getStore(adapters, storeLib, type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetch(id)
    .then(
      onActorInstance.bind(null, actors, type, id),
      onError
    )
}

function getBaseline (actors, adapters, storeLib, cacheLib, type, id) {
  function onActor (instance) {
    if (instance) {
      return instance
    } else {
      return getActorFromStore(actors, adapters, storeLib, type, id)
    }
  }

  return getActorFromCache(actors, adapters, cacheLib, type, id)
    .then(onActor)
}

function getBaselineByEventDate (actors, adapters, storeLib, cacheLib, type, id, lastEventDate) {
  let store = getStore(adapters, storeLib, type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventDate from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetchByLastEventDate(id, lastEventDate)
    .then(
      onActorInstance.bind(null, actors, type, id),
      onError
    )
}

function getBaselineByEventId (actors, adapters, storeLib, cacheLib, type, id, lastEventId) {
  let store = getStore(adapters, storeLib, type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventId from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetchByLastEventId(id, lastEventId)
    .then(
      onActorInstance.bind(null, actors, type, id),
      onError
    )
}

function onActorInstance (actors, type, id, instance) {
  let promise = actors[ type ].factory(id)
  if (!promise.then) {
    promise = Promise.resolve(promise)
  }
  return promise
    .then((state) => {
      let copy = clone(actors[ type ].metadata)
      if (instance) {
        copy.state = defaults(instance, state)
      }
      copy.state.id = id
      return copy
    })
}

function storeSnapshot (sliver, actors, adapters, storeLib, cacheLib, nodeId, instance) {
  var actor = instance.actor
  var state = instance.state
  var type = actor.type
  var cache = getCache(adapters, cacheLib, type)
  var store = getStore(adapters, storeLib, type)
  var vector = clock.parse(state._vector || '')
  clock.increment(vector, nodeId)
  state._snapshotId = sliver.getId()
  state._ancestor = state._vector
  state._vector = clock.stringify(vector)
  state._version = clock.toVersion(state._vector)

  function onCacheError (err) {
    var error = `Failed to cache actor '${state.id}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored () {
    return cache.store(state.id, state._vector, state)
      .then(null, onCacheError)
  }

  function onError (err) {
    var error = `Failed to store actor '${state.id}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return store.store(state.id, state._vector, state)
    .then(onStored, onError)
}

module.exports = function (sliver, actors, actorStoreLib, actorCacheLib, nodeId, type) {
  var adapters = {
    store: {},
    cache: {}
  }
  const baseline = getBaseline.bind(null, actors, adapters, actorStoreLib, actorCacheLib)
  return {
    adapters: adapters,
    fetch: baseline,
    fetchAll: fetchAll.bind(null, baseline),
    fetchByLastEventId: getBaselineByEventId.bind(null, actors, adapters, actorStoreLib, actorCacheLib, type),
    fetchByLastEventDate: getBaselineByEventDate.bind(null, actors, adapters, actorStoreLib, actorCacheLib, type),
    store: storeSnapshot.bind(null, sliver, actors, adapters, actorStoreLib, actorCacheLib, nodeId)
  }
}
