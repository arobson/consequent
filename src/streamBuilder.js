const { any, contains, clone, filter, map, reduce, sortBy, unique } = require('fauxdash')

function checkQueues (queues, count, depth) {
  return count === Object.keys(queues).length && depthCheck(queues, depth)
}

function checkSetIntersection (a, b) {
  if (b.length === 0 || a.length === 0) {
    return false
  }
  let last = a.sort()[a.length - 1]
  let first = b.sort()[0]
  return first < last
}

function chooseEvents (queues) {
  // check to ensure that the next set of events for one type don't come before
  // all events in another type's sequence
  let first = getIdSeriesFromIndex(queues, 0)
  let second = getIdSeriesFromIndex(queues, 1)
  if (checkSetIntersection(first, second)) {
    // we can only send events from the type with the lowest id
    let lowest = first.sort()[0]
    let type = findTypeById(queues, lowest)
    return [ queues[ type ].shift() ]
  } else {
    // we can safely send all queued events in order
    return mergeAndSort(queues)
  }
}

function depthCheck (queues, depth) {
  return reduce(queues, (acc, q) => acc && q.length >= depth, true)
}

function findTypeById (queues, id) {
  return reduce(queues, (type, q, k) => {
    if (any(q, e => e.id === id)) {
      type = k
    }
    return type
  }, undefined)
}

async function* getActorStream (manager, dispatcher, actorAdapter, eventAdapter, actorType, actorId, options) {
  let baselinePromise
  let eventFilter = () => true
  let typeList = manager.models[ actorType ].actor._actorTypes
  if (options.sinceId) {
    baselinePromise = actorAdapter.fetchByLastEventId(actorId, options.sinceId)
  } else if (options.since) {
    baselinePromise = actorAdapter.fetchByLastEventDate(actorId, options.since)
  } else {
    return Promise.reject(new Error('sinceDate or sinceEventId is required to determine the actor baseline for the stream'))
  }
  if (options.eventTypes) {
    eventFilter = (event) => {
      return contains(options.eventTypes, event.type)
    }
  }
  const baseline = await baselinePromise
  yield clone(baseline).state
  let streamOptions = {
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
    streamOptions.actors = typeList.reduce((acc, t) => {
      if (t === actorType) {
        acc[t] = actorId
      } else {
        acc[t] = manager.getSourceIds(baseline, t, actorId)
      }
      return acc
    }, {})
  }
  const events = getEventStream(manager, eventAdapter, actorId, streamOptions)
  for (let event of events) {
    await dispatcher.apply(event.type, event, baseline)
      if (eventFilter(event)) {
        yield clone(baseline).state
      } else {
      }
  }
  return
}

function getEventStream (manager, eventAdapter, actorId, options) {
  const validEvent = (event) => {
    return !options.eventTypes || options.eventTypes.indexOf(event.type) >= 0
  }
  const typeQueues = {}
  const emptied = {}
  let queued = []
  let done = false
  let actorTypes = []
  let fullEventTypes = []
  let actorList
  if (options.actors) {
    actorList = Object.keys(options.actors)
  } else {
    actorList = options.actorTypes || [options.actorType]
  }
  actorList.forEach(t => {
    const metadata = manager.models[ t ]
    actorTypes = actorTypes.concat(t, metadata.actor._actorTypes)
    fullEventTypes = fullEventTypes.concat(metadata.actor._eventTypes)
  })
  actorTypes = unique(filter(actorTypes))
  fullEventTypes = unique(fullEventTypes)
  actorTypes.forEach(type => {
    typeQueues[type] = []
  })

  const update = () => {
    let count = Object.keys(typeQueues).length
    let depth = Object.keys(emptied).length === actorTypes.length ? 1 : 2
    if (checkQueues(typeQueues, count, depth)) {
      let list = chooseEvents(typeQueues)
      queued = queued.concat(list)
    } else {
      process.nextTick(() => {
        update()
      })
    }
    if (removeEmpty(emptied, typeQueues)) {
      done = true
    }
  }

  const getEvents = (type, id) => {
    const events = eventAdapter.fetchStream(type, id, {
      since: options.since,
      sinceId: options.sinceId,
      until: options.until,
      untilId: options.untilId,
      filter: options.filter
    })
    for(const event of events) {
      if (validEvent(event)) {
        let backlog = typeQueues[type]
        backlog.push(event)
        update()
      }
    }
  }

  actorTypes.forEach(type => {
    if (options.actor && typeof options.actors[ type ] === 'array') {
      options.actors[type].forEach(id => {
        getEvents(type, id)
      })
    } else {
      let id = options.actors ? options.actors[type] : actorId
      getEvents(type, id)
    }
    let backlog = typeQueues[type]
    backlog.push(undefined)
    emptied[type] = true
    update()
  })

  const iterator = {
    next: function () {
      if (done && queued.length === 0) {
        return { done: true}
      } else if (queued.length > 0 ) {
        const next = queued.shift()
        return { value: next, done: false }
      } else {
        return { done: false }
      }
    }
  }
  const iterable = {}
  iterable[ Symbol.iterator ] = () => {
    update()
    return iterator
  }
  return iterable
}

function getIdSeriesFromIndex (queues, index) {
  return reduce(queues, (acc, q) => {
    if (q[index]) {
      acc.push(q[index].id)
    }
    return acc
  }, [])
}

function mergeAndSort (queues) {
  const events = reduce(queues, (acc, q, k) =>
    acc.concat(filter(queues[k].splice(0, 2)))
  , [])
  sortBy(events, 'id')
  return events
}

function removeEmpty (emptied, queues) {
  map(emptied, (empty, type) => {
    if (empty) {
      if ((queues[type] && queues[type].length === 0) || (queues[type] && queues[type][0] === undefined)) {
        delete queues[type]
      }
    }
  })
  return Object.keys(queues).length === 0
}

module.exports = function (manager, dispatcher, actorAdapter, eventAdapter) {
  return {
    checkQueues: checkQueues,
    checkSetIntersection: checkSetIntersection,
    chooseEvents: chooseEvents,
    depthCheck: depthCheck,
    findTypeById: findTypeById,
    getActorStream: getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter),
    getEventStream: getEventStream.bind(null, manager, eventAdapter),
    getIdSeriesFromIndex: getIdSeriesFromIndex,
    mergeAndSort: mergeAndSort,
    removeEmpty: removeEmpty
  }
}
