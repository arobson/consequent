import fs from 'node:fs'
import path from 'node:path'
import glob from 'globulesce'
import logFn from './log.js'
import fd from 'fauxdash'
import type { ActorMap, ActorInstance, Fount, HandlerDefinition } from './types.js'

const { clone, filter, isFunction, isObject, isString, mapCall, without } = fd
const log = logFn('consequent.loader')

function getActors(filePath: string): Promise<string[]> {
  if (fs.existsSync(filePath)) {
    return glob(filePath, ['*_actor.js'])
  } else {
    const error = `Could not load actors from non-existent path '${filePath}'`
    log.error(error)
    return Promise.reject(new Error(error))
  }
}

async function loadModule(actorPath: string): Promise<unknown> {
  try {
    const key = path.resolve(actorPath)
    const mod = await import(key)
    return mod.default || mod
  } catch (err) {
    log.error(`Error loading actor module at ${actorPath} with ${(err as Error).stack}`)
    return undefined
  }
}

function loadActors(fount: Fount, actors: unknown): Promise<ActorMap> {
  let result: ActorMap | Promise<ActorMap>

  function addActor(acc: ActorMap, instance: ActorInstance): ActorMap {
    const factory = isFunction(instance.state)
      ? instance.state as unknown as (id?: unknown) => unknown
      : () => clone(instance.state)
    processHandles(instance)
    acc[instance.actor.type] = {
      factory: factory,
      metadata: instance
    }
    return acc
  }

  function onActors(list: string[]): Promise<ActorMap> {
    function onInstances(instances: ActorInstance[]): ActorMap {
      return instances.reduce(addActor, {})
    }

    const modules = filter(list)
    const promises = modules.map((modulePath) => {
      return loadModule(modulePath)
        .then((actorFn) => fount.inject(actorFn))
    })

    return Promise
      .all(promises)
      .then(onInstances as (instances: unknown[]) => ActorMap)
  }

  if (isString(actors)) {
    let filePath = actors as string
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(process.cwd(), filePath)
    }
    return getActors(filePath)
      .then(onActors)
  } else if (Array.isArray(actors)) {
    result = (actors as ActorInstance[]).reduce((acc, instance) => {
      addActor(acc, instance)
      return acc
    }, {} as ActorMap)
    return Promise.resolve(result)
  } else if (isObject(actors)) {
    const keys = Object.keys(actors as Record<string, unknown>)
    result = keys.reduce((acc, key) => {
      const instance = (actors as Record<string, ActorInstance>)[key]
      addActor(acc, instance)
      return acc
    }, {} as ActorMap)
    return Promise.resolve(result)
  } else if (isFunction(actors)) {
    let funcResult = (actors as () => unknown)()
    if (!(funcResult as Promise<unknown>).then) {
      funcResult = Promise.resolve(funcResult)
    }
    return (funcResult as Promise<ActorInstance[]>).then(function (list) {
      return list.reduce((acc, instance) => {
        addActor(acc, instance)
        return acc
      }, {} as ActorMap)
    })
  }
  return Promise.resolve({})
}

function processHandle(handle: unknown): HandlerDefinition {
  let hash: HandlerDefinition
  if (Array.isArray(handle)) {
    hash = {
      when: handle[0],
      then: handle[1],
      exclusive: handle[2],
      map: handle[3]
    }
  } else if (isFunction(handle)) {
    hash = {
      when: true,
      then: handle as (...args: unknown[]) => unknown,
      exclusive: true,
      map: true
    }
  } else if (isObject(handle)) {
    const h = handle as Record<string, unknown>
    hash = {
      when: Object.hasOwn(h, 'when') ? h.when as HandlerDefinition['when'] : true,
      then: h.then as (...args: unknown[]) => unknown,
      exclusive: Object.hasOwn(h, 'exclusive') ? h.exclusive as boolean : true,
      map: Object.hasOwn(h, 'map') ? h.map as boolean : true
    }
  } else {
    hash = { when: true, then: handle as (...args: unknown[]) => unknown, exclusive: true, map: true }
  }

  const map = hash.map
  if (isFunction(hash.when)) {
    hash.when = mapCall(hash.when as (...args: any[]) => any, map as any) as unknown as HandlerDefinition['when']
  }
  hash.then = mapCall(hash.then as (...args: any[]) => any, map as any)

  return hash
}

function processHandles(instance: ActorInstance): void {
  const modelType = instance.actor.type
  const commandNames = Object.keys(instance.commands)
  instance.commands = commandNames.reduce((acc: Record<string, HandlerDefinition[]>, name) => {
    const handlers = ([] as unknown[]).concat(instance.commands[name])
    let fullName = name
    if (!/[.]/.test(name)) {
      fullName = [modelType, name].join('.')
    }
    acc[fullName] = handlers.map(processHandle)
    return acc
  }, {})

  const eventNames = Object.keys(instance.events)
  const typeList = instance.actor._actorTypes = [modelType]
  const eventTypes: string[] = instance.actor._eventTypes = []
  instance.events = eventNames.reduce(function (acc: Record<string, HandlerDefinition[]>, name) {
    const handlers = ([] as unknown[]).concat(instance.events[name])
    let fullName = name
    if (/[.]/.test(name)) {
      const [actorType] = name.split('.')
      if (actorType !== modelType &&
        instance.actor._actorTypes.indexOf(actorType) < 0) {
        typeList.push(actorType)
      }
    } else {
      fullName = [modelType, name].join('.')
    }
    acc[fullName] = handlers.map(processHandle)
    eventTypes.push(fullName)
    return acc
  }, {})
  if (!instance.actor.aggregateFrom && typeList.length > 1) {
    instance.actor.aggregateFrom = without(typeList, [modelType])
  }
}

export default loadActors
