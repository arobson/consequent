var _ = require( "lodash" );
var when = require( "when" );
var sequence = require( "when/sequence" );
var apply = require( "./apply" );

function getSourceId( instance, source, id ) {
	var state = instance.state;
	var propId = state[ source + "Id" ];
	var nestedId = state[ source ] ? state[ source ].id : undefined;
	return propId || nestedId || id;
}

function onActor( applyFn, actorAdapter, eventAdapter, readOnly, instance ) {
	if ( _.isArray( instance ) ) {
		var first = instance[ 0 ];
		return actorAdapter.findAncestor( first.state.id, instance, [] )
			.then( onActor.bind( null, applyFn, actorAdapter, eventAdapter, readOnly ) );
	} else {
		var type = instance.actor.type;
		var id = instance.state.id;
		var lastEventId = instance.state.lastEventId;
		var factory = applyFn.bind( null, instance );

		if ( instance.actor.aggregateFrom ) {
			var promises = _.map( instance.actor.aggregateFrom, function( source ) {
				var last = instance.state.lastEventId[ source ];
				var sourceId = getSourceId( instance, source, id );
				return eventAdapter.fetch( source, sourceId, last );
			} );
			return when.all( promises )
				.then( function( lists ) {
					var list = _.sortBy( _.flatten( lists ), "id" );
					return onEvents( actorAdapter, eventAdapter, instance, factory, readOnly, list );
				} );
		} else {
			return eventAdapter.fetch( type, id, lastEventId )
				.then( onEvents.bind( null, actorAdapter, eventAdapter, instance, factory, readOnly ) );
		}
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
	var state = instance.state;
	var limit = actor.eventThreshold || 50;
	var skip = actor.snapshotOnRead ? false : readOnly;
	var underLimit = events.length < limit;

	function onSnapshot() {
		return eventAdapter.storePack( actor.type, state.id, state.vector, state.lastEventId, events )
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
