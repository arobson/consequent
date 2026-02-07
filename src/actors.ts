import * as clock from './vector.js'
import logFn from './log.js'
import type { ActorMap, ActorInstance, Flakes, AdapterLibrary, ActorStoreInstance, ActorCacheInstance, ActorCacheInstance as CacheInst } from './types.js'

const log = logFn('consequent.actors')

function checkCacheForId(cache: CacheInst, type: string, id: unknown, asOf?: unknown): Promise<string | undefined> {
  if (cache.getSystemId) {
    return cache.getSystemId(id, asOf)
      .then(
        (_id) => _id,
        (err: Error) => {
          log.warn(`failed to get system id for '${type}' '${id}' from cache with ${err.stack}`)
          return undefined
        }
      )
  } else {
    return Promise.resolve(undefined)
  }
}

function checkStoreForId(store: ActorStoreInstance, type: string, id: unknown, asOf?: unknown): Promise<string | undefined> {
  if (store.getSystemId) {
    return store.getSystemId(id, asOf)
      .then(
        (_id) => _id,
        (err: Error) => {
          log.error(`failed to get system id for '${type}' '${id}' from store with ${err.stack}`)
          throw err
        }
      )
  } else {
    return Promise.resolve(undefined)
  }
}

function createId(flakes: Flakes, cache: CacheInst, store: ActorStoreInstance, id: unknown): Promise<string> {
  const _id = flakes()
  const promises: Promise<void>[] = []
  if (cache.mapIds) {
    promises.push(cache.mapIds(_id, id))
  }
  if (store.mapIds) {
    promises.push(store.mapIds(_id, id))
  }
  return Promise.all(promises).then(() => _id)
}

function fetchAll(fetch: (type: string, id: unknown) => Promise<unknown>, options: Record<string, unknown>): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  const promises = Object.keys(options).map((type) => {
    const ids = options[type]
    if (Array.isArray(ids) && typeof ids !== 'string') {
      return Promise.all(ids.map((id: unknown, index: number) =>
        fetch(type, id)
          .then(
            (instance) => {
              if (!results[type]) {
                results[type] = []
              }
              (results[type] as unknown[])[index] = instance
            },
            (err) => {
              if (!results[type]) {
                results[type] = []
              }
              (results[type] as unknown[])[index] = err
            }
          )
      ))
    } else {
      return fetch(type, ids)
        .then(
          (instance) => {
            results[type] = instance
          },
          (err) => {
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

function getAdapter(
  adapters: { store: Record<string, Promise<ActorStoreInstance>>; cache: Record<string, Promise<CacheInst>> },
  lib: AdapterLibrary<ActorStoreInstance> | AdapterLibrary<CacheInst>,
  io: 'store' | 'cache',
  type: string
): Promise<ActorStoreInstance | CacheInst> {
  let adapter = (adapters[io] as Record<string, Promise<unknown>>)[type]
  if (!adapter) {
    adapter = lib.create(type);
    (adapters[io] as Record<string, Promise<unknown>>)[type] = adapter
  }
  return adapter as Promise<ActorStoreInstance | CacheInst>
}

function getActorFromCache(
  getCache: (type: string) => Promise<CacheInst>,
  onActor: (type: string, id: unknown, createIfMissing: boolean, instance: unknown) => Promise<unknown>,
  type: string,
  id: unknown
): Promise<unknown> {
  function onError(err: Error) {
    const error = `Failed to get instance '${id}' of '${type}' from cache with ${err.stack}`
    log.error(error)
    return undefined
  }

  return getCache(type)
    .then(
      (cache) => cache.fetch(id)
        .then(
          (instance) => instance
            ? onActor(type, id, true, instance)
            : null,
          onError
        ),
      onCacheAdapterFailure.bind(null, type)
    )
}

function getActorFromStore(
  getStore: (type: string) => Promise<ActorStoreInstance>,
  onActor: (type: string, id: unknown, createIfMissing: boolean, instance: unknown) => Promise<unknown>,
  type: string,
  id: unknown
): Promise<unknown> {
  function onError(err: Error) {
    const error = `Failed to get instance '${id}' of '${type}' from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      (store) => {
        return store.fetch(id)
          .then(
            onActor.bind(null, type, id, true),
            onError
          )
      },
      onStoreAdapterFailure.bind(null, type)
    )
}

function getBaseline(
  getStore: (type: string) => Promise<ActorStoreInstance>,
  getCache: (type: string) => Promise<CacheInst>,
  onActor: (type: string, id: unknown, createIfMissing: boolean, instance: unknown) => Promise<unknown>,
  type: string,
  id: unknown
): Promise<unknown> {
  function onResult(instance: unknown) {
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

function getBaselineByEventDate(
  getStore: (type: string) => Promise<ActorStoreInstance>,
  _getCache: (type: string) => Promise<CacheInst>,
  onActor: (type: string, id: unknown, createIfMissing: boolean, instance: unknown) => Promise<unknown>,
  type: string,
  id: unknown,
  lastEventDate: unknown
): Promise<unknown> {
  function onError(err: Error) {
    const error = `Failed to get instance '${id}' of '${type}' by lastEventDate from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      (store) => store.fetchByLastEventDate!(id, lastEventDate)
        .then(
          onActor.bind(null, type, id, true),
          onError
        ),
      onStoreAdapterFailure.bind(null, type)
    )
}

function getBaselineByEventId(
  getStore: (type: string) => Promise<ActorStoreInstance>,
  _getCache: (type: string) => Promise<CacheInst>,
  onActor: (type: string, id: unknown, createIfMissing: boolean, instance: unknown) => Promise<unknown>,
  type: string,
  id: unknown,
  lastEventId: unknown
): Promise<unknown> {
  function onError(err: Error) {
    const error = `Failed to get instance '${id}' of '${type}' by lastEventId from store with ${err}`
    log.error(error)
    return Promise.reject(new Error(error))
  }

  return getStore(type)
    .then(
      (store) => store.fetchByLastEventId!(id, lastEventId)
        .then(
          onActor.bind(null, type, id, true),
          onError
        ),
      onStoreAdapterFailure.bind(null, type)
    )
}

function getSystemId(
  flakes: Flakes,
  getStore: (type: string) => Promise<ActorStoreInstance>,
  getCache: (type: string) => Promise<CacheInst>,
  create: boolean,
  type: string,
  id: unknown,
  asOf?: unknown
): Promise<string | null | undefined> {
  return Promise.all([
    getCache(type),
    getStore(type)
  ])
    .then(
      ([cache, store]) => {
        return checkCacheForId(cache as CacheInst, type, id, asOf)
          .then(
            (x) => {
              if (x) {
                return x
              } else {
                return checkStoreForId(store as ActorStoreInstance, type, id, asOf)
              }
            }
          )
          .then(
            (x) => {
              if (x) {
                return x
              } else if (create) {
                return createId(flakes, cache as CacheInst, store as ActorStoreInstance, id)
              } else {
                return null
              }
            }
          )
      },
      onEitherAdapterFailure.bind(null, type)
    )
}

function onActorInstance(
  getSysId: (type: string, id: unknown) => Promise<string | null | undefined>,
  actors: ActorMap,
  type: string,
  id: unknown,
  createIfMissing: boolean,
  instance: unknown
): Promise<unknown> {
  const metadata = actors[type].metadata

  if (instance) {
    return Promise.resolve(
      populateActorState(getSysId, actors, metadata, id, instance as Record<string, unknown>)
    )
  } else if (createIfMissing) {
    let promise = actors[type].factory(id) as Promise<unknown> | unknown
    if (!(promise as Promise<unknown>).then) {
      promise = Promise.resolve(promise)
    }
    return (promise as Promise<unknown>)
      .then((state) => {
        return populateActorState(getSysId, actors, metadata, id, instance as Record<string, unknown>, state as Record<string, unknown>)
      })
  } else {
    return Promise.resolve(undefined)
  }
}

function onCacheAdapterFailure(type: string, err: Error): undefined {
  const error = `Failed to initialize actore cache adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
}

function onEitherAdapterFailure(type: string, err: Error): undefined {
  const error = `Failed to initialize either actore store or actor cache adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
}

function onStoreAdapterFailure(type: string, err: Error): undefined {
  const error = `Failed to initialize actore store adapter for '${type}' with ${err.stack}`
  log.error(error)
  return undefined
}

function populateActorState(
  getSysId: (type: string, id: unknown) => Promise<string | null | undefined>,
  actors: ActorMap,
  metadata: ActorInstance,
  id: unknown,
  instance: Record<string, unknown> = {},
  state: Record<string, unknown> = {}
): unknown {
  const copy: ActorInstance = {
    ...metadata,
    actor: { ...metadata.actor },
    state: Object.assign({}, state, instance),
    commands: metadata.commands,
    events: metadata.events
  }
  const field = copy.actor.identifiedBy
  if (!copy.state.id || !copy.state[field]) {
    copy.state.id = copy.state[field] = id
  }
  if (!copy.state._id) {
    return getSysId(copy.actor.type, copy.state.id)
      .then(
        (systemId) => {
          copy.state._id = systemId
          log.debug(`Assigning system _id '${copy.state._id}' to model type '${metadata.actor.type}' id '${copy.state.id}'`)
          return copy
        }
      )
  } else {
    return copy
  }
}

function storeSnapshot(
  flakes: Flakes,
  actors: ActorMap,
  getStore: (type: string) => Promise<ActorStoreInstance>,
  getCache: (type: string) => Promise<CacheInst>,
  nodeId: string,
  instance: ActorInstance
): Promise<unknown> {
  const actor = instance.actor
  const state = instance.state
  const type = actor.type
  const idField = actors[type].metadata.actor.identifiedBy
  const vector = clock.parse((state._vector as string) || '')
  clock.increment(vector, nodeId)
  state._snapshotId = flakes()
  state._ancestor = state._vector
  state._vector = clock.stringify(vector)
  state._version = clock.toVersion(state._vector as string)

  function onCacheError(err: Error): never {
    const error = `Failed to cache actor '${state[idField]}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }

  function onStored(cache: CacheInst) {
    return cache.store(state[idField], state._vector as string, state)
      .then(undefined, onCacheError)
  }

  function onError(err: Error): never {
    const error = `Failed to store actor '${state[idField]}' of '${type}' with ${err}`
    log.error(error)
    throw new Error(error)
  }
  return Promise.all([
    getCache(type),
    getStore(type)
  ])
    .then(
      ([cache, store]) => {
        return (store as ActorStoreInstance).store(state[idField], state._vector as string, state)
          .then(
            () => onStored(cache as CacheInst),
            onError
          )
      },
      onEitherAdapterFailure.bind(null, type) as () => undefined
    )
}

export default function (flakes: Flakes, actors: ActorMap, actorStoreLib: AdapterLibrary<ActorStoreInstance>, actorCacheLib: AdapterLibrary<CacheInst>, nodeId?: string) {
  const adapters = {
    store: {} as Record<string, Promise<ActorStoreInstance>>,
    cache: {} as Record<string, Promise<CacheInst>>
  }
  const getCache = getAdapter.bind(null, adapters, actorCacheLib, 'cache') as (type: string) => Promise<CacheInst>
  const getStore = getAdapter.bind(null, adapters, actorStoreLib, 'store') as (type: string) => Promise<ActorStoreInstance>
  const getSysId = getSystemId.bind(null, flakes, getStore, getCache) as (create: boolean, type: string, id: unknown, asOf?: unknown) => Promise<string | null | undefined>
  const onActor = onActorInstance.bind(null, getSysId.bind(null, true) as (type: string, id: unknown) => Promise<string | null | undefined>, actors)
  const baseline = getBaseline.bind(null, getStore, getCache, onActor)

  return {
    adapters: adapters,
    fetch: baseline,
    fetchAll: fetchAll.bind(null, baseline),
    fetchByLastEventId: getBaselineByEventId.bind(null, getStore, getCache, onActor),
    fetchByLastEventDate: getBaselineByEventDate.bind(null, getStore, getCache, onActor),
    getSystemId: getSysId,
    onActorInstance: onActor,
    store: storeSnapshot.bind(null, flakes, actors, getStore, getCache, nodeId || '')
  }
}
