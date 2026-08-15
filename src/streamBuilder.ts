import fd from 'fauxdash'
const { unique, sortBy, clone } = fd
import type { Event, StreamOptions } from './types.js'

interface Manager {
  models: Record<string, { metadata: { actor: { _actorTypes?: string[]; _eventTypes?: string[] } } }>
  getSourceIds: (instance: unknown, source: string, id: unknown) => unknown
}

interface Dispatcher {
  apply: (type: string, event: Event, instance: unknown) => Promise<void> | void
}

interface ActorAdapterStream {
  fetchByLastEventId: (type: string, id: unknown, lastEventId: unknown) => Promise<unknown>
  fetchByLastEventDate: (type: string, id: unknown, date: unknown) => Promise<unknown>
}

interface EventAdapterStream {
  // Resolves to either a sync or async iterable depending on the adapter
  // (the default in-memory adapter yields a sync generator;
  // consequent-postgres's real, pg-cursor-backed adapter yields a genuine
  // async iterable) -- every consumer of this must use `for await...of`,
  // which handles both uniformly.
  fetchStream: (type: string, id: unknown, options: Record<string, unknown>) => Promise<Iterable<Event> | AsyncIterable<Event>>
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
  const typeList = manager.models[actorType].metadata.actor._actorTypes || [actorType]
  if (options.sinceId) {
    baselinePromise = actorAdapter.fetchByLastEventId(actorType, actorId, options.sinceId)
  } else if (options.since) {
    baselinePromise = actorAdapter.fetchByLastEventDate(actorType, actorId, options.since)
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
  const events = await getEventStream(manager, eventAdapter, actorId, streamOptions as unknown as StreamOptions)
  for (const event of events) {
    dispatcher.apply(event.type!, event, baseline)
    if (eventFilter(event)) {
      yield clone(baseline).state
    }
  }
}

// Deliberately simple: fully drain each requested (type, id) pair's event
// stream, concat, sort once by id. This module previously tried to be a
// true incremental merge -- separate per-type queues, a depth-2 lookahead
// (`chooseEvents`/`checkQueues`), rescheduled via `process.nextTick` until
// enough queues were "deep enough" to safely emit the next event in order.
// That design assumed every adapter's `fetchStream` resolved to a
// synchronous, already-fully-produced iterable, which was true for the
// default in-memory adapter (a plain generator) but not for
// consequent-postgres's real, pg-cursor-backed adapter (a genuine async
// iterable, one real microtask gap per row). Under that real interleaving,
// `update()`'s nextTick-reschedule-until-satisfied loop could spin forever
// without the depth check ever being satisfied -- a real, reproducible
// hang (100% CPU, starves even `setTimeout`), not a performance concern.
// `getEventStream` was never documented as a true streaming/backpressure
// API (it returns a fully materialized `Iterable`, not an async generator
// consumers can pull incrementally) -- the old design's complexity bought
// nothing observable over this, while being unsafe under real async
// adapters. `getIdSeriesFromIndex`/`mergeAndSort`/`chooseEvents`/
// `checkQueues`/`checkSetIntersection`/`depthCheck`/`findTypeById`/
// `removeEmpty` (and their own dedicated tests) are removed along with it
// -- confirmed unused anywhere else in this codebase.
async function getEventStream(
  manager: Manager,
  eventAdapter: EventAdapterStream,
  actorId: unknown,
  options: StreamOptions
): Promise<Iterable<Event>> {
  const validEvent = (event: Event) => {
    return !options.eventTypes || options.eventTypes.indexOf(event.type!) >= 0
  }
  let actorTypes: string[] = []
  let actorList: string[]
  if (options.actors) {
    actorList = Object.keys(options.actors)
  } else {
    actorList = options.actorTypes || [options.actorType!]
  }
  actorList.forEach(t => {
    const metadata = manager.models[t].metadata
    actorTypes = actorTypes.concat(t, metadata.actor._actorTypes || [])
  })
  actorTypes = unique(actorTypes.filter(Boolean))

  const fetchOptions = {
    since: options.since,
    sinceId: options.sinceId,
    until: options.until,
    untilId: options.untilId,
    filter: options.filter
  }

  const fetchForId = async (type: string, id: unknown): Promise<Event[]> => {
    const events = await eventAdapter.fetchStream(type, id, fetchOptions)
    const collected: Event[] = []
    for await (const event of events) {
      if (validEvent(event)) collected.push(event)
    }
    return collected
  }

  const perTypeLists = await Promise.all(actorTypes.map((type) => {
    if (options.actors && Array.isArray(options.actors[type])) {
      return Promise.all((options.actors[type] as unknown[]).map((id) => fetchForId(type, id)))
        .then((lists) => lists.flat())
    }
    const id = options.actors ? options.actors[type] : actorId
    return fetchForId(type, id)
  }))

  return sortBy(perTypeLists.flat(), 'id')
}

export default function (manager?: Manager, dispatcher?: Dispatcher, actorAdapter?: ActorAdapterStream, eventAdapter?: EventAdapterStream) {
  return {
    getActorStream: manager && dispatcher && actorAdapter && eventAdapter
      ? getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter)
      : undefined,
    getEventStream: manager && eventAdapter
      ? getEventStream.bind(null, manager, eventAdapter)
      : undefined
  }
}
