var _ = require( "lodash" );
var when = require( "when" );
var hashqueue = require( "hashqueue" );
var format = require( "util" ).format;
var apply = require( "./apply" );

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
					return apply( actors, queue, topic, message, instance );
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
