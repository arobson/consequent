function get (state, type, id) {
  if (state[ type ]) {
    let list = state[ type ][ id ]
    return Promise.resolve(list[ list.length - 1 ])
  } else {
    return Promise.resolve(undefined)
  }
}

function findByLastEvent (state, type, field, id, value) {
  if (state[ type ]) {
    const actors = state[ type ][ id ]
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

function set (state, type, id, instance) {
  if (!state[ type ]) {
    state[ type ] = {}
  }
  if (state[ type ][ id ]) {
    state[ type ][ id ].push(instance)
  } else {
    state[ type ][ id ] = [ instance ]
  }
}

module.exports = function () {
  const state = {}
  return {
    state: state,
    create: (type) => {
      return {
        fetch: get.bind(null, state, type),
        fetchByLastEventDate: findByLastEvent.bind(null, state, type, 'lastEventDate'),
        fetchByLastEventId: findByLastEvent.bind(null, state, type, 'lastEventId'),
        store: set.bind(null, state, type)
      }
    }
  }
}
