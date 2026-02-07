import { EventEmitter } from 'node:events'
import fd from 'fauxdash'
const { sortBy, reduce: reduceObject, map: mapObject, clone } = fd
import type { Event } from './types.js'

interface Dispatcher {
  apply: (type: string, event: Event, baseline: unknown) => Promise<void>
}

interface ActorAdapterEmitter {
  fetchByLastEventId: () => Promise<unknown>
  fetchByLastEventDate: () => Promise<unknown>
}

interface EventAdapterEmitter {
  fetchStream: (type: string, sinceValue: unknown) => EventEmitter
}

interface StreamOptions {
  sinceEventId?: unknown
  sinceDate?: unknown
  eventTypes?: string[]
  actorTypes: string[]
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

function getActorStream(
  _manager: unknown,
  dispatcher: Dispatcher,
  actorAdapter: ActorAdapterEmitter,
  eventAdapter: EventAdapterEmitter,
  actorType: string,
  _actorId: unknown,
  options: StreamOptions
): Promise<EventEmitter> {
  let baselinePromise: Promise<unknown>
  let eventFilter: (event: Event) => boolean = () => true
  if (options.sinceEventId) {
    baselinePromise = actorAdapter.fetchByLastEventId()
  } else if (options.sinceDate) {
    baselinePromise = actorAdapter.fetchByLastEventDate()
  } else {
    return Promise.reject(new Error('sinceDate or sinceEventId is required to determine the actor baseline for the stream'))
  }
  if (options.eventTypes) {
    eventFilter = (event: Event) => {
      return options.eventTypes!.indexOf(event.type!) >= 0
    }
  }
  return baselinePromise
    .then(
      (baseline) => {
        const actors = new EventEmitter()
        actors.once('newListener', (e) => {
          if (e === 'actor') {
            actors.emit('actor', clone(baseline))
          }
        })
        const events = eventAdapter.fetchStream(actorType, options.sinceDate || options.sinceEventId)
        events.on('event', (event: Event) => {
          dispatcher
            .apply(event.type!, event, baseline)
            .then(() => {
              if (eventFilter(event)) {
                actors.emit('actor', clone(baseline))
              }
            })
        })
        events.on('streamComplete', () => {
          actors.emit('streamComplete')
          process.nextTick(() => actors.removeAllListeners())
        })
        return actors
      }
    )
}

function getEventStream(eventAdapter: EventAdapterEmitter, options: StreamOptions): EventEmitter {
  const typeQueues: Record<string, (Event | undefined)[]> = {}
  const emptied: Record<string, boolean> = {}
  const merged = new EventEmitter()

  const finalize = () => {
    merged.emit('streamComplete')
    merged.removeAllListeners()
  }

  const validEvent = (event: Event) => {
    return !options.eventTypes || options.eventTypes.indexOf(event.type!) >= 0
  }

  options.actorTypes.forEach(type => {
    typeQueues[type] = []
  })

  const update = () => {
    const count = Object.keys(typeQueues).length
    const depth = Object.keys(emptied).length === options.actorTypes.length ? 1 : 2
    if (checkQueues(typeQueues as Record<string, unknown[]>, count, depth)) {
      const list = chooseEvents(typeQueues as Record<string, Event[]>)
      list.forEach(e => merged.emit('event', e))
    } else {
      process.nextTick(() => {
        update()
      })
    }
    removeEmpty(emptied, typeQueues, finalize)
  }

  options.actorTypes.forEach(type => {
    const events = eventAdapter.fetchStream(type, options.sinceDate || options.sinceEventId)
    events.on('event', (event: Event) => {
      if (validEvent(event)) {
        const backlog = typeQueues[type]
        backlog.push(event)
        update()
      }
    })
    events.on('streamComplete', () => {
      const backlog = typeQueues[type]
      backlog.push(undefined)
      emptied[type] = true
      update()
    })
  })

  return merged
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

function removeEmpty(emptied: Record<string, boolean>, queues: Record<string, (Event | undefined)[]>, cb?: () => void): void {
  mapObject(emptied, (empty: boolean, type: string) => {
    if (empty) {
      if ((queues[type] && queues[type].length === 0) || (queues[type] && queues[type][0] === undefined)) {
        delete queues[type]
      }
    }
  })
  if (Object.keys(queues).length === 0 && cb) {
    cb()
  }
}

export default function (manager: unknown, dispatcher: Dispatcher, actorAdapter: ActorAdapterEmitter, eventAdapter: EventAdapterEmitter) {
  return {
    checkQueues: checkQueues,
    checkSetIntersection: checkSetIntersection,
    chooseEvents: chooseEvents,
    depthCheck: depthCheck,
    findTypeById: findTypeById,
    getActorStream: getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter),
    getEventStream: getEventStream.bind(null, eventAdapter),
    getIdSeriesFromIndex: getIdSeriesFromIndex,
    mergeAndSort: mergeAndSort,
    removeEmpty: removeEmpty
  }
}
