var _ = require( 'lodash' );
var fs = require( 'fs' );
var path = require( 'path' );
var nodeWhen = require( 'when/node' );
var readDirectory = nodeWhen.lift( fs.readdir );
var when = require( 'when' );

// reads argument names from a function
function getArguments( fn ) {
	return _.isFunction( fn ) ? trim( /[(]([^)]*)[)]/.exec( fn.toString() )[ 1 ].split( ',' ) ) : [];
}

// returns a list of resource files from a given parent directory
function getActors( filePath ) {
	if ( fs.existsSync( filePath ) ) {
		return readDirectory( filePath )
			.then( function( contents ) {
				return _.map( contents, function( item ) {
					var actorPath = path.join( filePath, item );
					if ( fs.existsSync( actorPath ) ) {
						return actorPath;
					}
				}.bind( this ) );
			}.bind( this ) );
	} else {
		return when.reject( new Error( 'Could not load actors from non-existent path "' + filePath + '"' ) );
	}
}

// loads a module based on the file path and resolves the function
// promises and all
function loadModule( actorPath ) {
	try {
		var key = path.resolve( actorPath );
		delete require.cache[ key ];
		var modFn = require( actorPath );
		var args = getArguments( modFn );
		if ( args.length ) {
			return fount.inject( modFn )
				.then( function( instance ) {
					return {
						type: instance.actor.type,
						metadata: instance,
						fn: function() {
							return fount.inject( modFn );
						}
					};
				} );
		} else {
			var instance = modFn();
			if ( when.isPromiseLike( instance ) ) {
				return instance.then( function( resolved ) {
					return {
						type: resolved.actor.type,
						metadata: resolved,
						fn: function() {
							return modFn();
						}
					};
				} );
			} else {
				return {
					type: instance.actor.type,
					instance: instance,
					fn: function() {
						return when( modFn() );
					}
				};
			}
		}
	} catch ( err ) {
		console.error( 'Error loading actor module at %s with: %s', actorPath, err.stack );
		return when( [] );
	}
}

// load actors from path and returns the modules once they're loaded
function loadActors( filePath ) {
	var actorPath = path.resolve( process.cwd(), filePath );
	return getActors( actorPath )
		.then( function( list ) {
			return when.all( _.map( _.filter( list ), loadModule ) )
				.then( function( lists ) {
					var actors = _.flatten( lists );
					return when.reduce( actors, function( acc, actor ) {
						acc[ actor.type ] = actor;
						return acc;
					}, {} );
				} );
		} );
}

function trimString( str ) {
	return str.trim();
}

function trim( list ) {
	return ( list && list.length ) ? _.filter( list.map( trimString ) ) : [];
}

module.exports = loadActors;
