var _ = require( "lodash" );
var when = require( "when" );
var hashqueue = require( "hashqueue" );
var format = require( "util" ).format;
var apply = require( "./apply" );
var sliver = require( "sliver" )();

function handle( queue, lookup, manager, actors, id, topic, message ) {
	var types = lookup[ topic ] || [];
	var error;

	var dispatches = _.map( types, function( type ) {
		if( !actors[ type ] ) {
			error = format( "No registered actors handle messages of type '%s'", topic );
			console.error( error );
			return when.reject( new Error( error ) );
		}
		return manager.getOrCreate( type, id )
			.then(
				function( instance ) {
					instance.actor.id = instance.actor.id || id;
					return apply( actors, queue, topic, message, instance )
						.then(
							function( result ) {
								if( result && !result.rejected ) {
									var promises = _.reduce( result, function( acc, set ) {
										_.each( set.events, function( event ) {
											event.id = sliver.getId();
											event.correlationId = set.actor.id;
											event.actorType = set.actor.type;
											event.initiatedBy = topic;
											event.initiatedById = message.id;
											event.createdOn = new Date().toISOString();
										} );
										var promise = manager.storeEvents( set.actor.type, set.actor.id, set.events );
										acc.push( promise );
										return acc;
									}, [] );

									return when.all( promises )
										.then( function() {
											return result;
										} );
								}
							} );
				},
				function( err ) {
					error = format( "Failed to instantiate actor '%s' with %s", type, err.stack );
					console.error( error );
					return when.reject( new Error( error ) );
				}
			);
	} );
	return when.all( dispatches )
	.then( _.flatten );
}

module.exports = function( lookup, manager, actors, queue, limit ) {
	queue = queue || hashqueue.create( limit || 8 );
	return {
		apply: apply.bind( undefined, actors, queue ),
		handle: handle.bind( undefined, queue, lookup, manager, actors )
	};
};
