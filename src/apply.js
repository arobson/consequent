var _ = require( "lodash" );
var when = require( "when" );

function apply( actors, queue, topic, message, instance ) {
	var type = instance.actor.type;
	var metadata = actors[ type ].metadata;
	var parts = topic.split( "." );
	var alias = parts[ 0 ] === type ? parts.slice( 1 ).join( "." ) : topic;
	var isCommand = metadata.commands[ alias ];
	var getHandlers = isCommand ? getCommandHandlers : getEventHandlers;
	var process = isCommand ? processCommand : processEvent;
	var handlers = getHandlers( metadata, instance, alias, message );
	var results = _.map( handlers, function( handle ) {
		return queue.add( instance.actor.id, function() {
			return process( handle, instance, message );
		} );
	} );
	return when.all( results );
}

function filterHandlers( handlers, instance, message ) {
	var list = [];
	return _.reduce( handlers, function( acc, def ) {
		var predicate = def[ 0 ];
		var handle = def[ 1 ];
		var exclusive = def[ 2 ];
		var should = false;
		if( !exclusive || list.length === 0 ) {
			should = predicate === true ||
				( _.isString( predicate ) && instance.actor.state === predicate ) ||
				predicate( instance.actor, message );
			if( should ) {
				acc.push( handle );
			}
		}
		return acc;
	}, list );
}

function getCommandHandlers( metadata, instance, topic, message ) {
	return filterHandlers( metadata.commands[ topic ], instance, message );
}

function getEventHandlers( metadata, instance, topic, message ) {
	return filterHandlers( metadata.events[ topic ], instance, message );
}

function processCommand( handle, instance, command ) {
	var result = handle( instance, command );
	result = result.then ? result : when( result );
	return result
		.then( function( events ) {
			return {
				input: command,
				actor: instance.actor,
				events: events
			};
		}, function( err ) {
			return {
				rejected: true,
				message: command,
				actor: instance.actor,
				reason: err
			};
		} );
}

function processEvent( handle, instance, event ) {
	return when.resolve( handle( instance.actor, event ) );
}

module.exports = apply;
