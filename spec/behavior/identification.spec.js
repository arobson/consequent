require('../setup')

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

describe('Identification', function () {

})
