const { filter, sortBy } = require('fauxdash')

function eventFilter (options = {}) {
  return event => {
    return isAfterSince(event, options) &&
        isBeforeUntil(event, options) &&
        passesFilter(event, options)
  }
}

function eventSort (event) {
  return event.id
}

function getEventsFor (state, type, actorId, lastEventId) {
  let actorEvents = state.events[ type ]
  if (actorEvents && actorEvents[actorId]) {
    let events = filter(actorEvents[ actorId ], eventFilter(lastEventId))
    return Promise.resolve(events)
  }
  return Promise.resolve(undefined)
}

function * getEventStreamFor (state, type, actorId, options) {
  let typeEvents = state.events[ type ]
  if (typeEvents) {
    let actorEvents = typeEvents[ actorId ]
    let events = filter(actorEvents, eventFilter(options))
    events = sortBy(events, eventSort)
    yield * events
  }
}

function getEventPackFor (state, type, actorId, vectorClock) {
  let packs = state.packs[ type ]
  if (packs) {
    let key = [ actorId, vectorClock ].join('-')
    return Promise.resolve(packs[ key ])
  }
  return Promise.resolve(undefined)
}

function isAfterSince (event, options) {
  let pass = true
  if (options.sinceId) {
    pass = event.id > options.sinceId
  } else if (options.since) {
    pass = event._createdOn > options.since
  }
  return pass
}

function isBeforeUntil (event, options) {
  let pass = true
  if (options.untilId) {
    pass = event.id <= options.untilId
  } else if (options.until) {
    pass = event._createdOn >= options.until
  }
  return pass
}

function passesFilter (event, options) {
  let pass = true
  if (options.filter) {
    pass = options.filter(event)
  }
  return pass
}

function storeEvents (state, type, actorId, events) {
  let actorEvents = state.events[ type ] = state.events[ type ] || {}
  let list = actorEvents[ actorId ] = actorEvents[ actorId ] || []
  list = events.concat(list)
  state.events[ type ][ actorId ] = list
  return Promise.resolve()
}

function storeEventPackFor (state, type, actorId, vectorClock, events) {
  let packs = state.packs[ type ] || {}
  let key = [ actorId, vectorClock ].join('-')
  packs[ key ] = events
  state.packs[ type ] = packs
  return Promise.resolve()
}

module.exports = function () {
  const state = {
    events: {},
    packs: {}
  }
  return {
    create: function (type) {
      return {
        getEventsFor: getEventsFor.bind(null, state, type),
        getEventPackFor: getEventPackFor.bind(null, state, type),
        getEventStreamFor: getEventStreamFor.bind(null, state, type),
        storeEvents: storeEvents.bind(null, state, type),
        storeEventPackFor: storeEventPackFor.bind(null, state, type)
      }
    }
  }
}
