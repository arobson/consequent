const clock = require('vectorclock')

function increment (vector, nodeId) {
  clock.increment(vector, nodeId)
}

function parse (vector) {
  var pairs = vector.split(';')
  return pairs.reduce((acc, pair) => {
    if (pair) {
      var kvp = pair.split(':')
      acc[ kvp[ 0 ] ] = parseInt(kvp[ 1 ])
    }
    return acc
  }, {})
}

function stringify (vector) {
  let keys = Object.keys(vector)
  var pairs = keys.sort().map((key) => {
    return `${key}:${vector[key]}`
  })
  return pairs.join(';')
}

function toVersion (vector) {
  const clocks = vector.split(';')
  return clocks.reduce((version, clock) => {
    if (clock) {
      const parts = clock.split(':')
      return version + parseInt(parts[ 1 ])
    }
    return version
  }, 0)
}

module.exports = {
  increment,
  parse,
  stringify,
  toVersion
}
