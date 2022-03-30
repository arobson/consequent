const { clone, defaults, map } = require('fauxdash')
const clock = require('./vector')
const log = require('./log')('consequent.actors')

function checkCacheForId (cache, type, id, asOf) {
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

function checkStoreForId (store, type, id, asOf) {
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

function createId (flakes, cache, store, id) {
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
  function onError (err) {
    let error = `Failed to get instance '${id}' of '${type}' from cache with ${err.stack}`
    log.error(error)
    return undefined
  }

  return getCache(type)
      .then(
        cache => cache.fetch(id)
          .then(
            instance => instance ?
              onActor(type, id, true, instance) : null,
            onError
          ),
        onCacheAdapterFailure.bind(null, type)
      )
}

function getActorFromStore (getStore, onActor, type, id) {
  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      store => {
        return store.fetch(id)
        .then(
          onActor.bind(null, type, id, true),
          onError
        ) },
      onStoreAdapterFailure.bind(null, type)
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
    .then(
      onResult,
      () => {
        return getActorFromStore(getStore, onActor, type, id)
      }
    )
}

function getBaselineByEventDate (getStore, getCache, onActor, type, id, lastEventDate) {
  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventDate from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      store => store.fetchByLastEventDate(id, lastEventDate)
        .then(
          onActor.bind(null, type, id, true),
          onError
        ),
      onStoreAdapterFailure.bind(null, type)
    )
}

function getBaselineByEventId (getStore, getCache, onActor, type, id, lastEventId) {
  function onError (err) {
    var error = `Failed to get instance '${id}' of '${type}' by lastEventId from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      store => store.fetchByLastEventId(id, lastEventId)
        .then(
          onActor.bind(null, type, id, true),
          onError
        ),
      onStoreAdapterFailure.bind(null, type)
    )
}

function getSystemId (flakes, getStore, getCache, create, type, id, asOf) {
  return Promise.all([
    getCache(type),
    getStore(type)
  ])
  .then(
    ([cache, store]) => {
      return checkCacheForId(cache, type, id, asOf)
        .then(
          x => {
            if (x) {
              return x
            } else {
              return checkStoreForId (store, type, id, asOf)
            }
          }
        )
        .then(
          x => {
            if (x) {
              return x
            } else if (create) {
              return createId(flakes, cache, store, id)
            } else {
              return null
            }
          }
        )
    },
    onEitherAdapterFailure.bind(null, type)
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

function onCacheAdapterFailure (type, err) {
  let error = `Failed to initialize actore cache adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
}

function onEitherAdapterFailure (type, err) {
  let error = `Failed to initialize either actore store or actor cache adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
}

function onStoreAdapterFailure (type, err) {
  let error = `Failed to initialize actore store adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
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

  function onStored (cache) {
    return cache.store(state[ idField ], state._vector, state)
      .then(null, onCacheError)
  }

  function onError (err) {
    var error = `Failed to store actor '${state[ idField ]}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }
  return Promise.all([
    getCache(type),
    getStore(type)
  ])
  .then(
    ([cache, store]) => {
      return store.store(state[ idField ], state._vector, state)
        .then(
          onStored.bind(null, cache),
          onError
        )
    },
    onEitherAdapterFailure.bind(null, type)
  )
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
