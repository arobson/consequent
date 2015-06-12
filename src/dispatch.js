var _ = require( 'lodash' );
var when = require( 'when' );
var hashqueue = require( 'hashqueue' );

function handle( queue, lookup, manager, id, topic, message ) {
	var types = lookup[ topic ] || [];
	var dispatches = _.map( types, function( type ) {
		return manager.getOrCreate( type, id )
			.then( function( instance ) {
				return queue.add( id, function() {
					return instance.handle( topic, message );
				} );
			} );
	} );
	return when.settle( dispatches );
}

module.exports = function( lookup, manager, queue, limit ) {
	queue = queue || hashqueue.create( limit || 8 );
	return {
		handle: handle.bind( undefined, queue, lookup, manager )
	};
};
