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
		return queue.add( instance.state.id, function() {
			return process( handle, instance, message );
		} );
	} );
	return when.all( results )
		.then( _.filter );
}

function filterHandlers( handlers, instance, message ) {
	var list = [];
	return _.reduce( handlers, function( acc, def ) {
		var predicate = def.when;
		var handle = def.then;
		var exclusive = def.exclusive;
		var should = false;
		if ( !exclusive || list.length === 0 ) {
			should = predicate === true ||
				( _.isString( predicate ) && instance.state.state === predicate ) ||
				( _.isFunction( predicate ) && predicate( instance.state, message ) );
			if ( should ) {
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
	var actor = { type: instance.actor.type };
	_.merge( actor, instance.state );
	function onSuccess( events ) {
		instance.state.lastCommandId = command.id;
		instance.state.lastCommandHandledOn = new Date().toISOString();
		return {
			message: command,
			actor: actor,
			events: events
		};
	}

	function onError( err ) {
		return {
			rejected: true,
			message: command,
			actor: actor,
			reason: err
		};
	}

	return result
		.then( onSuccess, onError );
}

function processEvent( handle, instance, event ) {
	return when.resolve( handle( instance.state, event ) )
		.then( function() {
			if ( instance.actor.aggregateFrom ) {
				instance.state.lastEventId = instance.state.lastEventId || {};
				instance.state.lastEventId[ event.actorType ] = event.id;
			} else {
				instance.state.lastEventId = event.id;
			}
			instance.state.lastEventAppliedOn = new Date().toISOString();
		} );
}

module.exports = apply;
