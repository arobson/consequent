import fd from 'fauxdash'
const { sortBy } = fd
import type { AdapterLibrary, EventStoreInstance, Event, StreamOptions } from '../types.js'

interface EventStoreState {
  events: Record<string, Record<string, Event[]>>
  packs: Record<string, Record<string, Event[]>>
}

function eventFilter(options: Record<string, unknown> = {}): (event: Event) => boolean {
  return (event: Event) => {
    return isAfterSince(event, options) &&
        isBeforeUntil(event, options) &&
        passesFilter(event, options)
  }
}

function getEventsFor(state: EventStoreState, type: string, actorId: unknown, lastEventId?: unknown): Promise<Event[] | undefined> {
  const actorEvents = state.events[type]
  if (actorEvents && actorEvents[actorId as string]) {
    const events = actorEvents[actorId as string].filter(eventFilter(lastEventId as Record<string, unknown>))
    return Promise.resolve(events)
  }
  return Promise.resolve(undefined)
}

function* getEventStreamFor(state: EventStoreState, type: string, actorId: unknown, options: StreamOptions): Generator<Event> {
  const typeEvents = state.events[type]
  if (typeEvents) {
    const actorEvents = typeEvents[actorId as string]
    if (actorEvents) {
      let events = actorEvents.filter(eventFilter(options as Record<string, unknown>))
      events = sortBy(events, 'id')
      yield* events
    }
  }
}

function getEventPackFor(state: EventStoreState, type: string, actorId: unknown, vectorClock: string): Promise<Event[] | undefined> {
  const packs = state.packs[type]
  if (packs) {
    const key = [actorId, vectorClock].join('-')
    return Promise.resolve(packs[key])
  }
  return Promise.resolve(undefined)
}

function isAfterSince(event: Event, options: Record<string, unknown>): boolean {
  let pass = true
  if (options.sinceId) {
    pass = (event.id as string) > (options.sinceId as string)
  } else if (options.since) {
    pass = (event._createdOn as string) > (options.since as string)
  }
  return pass
}

function isBeforeUntil(event: Event, options: Record<string, unknown>): boolean {
  let pass = true
  if (options.untilId) {
    pass = (event.id as string) <= (options.untilId as string)
  } else if (options.until) {
    pass = (event._createdOn as string) >= (options.until as string)
  }
  return pass
}

function passesFilter(event: Event, options: Record<string, unknown>): boolean {
  let pass = true
  if (options.filter) {
    pass = (options.filter as (e: Event) => boolean)(event)
  }
  return pass
}

function storeEvents(state: EventStoreState, type: string, actorId: unknown, events: Event[]): Promise<void> {
  const actorEvents = state.events[type] = state.events[type] || {}
  actorEvents[actorId as string] = events.concat(actorEvents[actorId as string] || [])
  return Promise.resolve()
}

function storeEventPackFor(state: EventStoreState, type: string, actorId: unknown, vectorClock: string, events: Event[]): Promise<void> {
  const packs = state.packs[type] || {}
  const key = [actorId, vectorClock].join('-')
  packs[key] = events
  state.packs[type] = packs
  return Promise.resolve()
}

export default function (): AdapterLibrary<EventStoreInstance> {
  const state: EventStoreState = {
    events: {},
    packs: {}
  }
  return {
    create: function (type: string) {
      return Promise.resolve({
        getEventsFor: getEventsFor.bind(null, state, type),
        getEventPackFor: getEventPackFor.bind(null, state, type),
        getEventStreamFor: getEventStreamFor.bind(null, state, type),
        storeEvents: storeEvents.bind(null, state, type),
        storeEventPack: storeEventPackFor.bind(null, state, type)
      } as EventStoreInstance)
    }
  }
}
