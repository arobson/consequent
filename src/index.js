const dispatchFn = require('./dispatch')
const loader = require('./loader')
const managerFn = require('./manager')
const actorsFn = require('./actors')
const eventsFn = require('./events')
const streamBuilderFn = require('./streamBuilder')
const subscriptions = require('./subscriptions')
const path = require('path')
const apply = require('./apply')
const hashqueue = require('hashqueue')
const defaultNodeId = [ process.title, process.pid ].join('-')

const defaults = {
  actorCache: require('./default/actorCache')(),
  actorStore: require('./default/actorStore')(),
  eventCache: require('./default/eventCache')(),
  eventStore: require('./default/eventStore')()
}

function initialize (config) {
  require('./log')(config.logging || { level: 'none' })

  config.actorCache = config.actorCache || defaults.actorCache
  config.actorStore = config.actorStore || defaults.actorStore
  config.eventCache = config.eventCache || defaults.eventCache
  config.eventStore = config.eventStore || defaults.eventStore

  if (!config.fount) {
    config.fount = require('fount')
  }

  let defaultQueue = hashqueue.create(config.concurrencyLimit || 8)
  let queue = config.queue = (config.queue || defaultQueue)
  let actorsPath = config.actors || path.join(process.cwd(), './actors')

  function onMetadata (actors) {
    let lookup = subscriptions.getActorLookup(actors)
    let topics = subscriptions.getTopics(actors)
    let actorAdapter = actorsFn(actors, config.actorStore, config.actorCache, config.nodeId || defaultNodeId)
    let eventAdapter = eventsFn(config.eventStore, config.eventCache)
    let manager = managerFn(actors, actorAdapter, eventAdapter, queue)
    let dispatcher = dispatchFn(lookup, manager, actors, config.queue)
    let streamBuilder = streamBuilderFn(manager, dispatcher, actorAdapter, eventAdapter)

    return {
      apply: function (instance, message) {
        return apply(actors, config.queue, message.type || message.topic, message, instance)
      },
      fetch: manager.getOrCreate,
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
