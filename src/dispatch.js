var _ = require( "lodash" );
var when = require( "when" );
var hashqueue = require( "hashqueue" );
var format = require( "util" ).format;
var apply = require( "./apply" );
var sliver = require( "sliver" )();
var log = require( "./log" )( "consequent.dispatch" );

function enrichEvent( set, event ) {
	event.id = sliver.getId();
	event.correlationId = set.actor.id;
	event.vector = set.actor.vector;
	event.actorType = set.actor.type;
	event.initiatedBy = set.message.type || set.message.topic;
	event.initiatedById = set.message.id;
	event.createdOn = new Date().toISOString();
}

function enrichEvents( manager, result ) {
	var promises = _.reduce( result, function( acc, set ) {
		_.each( set.events, enrichEvent.bind( null, set ) );
		var promise = manager.storeEvents( set.actor.type, set.actor.id, set.events );
		acc.push( promise );
		return acc;
	}, [] );

	return when.all( promises )
		.then( function() {
			return result;
		} );
}

function handle( queue, lookup, manager, actors, id, topic, message ) {
	var types = lookup[ topic ] || [];
	var error;

	var dispatches = _.map( types, function( type ) {
		if ( !actors[ type ] ) {
			error = format( "No registered actors handle messages of type '%s'", topic );
			log.error( error );
			return when.reject( new Error( error ) );
		}

		return manager.getOrCreate( type, id )
			.then(
				onInstance.bind( null, actors, queue, manager, topic, message, id ),
				onInstanceError.bind( null, type )
			);
	} );
	return when.all( dispatches )
	.then( _.flatten );
}

function onApplied( manager, result ) {
	if ( result && !result.rejected && result !== [ undefined ] && result !== [] ) {
		return enrichEvents( manager, result );
	} else {
		return result;
	}
}

function onInstance( actors, queue, manager, topic, message, id, instance ) {
	instance.state.id = instance.state.id || id;
	return apply( actors, queue, topic, message, instance )
		.then( onApplied.bind( null, manager ) );
}

function onInstanceError( type, err ) {
	var error = format( "Failed to instantiate actor '%s' with %s", type, err.stack );
	log.error( error );
	return when.reject( new Error( error ) );
}

module.exports = function( lookup, manager, actors, queue, limit ) {
	queue = queue || hashqueue.create( limit || 8 );
	return {
		apply: apply.bind( undefined, actors, queue ),
		handle: handle.bind( undefined, queue, lookup, manager, actors )
	};
};
