const { any, contains, clone, filter, map, reduce, sortBy } = require('fauxdash')

const EventEmitter = require('events')

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

function getActorStream (manager, dispatcher, actorAdapter, eventAdapter, actorType, actorId, options) {
  let baselinePromise
  let eventFilter = () => true
  if (options.sinceEventId) {
    baselinePromise = actorAdapter.fetchByLastEventId()
  } else if (options.sinceDate) {
    baselinePromise = actorAdapter.fetchByLastEventDate()
  } else {
    return Promise.reject(new Error('sinceDate or sinceEventId is required to determine the actor baseline for the stream'))
  }
  if (options.eventTypes) {
    eventFilter = (event) => {
      return contains(options.eventTypes, event.type)
    }
  }
  return baselinePromise
    .then(
      baseline => {
        const actors = new EventEmitter()
        actors.once('newListener', (e, listener) => {
          if (e === 'actor') {
            actors.emit('actor', clone(baseline))
          }
        })
        const events = eventAdapter.fetchStream(actorType, options.sinceDate || options.sinceEventId)
        events.on('event', event => {
          dispatcher
            .apply(event.type, event, baseline)
              .then(() => {
                if (eventFilter(event)) {
                  actors.emit('actor', clone(baseline))
                }
              })
        })
        events.on('streamComplete', () => {
          actors.emit('streamComplete')
          process.nextTick(() => actors.removeAllListeners())
        })
        return actors
      }
    )
}

function getEventStream (eventAdapter, options) {
  const typeQueues = {}
  const emptied = {}
  const merged = new EventEmitter()

  const finalize = () => {
    merged.emit('streamComplete')
    merged.removeAllListeners()
  }

  const validEvent = (event) => {
    return !options.eventTypes || options.eventTypes.indexOf(event.type) >= 0
  }

  options.actorTypes.forEach(type => {
    typeQueues[type] = []
  })

  const update = () => {
    let count = Object.keys(typeQueues).length
    let depth = Object.keys(emptied).length === options.actorTypes.length ? 1 : 2
    if (checkQueues(typeQueues, count, depth)) {
      let list = chooseEvents(typeQueues)
      list.forEach(e => merged.emit('event', e))
    } else {
      process.nextTick(() => {
        update()
      })
    }
    removeEmpty(emptied, typeQueues, finalize)
  }

  options.actorTypes.forEach(type => {
    const events = eventAdapter.fetchStream(type, options.sinceDate || options.sinceEventId)
    events.on('event', event => {
      if (validEvent(event)) {
        let backlog = typeQueues[type]
        backlog.push(event)
        update()
      }
    })
    events.on('streamComplete', () => {
      let backlog = typeQueues[type]
      backlog.push(undefined)
      emptied[type] = true
      update()
    })
  })

  return merged
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

function removeEmpty (emptied, queues, cb) {
  map(emptied, (empty, type) => {
    if (empty) {
      if ((queues[type] && queues[type].length === 0) || (queues[type] && queues[type][0] === undefined)) {
        delete queues[type]
      }
    }
  })
  if (Object.keys(queues).length === 0) {
    cb()
  }
}

module.exports = function (manager, dispatcher, actorAdapter, eventAdapter) {
  return {
    checkQueues: checkQueues,
    checkSetIntersection: checkSetIntersection,
    chooseEvents: chooseEvents,
    depthCheck: depthCheck,
    findTypeById: findTypeById,
    getActorStream: getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter),
    getEventStream: getEventStream.bind(null, eventAdapter),
    getIdSeriesFromIndex: getIdSeriesFromIndex,
    mergeAndSort: mergeAndSort,
    removeEmpty: removeEmpty
  }
}
