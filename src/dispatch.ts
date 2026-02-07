import fd from 'fauxdash'
const { flatten, map: mapObject } = fd
import { queue as hashqueue } from 'haberdasher'
import apply from './apply.js'
import logFn from './log.js'
import type { ActorMap, ActorInstance, Message, Event, CommandResult, Queue, Flakes } from './types.js'

const log = logFn('consequent.dispatch')

function enrichEvent(flakes: Flakes, set: CommandResult, command: Message, event: Event): void {
  event.id = flakes()

  const [actorType, type] = (event.type as string).split('.')
  if (actorType === set.actor.type || !type) {
    event._actorId = set.state._id as string
    event._actorType = set.actor.type
    event._createdByVector = set.state._vector as string
    event._createdByVersion = set.state._version as number
    event._createdBy = set.actor.type
  } else {
    event._actorId = ((event as Record<string, unknown>)[actorType] && ((event as Record<string, unknown>)[actorType] as Record<string, unknown>)._id) as string
    event._actorType = actorType
    event._createdByVector = ((event as Record<string, unknown>)[actorType] as Record<string, unknown>)?._vector as string || set.actor._vector as string
    event._createdByVersion = ((event as Record<string, unknown>)[actorType] as Record<string, unknown>)?._version as number || set.actor._version as number
  }
  event._createdBy = event._actorType
  event._createdById = event._actorId
  event._createdOn = new Date().toISOString()
  event._initiatedBy = (command.type || command.topic) as string
  event._initiatedById = command.id || ''
}

interface Manager {
  getOrCreate: (type: string, id: unknown) => Promise<ActorInstance>
  storeEvents: (type: string, id: unknown, events: Event[]) => Promise<void>
}

interface Search {
  update: (type: string, fields: string[], updated: Record<string, unknown>, original: Record<string, unknown>) => Promise<void>
}

function enrichEvents(flakes: Flakes, manager: Manager, command: Message, result: CommandResult[]): Promise<CommandResult[]> {
  const lists = result.reduce((acc: Record<string, Record<string, Event[]>>, set) => {
    (set.events || []).forEach((event) => {
      enrichEvent(flakes, set, command, event)
      if (!acc[event._actorType!]) {
        acc[event._actorType!] = {}
      }
      if (!acc[event._actorType!][event._actorId!]) {
        acc[event._actorType!][event._actorId!] = []
      }
      acc[event._actorType!][event._actorId!].push(event)
    })
    return acc
  }, {})

  const promises = flatten(mapObject(lists, (actors: Record<string, Event[]>, type: string) =>
    mapObject(actors, (events: Event[], actor: string) =>
      manager.storeEvents(type, actor, events)
    )
  ))

  return Promise
    .all(promises)
    .then(() => {
      return result
    })
}

function handle(
  flakes: Flakes,
  queue: Queue,
  lookup: Record<string, string[]>,
  manager: Manager,
  search: Search,
  actors: ActorMap,
  id: unknown,
  topic: string,
  message: Message
): Promise<CommandResult[]> {
  const types = lookup[topic] || []
  let error: string
  const dispatches = types.map((type) => {
    if (!actors[type]) {
      error = `No registered actors handle messages of type '${topic}'`
      log.error(error)
      return Promise.reject(new Error(error))
    }
    if (!message.type) {
      message.type = topic
    }
    if (!message.id) {
      message.id = flakes()
    }
    log.debug(`dispatching ${topic} to ${type}:${id}`)
    return manager.getOrCreate(type, id)
      .then(
        onInstance.bind(null, flakes, actors, queue, manager, topic, message, id),
        onInstanceError.bind(null, type)
      )
  })
  return Promise
    .all(dispatches)
    .then(r => flatten(r as CommandResult[][]))
    .then((results) => {
      results.map((result) => {
        const fields = result.actor.searchableBy
        if (fields) {
          search.update(result.actor.type, fields, result.state, result.original!)
            .then(
              () => log.info(`updated ${result.actor.type}:${result.state.id} search index successfully`),
              (err: Error) => log.warn(`failed to updated ${result.actor.type}:${result.state.id} search index with: ${err.message}`)
            )
        }
      })
      return results
    })
}

function onApplied(flakes: Flakes, manager: Manager, command: Message, result: (CommandResult | undefined)[]): Promise<CommandResult[]> | (CommandResult | undefined)[] {
  if (result && !(result as unknown as { rejected: boolean }).rejected && !(result.length === 1 && result[0] === undefined) && result.length > 0) {
    return enrichEvents(flakes, manager, command, result as CommandResult[])
  } else {
    return result
  }
}

function onInstance(
  flakes: Flakes,
  actors: ActorMap,
  queue: Queue,
  manager: Manager,
  topic: string,
  message: Message,
  id: unknown,
  instance: ActorInstance
): Promise<unknown> {
  const idField = instance.actor.identifiedBy
  instance.state[idField] = id
  log.debug(`applying ${topic} to ${instance.actor.type}:${id}`)
  return apply(actors, queue, topic, message, instance)
    .then(onApplied.bind(null, flakes, manager, message))
}

function onInstanceError(type: string, err: Error): Promise<never> {
  const error = `Failed to instantiate actor '${type}' with ${err.stack}`
  log.error(error)
  return Promise.reject(new Error(error))
}

export default function (flakes: Flakes, lookup: Record<string, string[]>, manager: Manager, search: Search, actors: ActorMap, queue?: Queue, limit?: number) {
  const q = queue || hashqueue.create(limit || 8)
  return {
    apply: apply.bind(undefined, actors, q),
    handle: handle.bind(undefined, flakes, q, lookup, manager, search, actors)
  }
}
