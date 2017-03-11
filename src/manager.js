const { flatten, sequence, sortBy } = require('fauxdash')
const apply = require('./apply')

function getSourceId (instance, source, id) {
  let state = instance.state
  let propId = state[ source + 'Id' ]
  let nestedId = state[ source ] ? state[ source ].id : undefined
  return propId || nestedId || id
}

function onActor (applyFn, actorAdapter, eventAdapter, readOnly, instance) {
  if (Array.isArray(instance)) {
    let first = instance[ 0 ]
    return actorAdapter.findAncestor(first.state.id, instance, [])
      .then(onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly))
  } else {
    let type = instance.actor.type
    let id = instance.state.id
    let lastEventId = instance.state.lastEventId
    let factory = applyFn.bind(null, instance)

    if (instance.actor.aggregateFrom) {
      let promises = instance.actor.aggregateFrom.map((source) => {
        let last = instance.state.lastEventId[ source ]
        let sourceId = getSourceId(instance, source, id)
        return eventAdapter.fetch(source, sourceId, last)
      })
      return Promise.all(promises)
        .then((lists) => {
          let list = sortBy(flatten(lists), 'id')
          return onEvents(actorAdapter, eventAdapter, instance, factory, readOnly, list)
        })
    } else {
      return eventAdapter.fetch(type, id, lastEventId)
        .then(onEvents.bind(null, actorAdapter, eventAdapter, instance, factory, readOnly))
    }
  }
}

function onEvents (actorAdapter, eventAdapter, instance, factory, readOnly, events) {
  let calls = events.map(factory)
  return sequence(calls)
    .then(function () {
      return snapshot(actorAdapter, eventAdapter, events, readOnly, instance)
    })
}

function getLatest (actors, actorAdapter, eventAdapter, queue, type, id, readOnly) {
  function applyFn (instance, event) {
    return function () {
      return apply(actors, queue, event.type, event, instance)
    }
  }
  return actorAdapter.fetch(type, id)
    .then(onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly))
}

function snapshot (actorAdapter, eventAdapter, events, readOnly, instance) {
  let actor = instance.actor
  let state = instance.state
  let limit = actor.eventThreshold || 50
  let skip = actor.snapshotOnRead ? false : readOnly
  let underLimit = events.length < limit

  function onSnapshot () {
    return eventAdapter.storePack(actor.type, state.id, state.vector, state.lastEventId, events)
      .then(onEventpack, onEventpackError)
  }

  function onSnapshotError () {
    return instance
  }

  function onEventpack () {
    return instance
  }

  function onEventpackError () {
    return instance
  }
  if (skip || underLimit) {
    return instance
  } else {
    return actorAdapter.store(instance)
      .then(onSnapshot, onSnapshotError)
  }
}

module.exports = function (actors, actorAdapter, eventAdapter, queue) {
  return {
    actors: actorAdapter,
    events: eventAdapter,
    getOrCreate: getLatest.bind(null, actors, actorAdapter, eventAdapter, queue),
    storeActor: actorAdapter.store,
    storeEvents: eventAdapter.store
  }
}
