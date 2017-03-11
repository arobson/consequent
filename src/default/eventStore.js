const { filter } = require('fauxdash')

function getEventsFor (state, type, actorId, lastEventId) {
  let actorEvents = state.events[ type ]
  if (actorEvents) {
    let events = filter(actorEvents[ actorId ], (event) => {
      return !lastEventId || lastEventId < event.id
    })
    return Promise.resolve(events)
  }
  return Promise.resolve(undefined)
}

function getEventPackFor (state, type, actorId, vectorClock) {
  let packs = state.packs[ type ]
  if (packs) {
    let key = [ actorId, vectorClock ].join('-')
    return Promise.resolve(packs[ key ])
  }
  return Promise.resolve(undefined)
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
        storeEvents: storeEvents.bind(null, state, type),
        storeEventPackFor: storeEventPackFor.bind(null, state, type)
      }
    }
  }
}
