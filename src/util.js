var _ = require( "lodash" );

function getArguments( fn ) {
	var fnString = fn.toString();
	if ( /[(][^)]*[)]/.test( fnString ) ) {
		return _.isFunction( fn ) ?
			trim( /[(]([^)]*)[)]/.exec( fnString )[ 1 ].split( "," ) ) : [];
	} else {
		return undefined;
	}
}

function mapMessageToCall( method, map ) {
	var argumentList = getArguments( method ).slice( 1 );
	if ( map === false ) {
		return method;
	} else if ( map ) {
		return function( actor, message ) {
			var appliedArgs = [ actor ];
			_.each( argumentList, function( arg ) {
				var prop = map[ arg ] ? map[ arg ] : arg;
				appliedArgs.push( message[ prop ] );
			} );
			return method.apply( undefined, appliedArgs );
		};
	} else {
		return function( actor, message ) {
			var appliedArgs = [ actor ];
			_.each( argumentList, function( arg ) {
				appliedArgs.push( message[ arg ] );
			} );
			return method.apply( undefined, appliedArgs );
		};
	}
}

function trimString( str ) {
	return str.trim();
}

function trim( list ) {
	return ( list && list.length ) ? _.filter( list.map( trimString ) ) : [];
}

module.exports = {
	mapCall: mapMessageToCall
};
