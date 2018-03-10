const { flatten, map } = require('fauxdash')
const hashqueue = require('hashqueue')
const apply = require('./apply')
const sliver = require('sliver')()
const log = require('./log')('consequent.dispatch')

function enrichEvent (set, event) {
  event.id = sliver.getId()
  const [actorType, type] = event.type.split('.')
  if (actorType === set.actor.type || !type) {
    event.correlationId = set.actor.id
    event.vector = set.actor.vector
    event.actorType = set.actor.type
  } else {
    event.correlationId = event[ actorType ].id
    event.vector = event[ actorType ].vector || set.actor.vector
    event.actorType = actorType
  }
  event.initiatedBy = set.message.type || set.message.topic
  event.initiatedById = set.message.id
  event.createdOn = new Date().toISOString()
}

function enrichEvents (manager, result) {
  let lists = result.reduce((acc, set) => {
    set.events.forEach(event => {
      enrichEvent(set, event)
      if (!acc[event.actorType]) {
        acc[event.actorType] = {}
      }
      if (!acc[event.actorType][event.correlationId]) {
        acc[event.actorType][event.correlationId] = []
      }
      acc[event.actorType][event.correlationId].push(event)
    })
    return acc
  }, {})

  let promises = flatten(map(lists, (actors, type) =>
    map(actors, (events, actor) =>
      manager.storeEvents(type, actor, events)
    )
  ))

  return Promise
    .all(promises)
    .then(() => {
      return result
    })
}

function handle (queue, lookup, manager, actors, id, topic, message) {
  let types = lookup[ topic ] || []
  let error

  let dispatches = types.map((type) => {
    if (!actors[ type ]) {
      error = `No registered actors handle messages of type '${topic}'`
      log.error(error)
      return Promise.reject(new Error(error))
    }

    return manager.getOrCreate(type, id)
      .then(
        onInstance.bind(null, actors, queue, manager, topic, message, id),
        onInstanceError.bind(null, type)
      )
  })
  return Promise
    .all(dispatches)
    .then(flatten)
}

function onApplied (manager, result) {
  if (result && !result.rejected && result !== [ undefined ] && result !== []) {
    return enrichEvents(manager, result)
  } else {
    return result
  }
}

function onInstance (actors, queue, manager, topic, message, id, instance) {
  instance.state.id = instance.state.id || id
  return apply(actors, queue, topic, message, instance)
    .then(onApplied.bind(null, manager))
}

function onInstanceError (type, err) {
  let error = `Failed to instantiate actor '${type}' with ${err.stack}`
  log.error(error)
  return Promise.reject(new Error(error))
}

module.exports = function (lookup, manager, actors, queue, limit) {
  let q = queue || hashqueue.create(limit || 8)
  return {
    apply: apply.bind(undefined, actors, q),
    handle: handle.bind(undefined, q, lookup, manager, actors)
  }
}
