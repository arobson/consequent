var _ = require( "lodash" );
var sequence = require( "when/sequence" );
var apply = require( "./apply" );

function getLatest( actors, actorAdapter, eventAdapter, queue, type, id ) {
	return actorAdapter.fetch( type, id )
		.then( function( instance ) {
			return eventAdapter.fetch( type, id, instance.lastEventId )
				.then( function( events ) {
					var calls = _.map( events, function( event ) {
						return function() {
							return apply( actors, queue, event.type, event, instance );
						};
					} );
					return sequence( calls )
						.then( function() {
							return instance;
						} );
				} );
		} );
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
