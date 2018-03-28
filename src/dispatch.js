const { flatten, map } = require('fauxdash')
const hashqueue = require('hashqueue')
const apply = require('./apply')
const log = require('./log')('consequent.dispatch')

function enrichEvent (sliver, set, command, event) {
  event.id = sliver.getId()

  const [actorType, type] = event.type.split('.')
  if (actorType === set.actor.type || !type) {
    event._actorId = set.state.id
    event._actorType = set.actor.type
    event._createdByVector = set.state._vector
    event._createdByVersion = set.state._version
    event._createdBy = set.actor.type
  } else {
    event._actorId = event[ actorType ].id
    event._actorId = event[ actorType ].id
    event._actorType = actorType
    event._createdByVector = event[ actorType ]._vector || set.actor._vector
    event._createdByVersion = event[ actorType ]._version || set.actor._version
  }
  event._createdBy = event._actorType
  event._createdById = event._actorId
  event._createdOn = new Date().toISOString()
  event._initiatedBy = command.type || command.topic
  event._initiatedById = command.id || ''
}

function enrichEvents (sliver, manager, command, result) {
  let lists = result.reduce((acc, set) => {
    set.events.forEach(event => {
      enrichEvent(sliver, set, command, event)
      if (!acc[event._actorType]) {
        acc[event._actorType] = {}
      }
      if (!acc[event._actorType][event._actorId]) {
        acc[event._actorType][event._actorId] = []
      }
      acc[event._actorType][event._actorId].push(event)
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

function handle (sliver, queue, lookup, manager, search, actors, id, topic, message) {
  let types = lookup[ topic ] || []
  let error
  let dispatches = types.map((type) => {
    if (!actors[ type ]) {
      error = `No registered actors handle messages of type '${topic}'`
      log.error(error)
      return Promise.reject(new Error(error))
    }
    log.debug(`dispatching ${topic} to ${type}:${id}`)
    return manager.getOrCreate(type, id)
      .then(
        onInstance.bind(null, sliver, actors, queue, manager, topic, message, id),
        onInstanceError.bind(null, type)
      )
  })
  return Promise
    .all(dispatches)
    .then(flatten)
    .then(results => {
      results.map(result => {
        let fields = result.actor.searchableBy
        if (fields) {
          search.update(result.actor.type, fields, result.state, result.original)
            .then(
              () => log.info(`updated ${result.actor.type}:${result.state.id} search index successfully`),
              err => log.warn(`failed to updated ${result.actor.type}:${result.state.id} search index with: ${err.message}`)
            )
        }
      })
      return results
    })
}

function onApplied (sliver, manager, command, result) {
  if (result && !result.rejected && result !== [ undefined ] && result !== []) {
    return enrichEvents(sliver, manager, command, result)
  } else {
    return result
  }
}

function onInstance (sliver, actors, queue, manager, topic, message, id, instance) {
  instance.state.id = instance.state.id || id
  log.debug(`applying ${topic} to ${instance.actor.type}:${id}`)
  return apply(actors, queue, topic, message, instance)
    .then(onApplied.bind(null, sliver, manager, message))
}

function onInstanceError (type, err) {
  let error = `Failed to instantiate actor '${type}' with ${err.stack}`
  log.error(error)
  return Promise.reject(new Error(error))
}

module.exports = function (sliver, lookup, manager, search, actors, queue, limit) {
  let q = queue || hashqueue.create(limit || 8)
  return {
    apply: apply.bind(undefined, actors, q),
    handle: handle.bind(undefined, sliver, q, lookup, manager, search, actors)
  }
}
