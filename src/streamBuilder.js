
function getActorStream (manager, dispatcher, actorAdapter, eventAdapter, actorType, options) {
  // let baseline = actorAdapter
  // let events = eventAdapter.fetchStream(actorType, options.sinceDate || options.sinceEventId)
}

module.exports = function (manager, dispatcher, actorAdapter, eventAdapter) {
  return {
    getActorStream: getActorStream.bind(null, manager, dispatcher, actorAdapter, eventAdapter)
  }
}
