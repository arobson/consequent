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
		var error = format( "Failed to get events for '%s' of '%s' from cache with %s", type, id, err );
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

function getPackFromCache( adapters, cacheLib, type, id, vector ) {
	var cache = getCache( adapters, cacheLib, type );

	function onEvents( events ) {
		return events || [];
	}

	function onError( err ) {
		var error = format( "Failed to get eventpack for '%s' of '%s' from store with %s", type, id, err );
		console.log( error );
		return [];
	}

	return cache.getEventPackFor( id, vector )
		.then( onEvents, onError );
}

function getPackFromStore( adapters, storeLib, type, id, vector ) {
	var store = getStore( adapters, storeLib, type );

	function onEvents( events ) {
		return events || [];
	}

	function onError( err ) {
		var error = format( "Failed to get eventpack for '%s' of '%s' from store with %s", type, id, err );
		console.log( error );
		return [];
	}

	return store.getEventPackFor( id, vector )
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

function getPack( adapters, storeLib, cacheLib, type, id, vector ) {
	function onEvents( cachedEvents ) {
		if ( cachedEvents.length === 0 ) {
			return getPackFromStore( adapters, storeLib, type, id, vector );
		} else {
			return cachedEvents;
		}
	}

	return getPackFromCache( adapters, cacheLib, type, id, vector )
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

function storePack( adapters, storeLib, cacheLib, type, id, vector, lastEventId, events ) {
	var store = getStore( adapters, storeLib, type );
	var cache = getCache( adapters, cacheLib, type );

	function onCacheError( err ) {
		var error = format( "Failed to cache eventpack for '%s' of '%s' with %s", type, id, err );
		console.log( error );
		return false;
	}

	function onStored( pack ) {
		return cache.storeEvents( id, vector, pack )
			.then( null, onCacheError );
	}

	function onStoreError( err ) {
		var error = format( "Failed to store eventpack for '%s' of '%s' with %s", type, id, err );
		console.log( error );
		return false;
	}

	function onEvents( loadedEvents ) {
		var pack = _.unique( loadedEvents.concat( events ) );
		return store.storeEventPack( id, vector, pack )
			.then( onStored.bind( null, pack ), onStoreError );
	}

	function onEventsError( err ) {
		var error = format( "Failed to fetch events to pack for '%s' of '%s' with %s", type, id, err );
		console.log( error );
		return false;
	}

	return store.getEvents( adapters, storeLib, cacheLib, type, id, lastEventId )
		.then( onEvents, onEventsError );
}

module.exports = function( eventStoreLib, eventCacheLib ) {
	var adapters = {
		store: {},
		cache: {}
	};
	return {
		adapters: adapters,
		fetch: getEvents.bind( null, adapters, eventStoreLib, eventCacheLib ),
		fetchPack: getPack.bind( null, adapters, eventStoreLib, eventCacheLib ),
		store: storeEvents.bind( null, adapters, eventStoreLib, eventCacheLib ),
		storePack: storePack.bind( null, adapters, eventStoreLib, eventCacheLib )
	};
};