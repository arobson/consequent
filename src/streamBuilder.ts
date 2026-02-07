import fd from 'fauxdash'
const { unique, sortBy, reduce: reduceObject, map: mapObject, flatten, clone } = fd
import type { Event, StreamOptions } from './types.js'

interface Manager {
  models: Record<string, { actor: { _actorTypes?: string[]; _eventTypes?: string[] } }>
  getSourceIds: (instance: unknown, source: string, id: unknown) => unknown
}

interface Dispatcher {
  apply: (type: string, event: Event, instance: unknown) => Promise<void> | void
}

interface ActorAdapterStream {
  fetchByLastEventId: (id: unknown, lastEventId: unknown) => Promise<unknown>
  fetchByLastEventDate: (id: unknown, date: unknown) => Promise<unknown>
}

interface EventAdapterStream {
  fetchStream: (type: string, id: unknown, options: Record<string, unknown>) => Iterable<Event>
}

function checkQueues(queues: Record<string, unknown[]>, count: number, depth: number): boolean {
  return count === Object.keys(queues).length && depthCheck(queues, depth)
}

function checkSetIntersection(a: string[], b: string[]): boolean {
  if (b.length === 0 || a.length === 0) {
    return false
  }
  const last = a.sort()[a.length - 1]
  const first = b.sort()[0]
  return first < last
}

function chooseEvents(queues: Record<string, Event[]>): Event[] {
  const first = getIdSeriesFromIndex(queues, 0)
  const second = getIdSeriesFromIndex(queues, 1)
  if (checkSetIntersection(first, second)) {
    const lowest = first.sort()[0]
    const type = findTypeById(queues, lowest)!
    return [queues[type].shift()!]
  } else {
    return mergeAndSort(queues)
  }
}

function depthCheck(queues: Record<string, unknown[]>, depth: number): boolean {
  return reduceObject(queues, (acc: boolean, q: unknown[]) => acc && q.length >= depth, true)
}

function findTypeById(queues: Record<string, Event[]>, id: string): string | undefined {
  return reduceObject(queues, (type: string | undefined, q: Event[], k: string) => {
    if (q.some(e => e.id === id)) {
      type = k
    }
    return type
  }, undefined as string | undefined)
}

async function* getActorStream(
  manager: Manager,
  dispatcher: Dispatcher,
  actorAdapter: ActorAdapterStream,
  eventAdapter: EventAdapterStream,
  actorType: string,
  actorId: unknown,
  options: StreamOptions
): AsyncGenerator<Record<string, unknown>> {
  let baselinePromise: Promise<unknown>
  let eventFilter: (event: Event) => boolean = () => true
  const typeList = manager.models[actorType].actor._actorTypes || [actorType]
  if (options.sinceId) {
    baselinePromise = actorAdapter.fetchByLastEventId(actorId, options.sinceId)
  } else if (options.since) {
    baselinePromise = actorAdapter.fetchByLastEventDate(actorId, options.since)
  } else {
    throw new Error('sinceDate or sinceEventId is required to determine the actor baseline for the stream')
  }
  if (options.eventTypes) {
    eventFilter = (event: Event) => {
      return options.eventTypes!.indexOf(event.type!) >= 0
    }
  }
  const baseline = await baselinePromise as { actor: Record<string, unknown>; state: Record<string, unknown> }
  yield clone(baseline).state
  const streamOptions: Record<string, unknown> = {
    since: options.since,
    sinceId: options.sinceId,
    until: options.until,
    untilId: options.untilId,
    filter: options.filter
  }
  if (typeList.length === 1) {
    streamOptions.actorType = actorType
    streamOptions.actorId = actorId
  } else {
    streamOptions.actors = typeList.reduce((acc: Record<string, unknown>, t) => {
      if (t === actorType) {
        acc[t] = actorId
      } else {
        acc[t] = manager.getSourceIds(baseline, t, actorId)
      }
      return acc
    }, {})
  }
  const events = getEventStream(manager, eventAdapter, actorId, streamOptions as unknown as StreamOptions)
  for (const event of events) {
    dispatcher.apply(event.type!, event, baseline)
    if (eventFilter(event)) {
      yield clone(baseline).state
    }
  }
}

function getEventStream(
  manager: Manager,
  eventAdapter: EventAdapterStream,
  actorId: unknown,
  options: StreamOptions
): Iterable<Event> {
  const validEvent = (event: Event) => {
    return !options.eventTypes || options.eventTypes.indexOf(event.type!) >= 0
  }
  const typeQueues: Record<string, (Event | undefined)[]> = {}
  const emptied: Record<string, boolean> = {}
  let queued: Event[] = []
  let done = false
  let actorTypes: string[] = []
  let fullEventTypes: string[] = []
  let actorList: string[]
  if (options.actors) {
    actorList = Object.keys(options.actors)
  } else {
    actorList = options.actorTypes || [options.actorType!]
  }
  actorList.forEach(t => {
    const metadata = manager.models[t]
    actorTypes = actorTypes.concat(t, metadata.actor._actorTypes || [])
    fullEventTypes = fullEventTypes.concat(metadata.actor._eventTypes || [])
  })
  actorTypes = unique(actorTypes.filter(Boolean))
  fullEventTypes = unique(fullEventTypes)
  actorTypes.forEach(type => {
    typeQueues[type] = []
  })

  const update = () => {
    const count = Object.keys(typeQueues).length
    const depth = Object.keys(emptied).length === actorTypes.length ? 1 : 2
    if (checkQueues(typeQueues as Record<string, unknown[]>, count, depth)) {
      const list = chooseEvents(typeQueues as Record<string, Event[]>)
      queued = queued.concat(list)
    } else {
      process.nextTick(() => {
        update()
      })
    }
    if (removeEmpty(emptied, typeQueues)) {
      done = true
    }
  }

  const getEvents = (type: string, id: unknown) => {
    const events = eventAdapter.fetchStream(type, id, {
      since: options.since,
      sinceId: options.sinceId,
      until: options.until,
      untilId: options.untilId,
      filter: options.filter
    })
    for (const event of events) {
      if (validEvent(event)) {
        const backlog = typeQueues[type]
        backlog.push(event)
        update()
      }
    }
  }

  actorTypes.forEach(type => {
    if (options.actors && Array.isArray(options.actors[type])) {
      (options.actors[type] as unknown[]).forEach((id: unknown) => {
        getEvents(type, id)
      })
    } else {
      const id = options.actors ? options.actors[type] : actorId
      getEvents(type, id)
    }
    const backlog = typeQueues[type]
    backlog.push(undefined)
    emptied[type] = true
    update()
  })

  const iterator = {
    next: function (): IteratorResult<Event> {
      if (done && queued.length === 0) {
        return { done: true, value: undefined as unknown as Event }
      } else if (queued.length > 0) {
        const next = queued.shift()!
        return { value: next, done: false }
      } else {
        return { done: false, value: undefined as unknown as Event }
      }
    }
  }
  const iterable: Iterable<Event> = {
    [Symbol.iterator]: () => {
      update()
      return iterator
    }
  }
  return iterable
}

function getIdSeriesFromIndex(queues: Record<string, Event[]>, index: number): string[] {
  return reduceObject(queues, (acc: string[], q: Event[]) => {
    if (q[index]) {
      acc.push(q[index].id as string)
    }
    return acc
  }, [])
}

function mergeAndSort(queues: Record<string, Event[]>): Event[] {
  const events = reduceObject(queues, (acc: Event[], q: Event[], k: string) =>
    acc.concat(queues[k].splice(0, 2).filter(Boolean))
  , [] as Event[])
  sortBy(events, 'id')
  return events
}

function removeEmpty(emptied: Record<string, boolean>, queues: Record<string, (Event | undefined)[]>): boolean {
  mapObject(emptied, (empty: boolean, type: string) => {
    if (empty) {
      if ((queues[type] && queues[type].length === 0) || (queues[type] && queues[type][0] === undefined)) {
        delete queues[type]
      }
    }
  })
  return Object.keys(queues).length === 0
}

export default function (manager?: Manager, dispatcher?: Dispatcher, actorAdapter?: ActorAdapterStream, eventAdapter?: EventAdapterStream) {
  return {
    checkQueues: checkQueues,
    checkSetIntersection: checkSetIntersection,
    chooseEvents: chooseEvents,
    depthCheck: depthCheck,
    findTypeById: findTypeById,
    getActorStream: manager && dispatcher && actorAdapter && eventAdapter
      ? getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter)
      : undefined,
    getEventStream: manager && eventAdapter
      ? getEventStream.bind(null, manager, eventAdapter)
      : undefined,
    getIdSeriesFromIndex: getIdSeriesFromIndex,
    mergeAndSort: mergeAndSort,
    removeEmpty: removeEmpty
  }
}
