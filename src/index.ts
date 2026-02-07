import dispatchFn from './dispatch.js'
import loader from './loader.js'
import managerFn from './manager.js'
import actorsFn from './actors.js'
import eventsFn from './events.js'
import streamBuilderFn from './streamBuilder.js'
import * as subscriptions from './subscriptions.js'
import path from 'node:path'
import apply from './apply.js'
import { queue as hashqueue } from 'haberdasher'
import { getBase62Provider } from 'node-flakes'
import searchFn from './search.js'
import os from 'node:os'
import logFn from './log.js'
import defaultActorCache from './default/actorCache.js'
import defaultActorStore from './default/actorStore.js'
import defaultEventCache from './default/eventCache.js'
import defaultEventStore from './default/eventStore.js'
import defaultSearchAdapter from './default/searchAdapter.js'
import type { ConsequentConfig, ConsequentApi, ActorMap } from './types.js'

const hostName = os.hostname()
const pid = process.pid
const seed = `${hostName}:${pid}`
const defaultNodeId = [process.title, process.pid].join('-')
const log = logFn('consequent')

const defaults = {
  actorCache: defaultActorCache(),
  actorStore: defaultActorStore(),
  eventCache: defaultEventCache(),
  eventStore: defaultEventStore(),
  searchAdapter: defaultSearchAdapter()
}

async function initialize(config: ConsequentConfig): Promise<ConsequentApi> {
  logFn((config.logging || { level: 'none' }) as Record<string, unknown>)

  config.actorCache = config.actorCache || defaults.actorCache
  config.actorStore = config.actorStore || defaults.actorStore
  config.eventCache = config.eventCache || defaults.eventCache
  config.eventStore = config.eventStore || defaults.eventStore
  config.searchAdapter = config.searchAdapter || defaults.searchAdapter

  if (!config.fount) {
    const fountMod = await import('fount')
    config.fount = fountMod.fount || fountMod.default || fountMod
  }

  const defaultQueue = hashqueue.create(config.concurrencyLimit || 8)
  const queue = config.queue = (config.queue || defaultQueue)
  const actorsPath = config.actors || path.join(process.cwd(), './actors')

  const actors = await loader(config.fount!, actorsPath) as ActorMap

  log.info(`initializing - using '${seed}' as node id seed`)
  const flakes = getBase62Provider(seed)
  const lookup = subscriptions.getActorLookup(actors)
  const topics = subscriptions.getTopics(actors)
  const actorAdapter = actorsFn(flakes, actors, config.actorStore!, config.actorCache!, config.nodeId || defaultNodeId)
  const eventAdapter = eventsFn(config.eventStore!, config.eventCache!)
  const manager = managerFn(actors, actorAdapter as any, eventAdapter as any, queue)
  const search = searchFn(manager as any, config.searchAdapter!)
  const dispatcher = dispatchFn(flakes, lookup, manager as any, search, actors, config.queue)
  const streamBuilder = streamBuilderFn(manager as any, dispatcher as any, actorAdapter as any, eventAdapter as any)

  return {
    apply: function (instance, message) {
      return apply(actors, config.queue!, message.type || message.topic!, message, instance)
    },
    fetch: manager.getOrCreate,
    fetchAll: manager.getOrCreateAll,
    find: search.find,
    getActorStream: streamBuilder.getActorStream!,
    getEventStream: streamBuilder.getEventStream!,
    handle: dispatcher.handle,
    topics: topics,
    actors: actors
  } as ConsequentApi
}

export default initialize
