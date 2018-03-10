const { clone, flatten, map, sequence, sortBy } = require('fauxdash')
const apply = require('./apply')
const pluralize = require('pluralize')

function getSourceIds (instance, source, id) {
  let state = instance.state
  let plural = pluralize(source)
  if (state[ source ]) {
    const sub = state[ source ]
    if (Array.isArray(sub)) {
      return sub.map(i => i.id)
    } else if (sub.id) {
      return [ sub.id ]
    }
  } else if (state[ plural ]) {
    const sub = state[ plural ]
    if (Array.isArray(sub)) {
      return sub.map(i => i.id)
    } else if (sub.id) {
      return [ sub.id ]
    }
  } else if (state[ `${source}Id` ]) {
    return state[ `${source}Id` ]
  } else if (state[ `${plural}Id` ]) {
    return state[ `${plural}Id` ]
  } else {
    return [ id ]
  }
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
    let copy = clone(instance)
    let copyFactory = applyFn.bind(null, copy)
    let mainEvents
    return eventAdapter.fetch(type, id, lastEventId)
      .then(
        events => {
          mainEvents = events
          let calls = events.map(copyFactory)
          return sequence(calls)
            .then(
              () => {
                let factory = applyFn.bind(null, instance)
                let promises = []
                if (instance.actor.aggregateFrom) {
                  promises = flatten(
                    instance.actor.aggregateFrom.map((source) => {
                      let last = ''
                      if (copy.state.related) {
                        last = copy.state.related[ source ].lastEventId
                      }
                      let sourceIds = getSourceIds(copy, source, id)
                      return map(sourceIds, sourceId =>
                        eventAdapter.fetch(source, sourceId, last)
                      )
                    })
                  )
                }

                return Promise.all(promises)
                  .then((lists) => {
                    let list = sortBy(flatten(lists.concat(mainEvents)), 'id')
                    return onEvents(actorAdapter, eventAdapter, instance, factory, readOnly, list)
                  })
              }
            )
        }
      )
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

function getLatestAll (actors, actorAdapter, eventAdapter, queue, options, readOnly) {
  function applyFn (instance, event) {
    return function () {
      return apply(actors, queue, event.type, event, instance)
    }
  }
  const update = onActor.bind(null, applyFn, actorAdapter, eventAdapter, readOnly)
  return actorAdapter.fetchAll(options)
    .then(results =>
      Promise.all(
        map(results, (instances, type) => {
          if (Array.isArray(instances)) {
            return Promise.all(instances.map(update))
          } else {
            return update(instances)
          }
        })
      ).then(() => results)
    )
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
    getOrCreateAll: getLatestAll.bind(null, actors, actorAdapter, eventAdapter, queue),
    storeActor: actorAdapter.store,
    storeEvents: eventAdapter.store
  }
}
