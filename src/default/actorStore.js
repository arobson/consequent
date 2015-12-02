var when = require( "when" );

function get( state, type, id ) {
	if ( state[ type ] ) {
		return when( state[ type ][ id ] );
	} else {
		return when( undefined );
	}
}

function set( state, type, id, instance ) {
	if ( !state[ type ] ) {
		state[ type ] = {};
	}
	state[ type ][ id ] = instance;
}

module.exports = function() {
	var state = {};
	return {
		state: state,
		create: function( type ) {
			return {
				fetch: get.bind( null, state, type ),
				store: set.bind( null, state, type )
			};
		}
	};
};
