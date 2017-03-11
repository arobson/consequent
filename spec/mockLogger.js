const _ = require('lodash')

var namespaces = {}
var adapter = {
  namespaces: namespaces,
  init: function (ns) {
    if (!namespaces[ ns ]) {
      namespaces[ ns ] = { entries: [] }
    }
    namespaces[ ns ].entries = {
      info: [],
      debug: [],
      warn: [],
      error: []
    }
    return namespaces[ ns ]
  },
  reset: function (ns) {
    this.init(ns)
  },
  write: function (raw) {
    const entry = JSON.parse(raw.toString())
    let ns = namespaces[ entry.name ]
    if (!ns) {
      ns = this.init(entry.name)
    }
    ns
      .entries[ entry.level ]
      .push(entry.message)
  }
}

_.bindAll(adapter)

module.exports = function mockLogAdapter (ns) {
  adapter.init(ns)
  return adapter
}
