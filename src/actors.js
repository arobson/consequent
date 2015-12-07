var _ = require( "lodash" );
var when = require( "when" );
var format = require( "util" ).format;
var clock = require( "vectorclock" );
var log = require( "./log" )( "consequent.actors" );

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

function getActorFromCache( actors, adapters, cacheLib, type, id ) {
	var cache = getCache( adapters, cacheLib, type );

	function onInstance( instance ) {
		var clone;
		if ( instance ) {
			clone = _.cloneDeep( actors[ type ].factory() );
			clone.actor = instance;
			clone.actor.id = id;
		}
		return clone;
	}

	function onError( err ) {
		var error = format( "Failed to get instance '%s' of '%s' from cache with %s", id, type, err );
		log.error( error );
		return undefined;
	}

	return cache.fetch( id )
		.then( onInstance, onError );
}

function getActorFromStore( actors, adapters, storeLib, type, id ) {
	var store = getStore( adapters, storeLib, type );

	function onInstance( instance ) {
		var clone = _.cloneDeep( actors[ type ].factory() );
		if ( instance ) {
			clone.actor = instance;
		}
		clone.actor.id = id;
		return clone;
	}

	function onError( err ) {
		var error = format( "Failed to get instance '%s' of '%s' from store with %s", id, type, err );
		log.error( error );
		return when.reject( new Error( error ) );
	}

	return store.fetch( id )
		.then( onInstance, onError );
}

function getBaseline( actors, adapters, storeLib, cacheLib, type, id ) {
	function onActor( instance ) {
		if ( instance ) {
			return instance;
		} else {
			return getActorFromStore( actors, adapters, storeLib, type, id );
		}
	}

	return getActorFromCache( actors, adapters, cacheLib, type, id )
		.then( onActor );
}

function parseVector( vector ) {
	var pairs = vector.split( ";" );
	return _.reduce( pairs, function( acc, pair ) {
		var kvp = pair.split( ":" );
		acc[ kvp[ 0 ] ] = parseInt( kvp[ 1 ] );
		return acc;
	}, {} );
}

function stringifyVector( vector ) {
	var pairs = _.map( vector, function( v, k ) {
		return k + ":" + v;
	} );
	return pairs.join( ";" );
}

function storeSnapshot( actors, adapters, storeLib, cacheLib, nodeId, instance ) {
	var actor = instance.actor;
	var type = actor.type;
	var cache = getCache( adapters, cacheLib, type );
	var store = getStore( adapters, storeLib, type );
	var vector = parseVector( actor.vector );
	vector = clock.increment( vector, nodeId );
	actor.vector = stringifyVector( vector );
	function onCacheError( err ) {
		var error = format( "Failed to cache actor '%s' of '%s' with %s", actor.id, type, err );
		log.error( error );
		throw new Error( error );
	}

	function onStored() {
		return cache.store( actor.id, actor.vector, actor )
			.then( null, onCacheError );
	}

	function onError( err ) {
		var error = format( "Failed to store actor '%s' of '%s' with %s", actor.id, type, err );
		log.error( error );
		throw new Error( error );
	}

	return store.store( actor.id, actor.vector, actor )
		.then( onStored, onError );
}

module.exports = function( actors, actorStoreLib, actorCacheLib, nodeId ) {
	var adapters = {
		store: {},
		cache: {}
	};
	return {
		adapters: adapters,
		fetch: getBaseline.bind( null, actors, adapters, actorStoreLib, actorCacheLib ),
		store: storeSnapshot.bind( null, actors, adapters, actorStoreLib, actorCacheLib, nodeId )
	};
};
