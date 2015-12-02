var _ = require( "lodash" );
var format = require( "util" ).format;

function getAdapter( adapters, lib, io, type ) {
	var adapter = adapters[ io ][ type ];
	if ( !adapter ) {
		adapter = lib.create( type );
		adapters[ io ][ type ] = adapter;
	}
	return adapter;
}

function getCache( adapters, cacheLib, type ) {
	return getAdapter( adapters, cacheLib, "cache", type );
}

function getStore( adapters, storeLib, type ) {
	return getAdapter( adapters, storeLib, "store", type );
}

function getEventsFromCache( adapters, cacheLib, type, id, lastEventId ) {
	var cache = getCache( adapters, cacheLib, type );
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

function getEventsFromStore( adapters, storeLib, type, id, lastEventId ) {
	var store = getStore( adapters, storeLib, type );
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

function getEvents( adapters, storeLib, cacheLib, type, id, lastEventId ) {
	return getEventsFromCache( adapters, cacheLib, type, id, lastEventId )
		.then( function( cachedEvents ) {
			if ( cachedEvents.length === 0 ) {
				return getEventsFromStore( adapters, storeLib, type, id, lastEventId );
			} else {
				return cachedEvents;
			}
		} )
		.then( function( events ) {
			return _.sortBy( events, "id" );
		} );
}

function storeEvents( adapters, storeLib, cacheLib, type, id, events ) {
	var store = getStore( adapters, storeLib, type );
	var cache = getCache( adapters, cacheLib, type );
	return store.storeEvents( id, events )
		.then(
			function() {
				return cache.storeEvents( id, events )
					.then( null, function( err ) {
						var error = format( "Failed to cache events for '%s' of '%s' with %s", type, id, err );
						console.log( error );
						return new Error( err );
					} );
			},
			function( err ) {
				var error = format( "Failed to store events for '%s' of '%s' with %s", type, id, err );
				console.log( error );
				return new Error( err );
			}
		);
}

module.exports = function( eventStoreLib, eventCacheLib ) {
	var adapters = {
		store: {},
		cache: {}
	};
	return {
		adapters: adapters,
		fetch: getEvents.bind( null, adapters, eventStoreLib, eventCacheLib ),
		store: storeEvents.bind( null, adapters, eventStoreLib, eventCacheLib )
	};
};
