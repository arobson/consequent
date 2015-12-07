var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var glob = require( "globulesce" );
var when = require( "when" );
var util = require( "./util" );
var log = require( "./log" )( "consequent.loader" );

// returns a list of resource files from a given parent directory
function getActors( filePath ) {
	if ( fs.existsSync( filePath ) ) {
		return glob( filePath, [ "*_actor.js" ] );
	} else {
		var error = "Could not load actors from non-existent path '" + filePath + "'";
		log.error( error );
		return when.reject( new Error( error ) );
	}
}

// loads a module based on the file path
function loadModule( actorPath ) {
	try {
		var key = path.resolve( actorPath );
		delete require.cache[ key ];
		return require( actorPath );
	} catch ( err ) {
		log.error( "Error loading actor module at %s with %s", actorPath, err.stack );
		return undefined;
	}
}

// load actors from path and returns the modules once they're loaded
function loadActors( filePath ) {
	if ( !fs.existsSync( filePath ) ) {
		filePath = path.resolve( process.cwd(), filePath );
	}

	function onActors( list ) {
		return _.reduce( _.filter( list ), function( acc, filePath ) {
			var actorFn = loadModule( filePath );
			var instance = actorFn();
			if ( instance ) {
				updateHandles( instance );
				acc[ instance.actor.type ] = {
					factory: actorFn,
					metadata: instance
				};
			}
			return acc;
		}, {} );
	}

	return getActors( filePath )
		.then( onActors );
}

function updateHandles( instance ) {
	_.each( instance.commands, function( list ) {
		_.each( list, function( details ) {
			var map = details.length === 4 ? details[ 3 ] : false;
			if ( _.isFunction( details[ 0 ] ) ) {
				details[ 0 ] = util.mapCall( details[ 0 ], map );
			}
			details[ 1 ] = util.mapCall( details[ 1 ], map );
		} );
	} );
	_.each( instance.events, function( list ) {
		_.each( list, function( details ) {
			var map = details.length === 4 ? details[ 3 ] : false;
			if ( _.isFunction( details[ 0 ] ) ) {
				details[ 0 ] = util.mapCall( details[ 0 ], map );
			}
			details[ 1 ] = util.mapCall( details[ 1 ], map );
		} );
	} );
}

module.exports = loadActors;
