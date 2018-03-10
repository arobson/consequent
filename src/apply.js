const { filter, isString, isFunction } = require('fauxdash')

function apply (actors, queue, topic, message, instance) {
  let type = instance.actor.type
  let metadata = actors[ type ].metadata
  let parts = topic.split('.')
  let alias = parts[ 0 ] === type ? parts.slice(1).join('.') : topic
  let isCommand = metadata.commands[ alias ]
  let getHandlers = isCommand ? getCommandHandlers : getEventHandlers
  let process = isCommand ? processCommand : processEvent

  let handlers = getHandlers(metadata, instance, alias, message)
  let results = handlers.map((handle) => {
    return queue.add(instance.state.id, () => {
      return process(handle, instance, message)
    })
  })

  return Promise
    .all(results)
    .then(filter)
}

function filterHandlers (handlers, instance, message) {
  let list = []
  if (!handlers) {
    return list
  }
  return handlers.reduce((acc, def) => {
    let predicate = def.when
    let handle = def.then
    let exclusive = def.exclusive
    let should = false
    if (!exclusive || list.length === 0) {
      should = predicate === true ||
        (isString(predicate) && instance.state.state === predicate) ||
        (isFunction(predicate) && predicate(instance.state, message))
      if (should) {
        acc.push(handle)
      }
    }
    return acc
  }, list)
}

function getCommandHandlers (metadata, instance, topic, message) {
  return filterHandlers(metadata.commands[ topic ], instance, message)
}

function getEventHandlers (metadata, instance, topic, message) {
  return filterHandlers(metadata.events[ topic ], instance, message)
}

function processCommand (handle, instance, command) {
  let result = handle(instance, command)
  result = result && result.then ? result : Promise.resolve(result)
  let actor = { type: instance.actor.type }
  Object.assign(actor, instance.state)

  function onSuccess (events) {
    events = Array.isArray(events) ? events : [ events ]
    instance.state.lastCommandId = command.id
    instance.state.lastCommandHandledOn = new Date().toISOString()
    return {
      message: command,
      actor: actor,
      events: events || []
    }
  }

  function onError (err) {
    return {
      rejected: true,
      message: command,
      actor: actor,
      reason: err
    }
  }

  return result
    .then(onSuccess, onError)
}

function processEvent (handle, instance, event) {
  return Promise.resolve(handle(instance.state, event))
    .then(() => {
      const [ type ] = event.type ? event.type.split('.') : [ instance.actor.type ]
      if (instance.actor.type === type) {
        instance.state.lastEventId = event.id
        instance.state.lastEventAppliedOn = new Date().toISOString()
      } else {
        if (!instance.state.related) {
          instance.state.related = {}
        }
        if (!instance.state.related[ type ]) {
          instance.state.related[ type ] = {
            lastEventId: event.id,
            lastEventAppliedOn: new Date().toISOString()
          }
        } else {
          instance.state.related[ type ].lastEventId = event.id
          instance.state.related[ type ].lastEventAppliedOn = new Date().toISOString()
        }
      }
    })
}

module.exports = apply
