const dispatchFn = require('./dispatch')
const loader = require('./loader')
const managerFn = require('./manager')
const actorsFn = require('./actors')
const eventsFn = require('./events')
const streamBuilderFn = require('./streamBuilder')
const subscriptions = require('./subscriptions')
const path = require('path')
const apply = require('./apply')
const hashqueue = require('haberdasher').queue
const Flakes = require('node-flakes')
const searchFn = require('./search')
const os = require('os')
const hostName = os.hostname()
const pid = process.pid
const seed = `${hostName}:${pid}`
const defaultNodeId = [ process.title, process.pid ].join('-')
const log = require('./log')('consequent')

const defaults = {
  actorCache: require('./default/actorCache')(),
  actorStore: require('./default/actorStore')(),
  eventCache: require('./default/eventCache')(),
  eventStore: require('./default/eventStore')(),
  searchAdapter: require('./default/searchAdapter')()
}

function initialize (config) {
  require('./log')(config.logging || { level: 'none' })

  config.actorCache = config.actorCache || defaults.actorCache
  config.actorStore = config.actorStore || defaults.actorStore
  config.eventCache = config.eventCache || defaults.eventCache
  config.eventStore = config.eventStore || defaults.eventStore
  config.searchAdapter = config.searchAdapter || defaults.searchAdapter

  if (!config.fount) {
    config.fount = require('fount')
  }

  let defaultQueue = hashqueue.create(config.concurrencyLimit || 8)
  let queue = config.queue = (config.queue || defaultQueue)
  let actorsPath = config.actors || path.join(process.cwd(), './actors')

  function onMetadata (actors) {
    log.info(`initializing - using '${seed}' as node id seed`)
    let flakes = Flakes(seed)
    let lookup = subscriptions.getActorLookup(actors)
    let topics = subscriptions.getTopics(actors)
    let actorAdapter = actorsFn(flakes, actors, config.actorStore, config.actorCache, config.nodeId || defaultNodeId)
    let eventAdapter = eventsFn(config.eventStore, config.eventCache)
    let manager = managerFn(actors, actorAdapter, eventAdapter, queue)
    let search = searchFn(manager, config.searchAdapter)
    let dispatcher = dispatchFn(flakes, lookup, manager, search, actors, config.queue)
    let streamBuilder = streamBuilderFn(manager, dispatcher, actorAdapter, eventAdapter)

    return {
      apply: function (instance, message) {
        return apply(actors, config.queue, message.type || message.topic, message, instance)
      },
      fetch: manager.getOrCreate,
      fetchAll: manager.getOrCreateAll,
      find: search.find,
      getActorStream: streamBuilder.getActors,
      getEventStream: streamBuilder.getEvents,
      handle: dispatcher.handle,
      topics: topics,
      actors: actors
    }
  }

  return loader(config.fount, actorsPath)
    .then(onMetadata)
}

module.exports = initialize
