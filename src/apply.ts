import fd from 'fauxdash'
import logFn from './log.js'
import type { ActorMap, ActorInstance, Message, CommandResult, Queue, HandlerDefinition } from './types.js'

const { clone } = fd
const log = logFn('consequent.apply')

function apply(actors: ActorMap, queue: Queue | null, topic: string, message: Message, instance: ActorInstance): Promise<(CommandResult | undefined)[]> {
  const type = instance.actor.type
  const metadata = actors[type].metadata
  const isCommand = metadata.commands[topic]
  const getHandlers = isCommand ? getCommandHandlers : getEventHandlers
  const processMessage = isCommand ? processCommand : processEvent
  const q = isCommand ? queue! : immediateQueue()
  const handlers = getHandlers(metadata, instance, topic, message)
  const qId = instance.state ? ((instance.state.id as string) || type) : type

  log.debug(`sending ${topic} to ${handlers.length} handlers on queue ${qId}`)
  const results = handlers.map((handle) => {
    return q.add(qId, () => {
      return processMessage(actors, handle, instance, message)
    })
  })

  return Promise
    .all(results)
    .then(r => (r as (CommandResult | undefined)[]).filter(Boolean))
}

function filterHandlers(
  handlers: HandlerDefinition[] | undefined,
  instance: ActorInstance,
  message: Message
): Array<(...args: unknown[]) => unknown> {
  const list: Array<(...args: unknown[]) => unknown> = []
  if (!handlers) {
    return list
  }
  return handlers.reduce((acc, def) => {
    const predicate = def.when
    const handle = def.then
    const exclusive = def.exclusive
    let should = false
    if (!exclusive || list.length === 0) {
      should = predicate === true ||
        (typeof predicate === 'string' && instance.state.state === predicate) ||
        (typeof predicate === 'function' && predicate(instance.state, message))
      if (should) {
        acc.push(handle)
      }
    }
    return acc
  }, list)
}

function getCommandHandlers(
  metadata: ActorInstance,
  instance: ActorInstance,
  topic: string,
  message: Message
): Array<(...args: unknown[]) => unknown> {
  return filterHandlers(metadata.commands[topic], instance, message)
}

function getEventHandlers(
  metadata: ActorInstance,
  instance: ActorInstance,
  topic: string,
  message: Message
): Array<(...args: unknown[]) => unknown> {
  return filterHandlers(metadata.events[topic], instance, message)
}

function immediateQueue(): Queue {
  return {
    add: function add(_id: unknown, cb: () => unknown) {
      return Promise.resolve(cb())
    }
  }
}

function processCommand(
  actors: ActorMap,
  handle: (...args: unknown[]) => unknown,
  instance: ActorInstance,
  command: Message
): Promise<CommandResult> {
  let result = handle(instance, command) as Promise<unknown> | unknown
  result = result && (result as Promise<unknown>).then ? result : Promise.resolve(result)
  log.debug(`processing command ${command.type} on ${instance.actor.type}:${instance.state.id}`)

  function onSuccess(events: unknown) {
    const originalState = clone(instance.state)
    let eventList = (Array.isArray(events) ? events : [events]).filter(Boolean) as Message[]
    instance.state._lastCommandType = command.type
    instance.state._lastCommandId = command.id
    instance.state._lastCommandHandledOn = new Date().toISOString()
    eventList.forEach((e) =>
      apply(actors, null, e.type!, e, instance)
    )
    log.debug(`${command.type} on ${instance.actor.type}:${instance.state.id} produced ${eventList.length} events`)
    return {
      message: command,
      actor: instance.actor,
      state: instance.state,
      original: originalState,
      events: eventList || []
    } as CommandResult
  }

  function onError(err: Error): CommandResult {
    log.debug(`${command.type} on ${instance.actor.type}:${instance.state.id} failed with ${err.message}`)
    return {
      rejected: true,
      message: command,
      actor: instance.actor,
      state: instance.state,
      reason: err
    }
  }

  return (result as Promise<unknown>)
    .then(onSuccess, onError)
}

function processEvent(
  _actors: ActorMap,
  handle: (...args: unknown[]) => unknown,
  instance: ActorInstance,
  event: Message
): Promise<void> {
  return Promise.resolve(handle(instance.state, event))
    .then(() => {
      const [type] = event.type ? event.type.split('.') : [instance.actor.type]
      if (instance.actor.type === type) {
        instance.state._lastEventId = event.id
        instance.state._lastEventAppliedOn = new Date().toISOString()
      } else {
        if (!instance.state._related) {
          instance.state._related = {}
        }
        const related = instance.state._related as Record<string, Record<string, unknown>>
        if (!related[type]) {
          related[type] = {
            _lastEventId: event.id,
            _lastEventAppliedOn: new Date().toISOString()
          }
        } else {
          related[type]._lastEventId = event.id
          related[type]._lastEventAppliedOn = new Date().toISOString()
        }
      }
    })
}

export default apply
