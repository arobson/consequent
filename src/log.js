const log = require('bole')
const debug = require('debug')
const debugEnv = process.env.DEBUG

const debugOut = {
  write: function (data) {
    const entry = JSON.parse(data)
    debug(entry.name)(entry.level, entry.message)
  }
}

if (debugEnv && !log.debugOut) {
  log.output({
    level: 'debug',
    stream: debugOut
  })
  log.debugOut = true
}

module.exports = function (config) {
  if (typeof config === 'string') {
    return log(config)
  } else {
    log.output(config)
    return log
  }
}
