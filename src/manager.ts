import fd from 'fauxdash'
const { flatten, map: mapObject, sequence, sortBy, clone } = fd
import apply from './apply.js'
import pluralize from 'pluralize'
import logFn from './log.js'
import type { ActorMap, ActorInstance, Queue, Event } from './types.js'

const log = logFn('consequent.manager')

function getSourceIds(instance: ActorInstance, source: string, id: unknown): unknown {
  const state = instance.state
  const plural = pluralize(source)
  if (state[source]) {
    const sub = state[source]
    if (Array.isArray(sub)) {
      return sub.map((i: Record<string, unknown>) => i.id)
    } else if ((sub as Record<string, unknown>).id) {
      return [(sub as Record<string, unknown>).id]
    }
  } else if (state[plural]) {
    const sub = state[plural]
    if (Array.isArray(sub)) {
      return sub.map((i: Record<string, unknown>) => i.id)
    } else if ((sub as Record<string, unknown>).id) {
      return [(sub as Record<string, unknown>).id]
    }
  } else if (state[`${source}Id`]) {
    return state[`${source}Id`]
  } else if (state[`${plural}Id`]) {
    return state[`${plural}Id`]
  } else {
    return [id]
  }
}

interface ActorAdapter {
  fetch: (type: string, id: unknown) => Promise<unknown>
  findAncestor: (id: unknown, instances: unknown[], excluded: unknown[]) => Promise<unknown>
  store: (instance: ActorInstance) => Promise<unknown>
  getSystemId: (create: boolean, type: string, id: unknown) => Promise<unknown>
}

interface EventAdapter {
  fetch: (type: string, id: unknown, lastEventId: unknown, noError?: boolean) => Promise<Event[]>
  store: (type: string, id: unknown, events: Event[]) => Promise<void>
  storePack: (type: string, id: unknown, vector: unknown, lastEventId: unknown, events: Event[]) => Promise<void>
}

function onActor(
  applyFn: (instance: ActorInstance, event: Event) => () => Promise<unknown>,
  actorAdapter: ActorAdapter,
  eventAdapter: EventAdapter,
  readOnly: boolean,
  instance: unknown
): Promise<unknown> {
  if (!instance) {
    return Promise.resolve(null)
  } else if (Array.isArray(instance)) {
    const first = instance[0] as ActorInstance
    log.debug(`found ${instance.length} ancestors for ${first.actor.type}:${first.state.id}`)
    return actorAdapter.findAncestor(first.state._id, instance, [])
      .then(onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly))
  } else {
    const inst = instance as ActorInstance
    const type = inst.actor.type
    const id = inst.state._id
    const lastEventId = inst.state._lastEventId
    const copy = clone(inst)
    const copyFactory = applyFn.bind(null, copy)
    let mainEvents: Event[]
    log.debug(`fetching events for ${type}:${id}`)
    return eventAdapter.fetch(type, id, lastEventId)
      .then(
        (events) => {
          mainEvents = events
          const calls = events.map(copyFactory)
          return sequence(calls)
            .then(
              () => {
                const factory = applyFn.bind(null, inst)
                let promises: Promise<Event[]>[] = []
                if (inst.actor.aggregateFrom) {
                  promises = flatten(
                    inst.actor.aggregateFrom.map((source) => {
                      let last: unknown = ''
                      if (copy.state._related) {
                        last = ((copy.state._related as Record<string, Record<string, unknown>>)[source])._lastEventId
                      }
                      const sourceIds = getSourceIds(copy, source, id)
                      return mapObject(
                        Array.isArray(sourceIds) ? sourceIds.reduce((acc: Record<string, unknown>, sid: unknown, i: number) => { acc[String(i)] = sid; return acc }, {}) : { '0': sourceIds },
                        (sourceId: unknown) =>
                          actorAdapter.getSystemId(false, source, sourceId)
                            .then((_id: unknown) => {
                              return eventAdapter.fetch(source, _id, last)
                            })
                      )
                    })
                  ) as Promise<Event[]>[]
                }
                return Promise.all(promises)
                  .then((lists) => {
                    const list = sortBy(flatten((lists as Event[][]).concat([mainEvents])), 'id')
                    log.debug(`loaded ${list.length} events for ${type}:${id}`)
                    return onEvents(actorAdapter, eventAdapter, inst, factory, readOnly, list)
                  })
              }
            )
        }
      )
  }
}

function onEvents(
  actorAdapter: ActorAdapter,
  eventAdapter: EventAdapter,
  instance: ActorInstance,
  factory: (event: Event) => () => Promise<unknown>,
  readOnly: boolean,
  events: Event[]
): Promise<unknown> {
  const calls = events.map(factory)
  return sequence(calls)
    .then(
      () => {
        if (!readOnly || instance.actor.snapshotOnRead) {
          return snapshot(actorAdapter, eventAdapter, events, readOnly, instance)
        } else {
          instance.actor._eventsRead = (instance.actor._eventsRead || 0) + events.length
          return instance
        }
      })
}

function getLatest(
  actors: ActorMap,
  actorAdapter: ActorAdapter,
  eventAdapter: EventAdapter,
  queue: Queue,
  type: string,
  id: unknown,
  readOnly?: boolean
): Promise<unknown> {
  function applyFn(instance: ActorInstance, event: Event) {
    return function () {
      return apply(actors, queue, event.type!, event, instance)
    }
  }
  log.debug(`fetching ${type}:${id}`)
  return actorAdapter.fetch(type, id)
    .then(onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly || false))
}

function getLatestAll(
  actors: ActorMap,
  actorAdapter: ActorAdapter,
  eventAdapter: EventAdapter,
  queue: Queue,
  options: Record<string, unknown>,
  readOnly?: boolean
): Promise<Record<string, unknown>> {
  function applyFn(instance: ActorInstance, event: Event) {
    return function () {
      return apply(actors, queue, event.type!, event, instance)
    }
  }
  const update = onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly || false)
  return (actorAdapter as unknown as { fetchAll: (options: Record<string, unknown>) => Promise<Record<string, unknown>> }).fetchAll(options)
    .then((results) =>
      Promise.all(
        mapObject(results, (instances: unknown) => {
          if (Array.isArray(instances)) {
            return Promise.all(instances.map(update))
          } else {
            return update(instances)
          }
        })
      ).then(() => results)
    )
}

function snapshot(
  actorAdapter: ActorAdapter,
  eventAdapter: EventAdapter,
  events: Event[],
  readOnly: boolean,
  instance: ActorInstance
): Promise<unknown> {
  const actor = instance.actor
  const state = instance.state
  const limit = actor.eventThreshold || 50
  const skip = actor.snapshotOnRead ? false : readOnly
  const underLimit = (events.length + (actor._eventsRead || 0)) < limit

  function onSnapshot() {
    if (actor.storeEventPack) {
      return eventAdapter.storePack(actor.type, state._id, state._vector, state._lastEventId, events)
        .then(onEventpack, onEventpackError)
    } else {
      return instance
    }
  }

  function onSnapshotError() {
    return instance
  }

  function onEventpack() {
    return instance
  }

  function onEventpackError() {
    return instance
  }
  if (skip || underLimit) {
    return Promise.resolve(instance)
  } else {
    return actorAdapter.store(instance)
      .then(onSnapshot, onSnapshotError)
  }
}

export default function (actors: ActorMap, actorAdapter: ActorAdapter, eventAdapter: EventAdapter, queue: Queue) {
  return {
    models: actors,
    actors: actorAdapter,
    events: eventAdapter,
    getOrCreate: getLatest.bind(null, actors, actorAdapter, eventAdapter, queue),
    getOrCreateAll: getLatestAll.bind(null, actors, actorAdapter, eventAdapter, queue),
    getSourceIds: getSourceIds,
    snapshot: snapshot.bind(null, actorAdapter, eventAdapter),
    storeActor: actorAdapter.store,
    storeEvents: eventAdapter.store
  }
}
