import type { AdapterLibrary, ActorStoreInstance } from '../types.js'

interface StoreState {
  [type: string]: {
    actorIds: Record<string, string[]>
    systemIds: Record<string, string[]>
    [id: string]: unknown
  }
}

function get(state: StoreState, type: string, id: unknown): Promise<unknown> {
  let instance
  if (state[type]) {
    const _id = getSystemId(state, type, id)
    const list = (state[type] as Record<string, unknown>)[_id as string] as unknown[] | undefined
    if (list && list.length > 0) {
      instance = list.slice(-1)[0]
    }
  }
  return Promise.resolve(instance)
}

function findByLastEvent(state: StoreState, type: string, field: string, id: unknown, value: unknown): Promise<unknown> {
  if (state[type]) {
    const _id = getSystemId(state, type, id)
    const actors = (state[type] as Record<string, unknown>)[_id as string] as Record<string, unknown>[] | undefined
    if (!actors) return Promise.resolve(undefined)
    const list = new Array(actors.length)
    const lookup = actors.reduce((acc: Record<string, unknown>, actor, i) => {
      const f = actor[field] as string
      list[i] = f
      acc[f] = actor
      return acc
    }, {})
    if (lookup[value as string]) {
      return Promise.resolve(lookup[value as string])
    } else {
      list.sort()
      let last: string | undefined
      do {
        const point = list.pop()
        if (point > (value as string)) {
          last = point
        } else if (last) {
          return Promise.resolve(lookup[last])
        } else {
          return Promise.resolve(lookup[point])
        }
      } while (list.length)
    }
  }
  return Promise.resolve(undefined)
}

function getActorId(state: StoreState, type: string, systemId: string): Promise<string | undefined> {
  if (state[type]) {
    const list = state[type].systemIds[systemId]
    let id: string | undefined
    if (list && list.length) {
      id = list.slice(-1)[0]
    }
    return Promise.resolve(id)
  }
  return Promise.resolve(undefined)
}

function getSystemId(state: StoreState, type: string, actorId: unknown): Promise<string | undefined> | string | undefined {
  if (state[type]) {
    const list = state[type].actorIds[actorId as string]
    let id: string | undefined
    if (list && list.length) {
      id = list.slice(-1)[0]
    }
    return Promise.resolve(id)
  }
  return Promise.resolve(undefined)
}

function mapIds(state: StoreState, type: string, systemId: string, actorId: string): void {
  if (!state[type].actorIds[actorId]) {
    state[type].actorIds[actorId] = [systemId]
  } else {
    state[type].actorIds[actorId].push(systemId)
  }

  if (!state[type].systemIds[systemId]) {
    state[type].systemIds[systemId] = [actorId]
  } else {
    state[type].systemIds[systemId].push(actorId)
  }
}

function set(state: StoreState, type: string, _id: string, _vector: string, instance: Record<string, unknown>): void {
  const sysId = instance._id as string
  if ((state[type] as Record<string, unknown>)[sysId]) {
    ((state[type] as Record<string, unknown>)[sysId] as unknown[]).push(instance)
  } else {
    (state[type] as Record<string, unknown>)[sysId] = [instance]
  }
}

export default function (): AdapterLibrary<ActorStoreInstance> & { state: StoreState } {
  const state: StoreState = {}
  return {
    state: state,
    create: (type: string) => {
      state[type] = {
        actorIds: {},
        systemIds: {}
      }
      return Promise.resolve({
        fetch: get.bind(null, state, type),
        fetchByLastEventDate: findByLastEvent.bind(null, state, type, 'lastEventDate'),
        fetchByLastEventId: findByLastEvent.bind(null, state, type, 'lastEventId'),
        getActorId: getActorId.bind(null, state, type),
        getSystemId: (getSystemId as (state: StoreState, type: string, actorId: unknown) => Promise<string | undefined>).bind(null, state, type),
        mapIds: mapIds.bind(null, state, type),
        store: set.bind(null, state, type)
      }) as Promise<ActorStoreInstance>
    }
  }
}
