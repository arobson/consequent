var _ = require( "lodash" );
var sequence = require( "when/sequence" );
var apply = require( "./apply" );

function onActor( applyFn, eventAdapter, instance ) {
	var type = instance.actor.type;
	var id = instance.actor.id;
	var lastEventId = instance.actor.lastEventId;
	var factory = applyFn.bind( null, instance );
	return eventAdapter.fetch( type, id, lastEventId )
		.then( onEvents.bind( null, instance, factory ) );
}

function onEvents( instance, factory, events ) {
	var calls = _.map( events, factory );
	return sequence( calls )
		.then( function() {
			return instance;
		} );
}

function getLatest( actors, actorAdapter, eventAdapter, queue, type, id ) {
	function applyFn( instance, event ) {
		return function() {
			return apply( actors, queue, event.type, event, instance );
		};
	}

	return actorAdapter.fetch( type, id )
		.then( onActor.bind( null, applyFn, eventAdapter ) );
}

module.exports = function( actors, actorAdapter, eventAdapter, queue ) {
	return {
		actors: actorAdapter,
		events: eventAdapter,
		getOrCreate: getLatest.bind( null, actors, actorAdapter, eventAdapter, queue ),
		storeActor: actorAdapter.store,
		storeEvents: eventAdapter.store
	};
};
