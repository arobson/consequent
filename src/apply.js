const { clone, filter, isString, isFunction } = require('fauxdash')
const log = require('./log')('consequent.apply')

function apply (actors, queue, topic, message, instance) {
  let type = instance.actor.type
  let metadata = actors[ type ].metadata
  let isCommand = metadata.commands[ topic ]
  let getHandlers = isCommand ? getCommandHandlers : getEventHandlers
  let processMessage = isCommand ? processCommand : processEvent
  let q = isCommand ? queue : immediateQueue()
  let handlers = getHandlers(metadata, instance, topic, message)
  const qId = instance.state ? (instance.state.id || type) : type

  log.debug(`sending ${topic} to ${handlers.length} handlers on queue ${qId}`)
  let results = handlers.map((handle) => {
    return q.add(qId, () => {
      return processMessage(actors, handle, instance, message)
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

function immediateQueue () {
  return {
    add: function add (id, cb) {
      return cb()
    }
  }
}

function processCommand (actors, handle, instance, command) {
  let result = handle(instance, command)
  result = result && result.then ? result : Promise.resolve(result)
  log.debug(`processing command ${command.type} on ${instance.actor.type}:${instance.state.id}`)
  function onSuccess (events) {
    const original = clone(instance)
    events = filter(Array.isArray(events) ? events : [ events ])
    instance.state._lastCommandType = command.type
    instance.state._lastCommandId = command.id
    instance.state._lastCommandHandledOn = new Date().toISOString()
    events.forEach((e) =>
      apply(actors, null, e.type, e, instance)
    )
    log.debug(`${command.type} on ${instance.actor.type}:${instance.state.id} produced ${events.length} events`)
    return {
      message: command,
      actor: instance.actor,
      state: instance.state,
      original: original.state,
      events: events || []
    }
  }

  function onError (err) {
    log.debug(`${command.type} on ${instance.actor.type}:${instance.state.id} failed with ${err.message}`)
    return {
      rejected: true,
      message: command,
      actor: instance.actor,
      state: instance.state,
      reason: err
    }
  }

  return result
    .then(onSuccess, onError)
}

function processEvent (actors, handle, instance, event) {
  return Promise.resolve(handle(instance.state, event))
    .then(() => {
      const [ type ] = event.type ? event.type.split('.') : [ instance.actor.type ]
      if (instance.actor.type === type) {
        instance.state._lastEventId = event.id
        instance.state._lastEventAppliedOn = new Date().toISOString()
      } else {
        if (!instance.state._related) {
          instance.state._related = {}
        }
        if (!instance.state._related[ type ]) {
          instance.state._related[ type ] = {
            _lastEventId: event.id,
            _lastEventAppliedOn: new Date().toISOString()
          }
        } else {
          instance.state._related[ type ]._lastEventId = event.id
          instance.state._related[ type ]._lastEventAppliedOn = new Date().toISOString()
        }
      }
    })
}

module.exports = apply
