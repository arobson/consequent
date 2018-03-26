const { clone, filter, has, isFunction, isObject, isString, mapCall, without } = require('fauxdash')
const fs = require('fs')
const path = require('path')
const glob = require('globulesce')
const log = require('./log')('consequent.loader')

// returns a list of resource files from a given parent directory
function getActors (filePath) {
  if (fs.existsSync(filePath)) {
    return glob(filePath, [ '*_actor.js' ])
  } else {
    let error = `Could not load actors from non-existent path '${filePath}'`
    log.error(error)
    return Promise.reject(new Error(error))
  }
}

// loads a module based on the file path
function loadModule (actorPath) {
  try {
    let key = path.resolve(actorPath)
    delete require.cache[ key ]
    return require(actorPath)
  } catch (err) {
    log.error(`Error loading actor module at ${actorPath} with ${err.stack}`)
    return undefined
  }
}

// load actors from path and returns the modules once they're loaded
function loadActors (fount, actors) {
  let result

  function addActor (acc, instance) {
    let factory = isFunction(instance.state)
      ? instance.state : () => clone(instance.state)
    processHandles(instance)
    acc[ instance.actor.type ] = {
      factory: factory,
      metadata: instance
    }
    return acc
  }

  function onActors (list) {
    function onInstances (instances) {
      return instances.reduce(addActor, {})
    }

    let modules = filter(list)
    let promises = modules.map((modulePath) => {
      let actorFn = loadModule(modulePath)
      return fount.inject(actorFn)
    })

    return Promise
      .all(promises)
      .then(onInstances)
  }

  if (isString(actors)) {
    let filePath = actors
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(process.cwd(), filePath)
    }
    return getActors(filePath)
      .then(onActors)
  } else if (Array.isArray(actors)) {
    result = actors.reduce((acc, instance) => {
      addActor(acc, instance)
      return acc
    }, {})
    return Promise.resolve(result)
  } else if (isObject(actors)) {
    let keys = Object.keys(actors)
    result = keys.reduce((acc, key) => {
      let instance = actors[ key ]
      addActor(acc, instance)
      return acc
    }, {})
    return Promise.resolve(result)
  } else if (isFunction(actors)) {
    result = actors()
    if (!result.then) {
      result = Promise.resolve(result)
    }
    return result.then(function (list) {
      return list.reduce((acc, instance) => {
        addActor(acc, instance)
        return Promise.resolve(acc)
      }, {})
    })
  }
}

function processHandle (handle) {
  let hash = handle
  if (Array.isArray(handle)) {
    hash = {
      when: handle[ 0 ],
      then: handle[ 1 ],
      exclusive: handle[ 2 ],
      map: handle[ 3 ]
    }
  } else if (isFunction(handle)) {
    hash = {
      when: true,
      then: handle,
      exclusive: true,
      map: true
    }
  } else if (isObject(handle)) {
    hash = {
      when: has(handle, 'when') ? handle.when : true,
      then: handle.then,
      exclusive: has(handle, 'exclusive') ? handle.exclusive : true,
      map: has(handle, 'map') ? handle.map : true
    }
  }

  let map = hash.map
  if (isFunction(hash.when)) {
    hash.when = mapCall(hash.when, map)
  }
  hash.then = mapCall(hash.then, map)

  return hash
}

function processHandles (instance) {
  const modelType = instance.actor.type
  let commandNames = Object.keys(instance.commands)
  instance.commands = commandNames.reduce((acc, name) => {
    let handlers = [].concat(instance.commands[ name ])
    let fullName = name
    if (!/[.]/.test(name)) {
      fullName = [modelType, name].join('.')
    }
    acc[ fullName ] = handlers.map(processHandle)
    return acc
  }, {})

  let eventNames = Object.keys(instance.events)
  const typeList = instance.actor._actorTypes = [ modelType ]
  const eventTypes = instance.actor._eventTypes = []
  instance.events = eventNames.reduce(function (acc, name) {
    let handlers = [].concat(instance.events[ name ])
    let fullName = name
    if (/[.]/.test(name)) {
      let [actorType] = name.split('.')
      if (actorType !== modelType &&
          instance.actor._actorTypes.indexOf(actorType) < 0) {
        typeList.push(actorType)
      }
    } else {
      fullName = [modelType, name].join('.')
    }
    acc[ fullName ] = handlers.map(processHandle)
    eventTypes.push(fullName)
    return acc
  }, {})
  if (!instance.actor.aggregateFrom && typeList.length > 1) {
    instance.actor.aggregateFrom = without(typeList, [modelType])
  }
}

module.exports = loadActors
