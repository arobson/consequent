const { clone, defaults, map } = require('fauxdash')
const clock = require('./vector')
const log = require('./log')('consequent.actors')

function fetchAll (fetch, options) {
  const results = {}
  const promises = map(options, (ids, type) => {
    if (Array.isArray(ids) && typeof ids !== 'string') {
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

function getActorFromCache (getCache, onActor, type, id) {
  let cache = getCache(type)

  function onError (err) {
    let error = `Failed to get instance '${id}' of '${type}' from cache with ${err}`
    log.error(error)
    return undefined
  }

  return cache.fetch(id)
    .then(
      onActor.bind(null, type, id, false),
      onError
    )
}

function getActorFromStore (getStore, onActor, type, id) {
  let store = getStore(type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetch(id)
    .then(
      onActor.bind(null, type, id, true),
      onError
    )
}

function getBaseline (getStore, getCache, onActor, type, id) {
  function onResult (instance) {
    if (instance) {
      return instance
    } else {
      return getActorFromStore(getStore, onActor, type, id)
    }
  }

  return getActorFromCache(getCache, onActor, type, id)
    .then(onResult)
}

function getBaselineByEventDate (getStore, getCache, onActor, type, id, lastEventDate) {
  let store = getStore(type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventDate from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetchByLastEventDate(id, lastEventDate)
    .then(
      onActor.bind(null, type, id, true),
      onError
    )
}

function getBaselineByEventId (getStore, getCache, onActor, type, id, lastEventId) {
  let store = getStore(type)

  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventId from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return store.fetchByLastEventId(id, lastEventId)
    .then(
      onActor.bind(null, type, id, true),
      onError
    )
}

function getSystemId (flakes, getStore, getCache, create, type, id, asOf) {
  let cache = getCache(type)
  let store = getStore(type)

  function tryCache () {
    if (cache.getSystemId) {
      return cache.getSystemId(id, asOf)
        .then(
          _id => _id,
          err => {
            log.warn(`failed to get system id for '${type}' '${id}' from cache with ${err.stack}`)
            return undefined
          }
        )
    } else {
      return Promise.resolve(undefined)
    }
  }

  function tryStore () {
    if (store.getSystemId) {
      return store.getSystemId(id, asOf)
        .then(
          _id => _id,
          err => {
            log.error(`failed to get system id for '${type}' '${id}' from store with ${err.stack}`)
            throw error
          }
        )
    } else {
      return Promise.resolve(undefined)
    }
  }

  function createId () {
    const _id = flakes.create()
    const promises = []
    if (cache.mapIds) {
      promises.push(cache.mapIds(_id, id))
    }
    if (store.mapIds) {
      promises.push(store.mapIds(_id, id))
    }
    return Promise.all(promises).then(() => _id)
  }

  return tryCache()
    .then(
      x => {
        if (x) {
          return x
        } else {
          return tryStore()
        }
      }
    ).then(
      x => {
        if (x) {
          return x
        } else if (create) {
          return createId()
        } else {
          return null
        }
      }
    )
}

function onActorInstance (getSysId, actors, type, id, createIfMissing, instance) {
  const metadata = actors[ type ].metadata
  if (instance) {
    return Promise.resolve(
      populateActorState(getSysId, actors, metadata, id, instance)
    )
  } else if (createIfMissing) {
    let promise = actors[ type ].factory(id)
    if (!promise.then) {
      promise = Promise.resolve(promise)
    }
    return promise
      .then((state) => {
        return populateActorState(getSysId, actors, metadata, id, instance, state)
      })
  } else {
    return Promise.resolve(undefined)
  }
}

function populateActorState (getSysId, actors, metadata, id, instance = {}, state = {}) {
  let copy = clone(metadata)
  copy.state = defaults(instance, state)
  let field = copy.actor.identifiedBy
  if (!copy.state.id || !copy.state[ field ]) {
    copy.state.id = copy.state[ field ] = id
  }
  if (!copy.state._id) {
    return getSysId(copy.actor.type, copy.state.id)
      .then(
        systemId => {
          copy.state._id = systemId
          log.debug(`Assigning system _id '${copy.state._id}' to model type '${metadata.actor.type}' id '${copy.state.id}'`)
          return copy
        }
      )
  } else {
    return copy
  }
}

function storeSnapshot (flakes, actors, getStore, getCache, nodeId, instance) {
  const actor = instance.actor
  let state = instance.state
  const type = actor.type
  const idField = actors[ type ].metadata.actor.identifiedBy
  const cache = getCache(type)
  const store = getStore(type)
  let vector = clock.parse(state._vector || '')
  clock.increment(vector, nodeId)
  state._snapshotId = flakes.create()
  state._ancestor = state._vector
  state._vector = clock.stringify(vector)
  state._version = clock.toVersion(state._vector)

  function onCacheError (err) {
    const error = `Failed to cache actor '${state[ idField ]}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored () {
    return cache.store(state[ idField ], state._vector, state)
      .then(null, onCacheError)
  }

  function onError (err) {
    var error = `Failed to store actor '${state[ idField ]}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  return store.store(state[ idField ], state._vector, state)
    .then(onStored, onError)
}

module.exports = function (flakes, actors, actorStoreLib, actorCacheLib, nodeId) {
  var adapters = {
    store: {},
    cache: {}
  }
  const getCache = getAdapter.bind(null, adapters, actorCacheLib, 'cache')
  const getStore = getAdapter.bind(null, adapters, actorStoreLib, 'store')
  const getSysId = getSystemId.bind(null, flakes, getStore, getCache)
  const onActor = onActorInstance.bind(null, getSysId.bind(null, true), actors)
  const baseline = getBaseline.bind(null, getStore, getCache, onActor)

  return {
    adapters: adapters,
    fetch: baseline,
    fetchAll: fetchAll.bind(null, baseline),
    fetchByLastEventId: getBaselineByEventId.bind(null, getStore, getCache, onActor),
    fetchByLastEventDate: getBaselineByEventDate.bind(null, getStore, getCache, onActor),
    getSystemId: getSysId,
    onActorInstance: onActor,
    store: storeSnapshot.bind(null, flakes, actors, getStore, getCache, nodeId)
  }
}
