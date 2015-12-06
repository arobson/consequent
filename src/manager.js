var _ = require( "lodash" );
var sequence = require( "when/sequence" );
var apply = require( "./apply" );

function onActor( applyFn, actorAdapter, eventAdapter, readOnly, instance ) {
	if ( _.isArray( instance ) ) {
		var first = instance[ 0 ];
		return actorAdapter.findAncestor( first.actor.id, instance, [] )
			.then( onActor.bind( null, applyFn, actorAdapter, eventAdapter, readOnly ) );
	} else {
		var type = instance.actor.type;
		var id = instance.actor.id;
		var lastEventId = instance.actor.lastEventId;
		var factory = applyFn.bind( null, instance );
		return eventAdapter.fetch( type, id, lastEventId )
			.then( onEvents.bind( null, actorAdapter, eventAdapter, instance, factory, readOnly ) );
	}
}

function onEvents( actorAdapter, eventAdapter, instance, factory, readOnly, events ) {
	var calls = _.map( events, factory );
	return sequence( calls )
		.then( function() {
			return snapshot( actorAdapter, eventAdapter, events, readOnly, instance );
		} );
}

function getLatest( actors, actorAdapter, eventAdapter, queue, type, id, readOnly ) {
	function applyFn( instance, event ) {
		return function() {
			return apply( actors, queue, event.type, event, instance );
		};
	}
	return actorAdapter.fetch( type, id )
		.then( onActor.bind( null, applyFn, actorAdapter, eventAdapter, readOnly ) );
}

function snapshot( actorAdapter, eventAdapter, events, readOnly, instance ) {
	var actor = instance.actor;
	var limit = actor.eventThreshold || 50;
	var skip = actor.snapshotOnRead ? false : readOnly;
	var underLimit = events.length < limit;

	function onSnapshot() {
		return eventAdapter.storePack( actor.id, actor.vector, actor.lastEventId, events )
			.then( onEventpack, onEventpackError );
	}

	function onSnapshotError() {
		return instance;
	}

	function onEventpack() {
		return instance;
	}

	function onEventpackError() {
		return instance;
	}

	if ( skip || underLimit ) {
		return instance;
	} else {
		return actorAdapter.store( instance )
			.then( onSnapshot, onSnapshotError );
	}
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
