function get (state, type, id) {
  let instance
  if (state[ type ]) {
    const _id = getSystemId(state, type, id)
    const list = state[ type ][ _id ]
    if (list && list.length > 0) {
      instance = list.slice(-1)
    }
  }
  return Promise.resolve(instance)
}

function findByLastEvent (state, type, field, id, value) {
  if (state[ type ]) {
    const _id = getSystemId(state, type, id)
    const actors = state[ type ][ _id ]
    let list = new Array(actors.length)
    const lookup = actors.reduce((acc, actor, i) => {
      let f = actor[ field ]
      list[ i ] = f
      acc[ f ] = actor
      return acc
    }, {})
    if (list[ value ]) {
      return Promise.resolve(list[ value ])
    } else {
      list.sort()
      var last
      do {
        let point = list.pop()
        if (point > value) {
          last = point
        } else if (last) {
          return Promise.resolve(lookup[ last ])
        } else {
          return Promise.resolve(lookup[ point ])
        }
      } while (list.length)
    }
  } else {
    return Promise.resolve(undefined)
  }
}

function getActorId (state, type, systemId, asOf) {
  if (state[ type ]) {
    const list = state[ type ].systemIds[ systemId ]
    let id
    if (list && list.length) {
      id = list.slice(-1)
    }
    return Promise.resolve(id)
  } else {
    return Promise.resolve(undefined)
  }
}

function getSystemId (state, type, actorId, asOf) {
  if (state[ type ]) {
    const list = state[ type ].actorIds[ actorId ]
    let id
    if (list && list.length) {
      id = list.slice(-1)
    }
    return Promise.resolve(id)
  } else {
    return Promise.resolve(undefined)
  }
}

function mapIds (state, type, systemId, actorId) {
  if (!state[ type ].actorIds[ actorId ]) {
    state[ type ].actorIds[ actorId ] = [ systemId ]
  } else {
    state[ type ].actorIds[ actorId ].push( systemId )
  }

  if (!state[ type ].systemIds[ systemId ]) {
    state[ type ].systemIds[ systemId ] = [ actorId ]
  } else {
    state[ type ].systemIds[ systemId ].push(actorId)
  }
}

function set (state, type, id, instance) {
  const _id = instance._id
  if (state[ type ][ _id ]) {
    state[ type ][ _id ].push(instance)
  } else {
    state[ type ][ _id ] = [ instance ]
  }
}

module.exports = function () {
  const state = {}
  return {
    state: state,
    create: (type) => {
      state[ type ] = {
        actorIds: {},
        systemIds: {}
      }
      return {
        fetch: get.bind(null, state, type),
        fetchByLastEventDate: findByLastEvent.bind(null, state, type, 'lastEventDate'),
        fetchByLastEventId: findByLastEvent.bind(null, state, type, 'lastEventId'),
        getActorId: getActorId.bind(null, state, type),
        getSystemId: getSystemId.bind(null, state, type),
        mapIds: mapIds.bind(null, state, type),
        store: set.bind(null, state, type)
      }
    }
  }
}
