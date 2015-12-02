var dispatchFn = require( "./dispatch" );
var loader = require( "./loader" );
var managerFn = require( "./manager" );
var actorsFn = require( "./actors" );
var eventsFn = require( "./events" );
var subscriptions = require( "./subscriptions" );
var path = require( "path" );
var apply = require( "./apply" );
var hashqueue = require( "hashqueue" );

var defaults = {
	actorCache: require( "./default/actorCache" )(),
	actorStore: require( "./default/actorStore" )(),
	eventCache: require( "./default/eventCache" )(),
	eventStore: require( "./default/eventStore" )()
};

function initialize( config ) {
	config.actorCache = config.actorCache || defaults.actorCache;
	config.actorStore = config.actorStore || defaults.actorStore;
	config.eventCache = config.eventCache || defaults.eventCache;
	config.eventStore = config.eventStore || defaults.eventStore;
	var defaultQueue = hashqueue.create( config.concurrencyLimit || 8 );
	var queue = config.queue = ( config.queue || defaultQueue );

	var actorsPath = config.actors || path.join( process.cwd(), "./actors" );

	function onMetadata( actors ) {
		var lookup = subscriptions.getActorLookup( actors );
		var topics = subscriptions.getTopics( actors );
		var actorAdapter = actorsFn( actors, config.actorStore, config.actorCache );
		var eventAdapter = eventsFn( config.eventStore, config.eventCache );
		var manager = managerFn( actors, actorAdapter, eventAdapter, queue );
		var dispatcher = dispatchFn( lookup, manager, actors, config.queue );

		return {
			apply: function( instance, message ) {
				return apply( actors, config.queue, message.type || message.topic, message, instance );
			},
			fetch: manager.getOrCreate,
			handle: dispatcher.handle,
			topics: topics,
			actors: actors
		};
	}

	return loader( actorsPath )
		.then( onMetadata );
}

module.exports = initialize;
