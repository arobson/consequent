var _ = require( "lodash" );
var when = require( "when" );
var format = require( "util" ).format;
var apply = require( "./apply" );

function getAdapter( lib, state, artifact, type ) {
	var adapter = state[ artifact ][ type ];
	if( !adapter ) {
		adapter = lib.create( type );
		state[ artifact ][ type ] = adapter;
	}
	return adapter;
}

function getActorCache( actorCacheLib, caches, type ) {
	return getAdapter( actorCacheLib, caches, "actors", type );
}

function getActorStore( actorStoreLib, stores, type ) {
	return getAdapter( actorStoreLib, stores, "actors", type );
}

function getEventCache( eventCacheLib, caches, type ) {
	return getAdapter( eventCacheLib, caches, "events", type );
}

function getEventStore( eventStoreLib, stores, type ) {
	return getAdapter( eventStoreLib, stores, "events", type );
}

function getActorFromCache( actors, actorCacheLib, caches, type, id ) {
	var cache = getActorCache( actorCacheLib, caches, type );
	return cache.fetch( id )
		.then( function( instance ) {
			if( instance ) {
				return _.cloneDeep( instance );
			}
			return undefined;
		}, function( err ) {
			var error = format( "Failed to get instance '%s' of '%s' from cache with %s", type, id, err );
			console.log( error );
			return undefined;
		} );
}

function getActorFromStore( actors, actorStoreLib, stores, type, id ) {
	var store = getActorStore( actorStoreLib, stores, type );
	return store.fetch( id )
		.then( function( instance ) {
			if( instance ) {
				return _.cloneDeep( instance );
			} else {
				return _.cloneDeep( actors[ type ].factory() );
			}
		}, function( err ) {
			var error = format( "Failed to get instance '%s' of '%s' from store with %s", type, id, err );
			console.log( error );
			return when.reject( new Error( error ) );
		} );
}

function getEventsFromCache( eventCacheLib, caches, type, id, lastEventId ) {
	var cache = getEventCache( eventCacheLib, caches, type );
	return cache.getEventsFor( id, lastEventId )
		.then(
			function( events ) {
				return events || [];
			},
			function( err ) {
				var error = format( "Failed to get events for '%s' of '%s' from cache with %s", type, id, err );
				console.log( error );
				return [];
			}
		);
}

function getEventsFromStore( eventStoreLib, stores, type, id, lastEventId ) {
	var store = getEventStore( eventStoreLib, stores, type );
	return store.getEventsFor( id, lastEventId )
		.then(
			function( events ) {
				return events || [];
			},
			function( err ) {
				var error = format( "Failed to get events for '%s' of '%s' from store with %s", type, id, err );
				console.log( error );
				return [];
			}
		);
}

function getEvents( eventStoreLib, eventCacheLib, stores, caches, type, id, lastEventId ) {
	return getEventsFromCache( eventCacheLib, caches, type, id, lastEventId )
		.then( function( cachedEvents ) {
			if( cachedEvents.length === 0 ) {
				return getEventsFromStore( eventStoreLib, stores, type, id, lastEventId );
			} else {
				return cachedEvents;
			}
		} );
}

function getBaseline( actors, stores, caches, actorStoreLib, actorCacheLib, type, id ) {
	return getActorFromCache( actors, actorCacheLib, caches, type, id )
		.then( function( instance ) {
			if( instance ) {
				return instance;
			} else {
				return getActorFromStore( actors, actorStoreLib, stores, type, id );
			}
		} );
}

function getLatest( actors, queue, stores, caches, actorStoreLib, actorCacheLib, eventStoreLib, eventCacheLib, type, id ) {
	return getBaseline( actors, stores, caches, actorStoreLib, actorCacheLib, type, id )
		.then( function( instance ) {
			return getEvents( eventStoreLib, eventCacheLib, stores, caches, type, id, instance.lastEventId )
				.then( function( events ) {
					return when.all( _.map( events, function( event ) {
						return apply( actors, queue, event.type, event, instance );
					} ) )
					.then( function() {
						return instance;
					} );
				} );
		} );
}

module.exports = function( actors, queue, actorStoreLib, actorCacheLib, eventStoreLib, eventCacheLib ) {
	var stores = {
		actors: {},
		events: {}
	};
	var caches = {
		actors: {},
		events: {}
	};
	return {
		caches: caches,
		stores: stores,
		getOrCreate: getLatest.bind( null, actors, queue, stores, caches, actorStoreLib, actorCacheLib, eventStoreLib, eventCacheLib )
	};
};
