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

	function onEvents( events ) {
		return events || [];
	}

	function onError( err ) {
		var error = format( "Failed to get events for '%s' of '%s' from store with %s", type, id, err );
		console.log( error );
		return [];
	}

	return cache.getEventsFor( id, lastEventId )
		.then( onEvents, onError );
}

function getEventsFromStore( adapters, storeLib, type, id, lastEventId ) {
	var store = getStore( adapters, storeLib, type );

	function onEvents( events ) {
		return events || [];
	}

	function onError( err ) {
		var error = format( "Failed to get events for '%s' of '%s' from store with %s", type, id, err );
		console.log( error );
		return [];
	}

	return store.getEventsFor( id, lastEventId )
		.then( onEvents, onError );
}

function getEvents( adapters, storeLib, cacheLib, type, id, lastEventId ) {
	function onEvents( cachedEvents ) {
		if ( cachedEvents.length === 0 ) {
			return getEventsFromStore( adapters, storeLib, type, id, lastEventId );
		} else {
			return cachedEvents;
		}
	}

	return getEventsFromCache( adapters, cacheLib, type, id, lastEventId )
		.then( onEvents )
		.then( function( events ) {
			return _.sortBy( events, "id" );
		} );
}

function storeEvents( adapters, storeLib, cacheLib, type, id, events ) {
	var store = getStore( adapters, storeLib, type );
	var cache = getCache( adapters, cacheLib, type );

	function onCacheError( err ) {
		var error = format( "Failed to cache events for '%s' of '%s' with %s", type, id, err );
		console.log( error );
		return new Error( err );
	}

	function onStored() {
		return cache.storeEvents( id, events )
			.then( null, onCacheError );
	}

	function onStoreError( err ) {
		var error = format( "Failed to store events for '%s' of '%s' with %s", type, id, err );
		console.log( error );
		return new Error( err );
	}

	return store.storeEvents( id, events )
		.then( onStored, onStoreError );
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
