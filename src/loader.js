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
function loadActors( actors ) {
	var result;

	function addActor( acc, instance ) {
		var factory = _.isFunction( instance.state ) ?
			instance.state :
			function() {
				return _.cloneDeep( instance.state );
			};
		processHandles( instance );
		acc[ instance.actor.type ] = {
			factory: factory,
			metadata: instance
		};
	}

	function onActors( list ) {
		return _.reduce( _.filter( list ), function( acc, filePath ) {
			var actorFn = loadModule( filePath );
			var instance = actorFn();
			if ( instance ) {
				addActor( acc, instance );
			}
			return acc;
		}, {} );
	}

	if ( _.isString( actors ) ) {
		var filePath = actors;
		if ( !fs.existsSync( filePath ) ) {
			filePath = path.resolve( process.cwd(), filePath );
		}
		return getActors( filePath )
			.then( onActors );
	} else if ( _.isArray( actors ) ) {
		result = _.reduce( actors, function( acc, instance ) {
			addActor( acc, instance );
			return acc;
		}, {} );
		return when.resolve( result );
	} else if ( _.isObject( actors ) ) {
		result = _.reduce( actors, function( acc, instance ) {
			addActor( acc, instance );
			return acc;
		}, {} );
		return when.resolve( result );
	} else if ( _.isFunction( actors ) ) {
		result = actors();
		if ( !result.then ) {
			result = when.resolve( result );
		}
		return result.then( function( list ) {
			return _.reduce( list, function( acc, instance ) {
				addActor( acc, instance );
				return when.resolve( acc );
			}, {} );
		} );
	}
}

function processHandle( handle ) {
	var hash = handle;
	if ( _.isArray( handle ) ) {
		hash = {
			when: handle[ 0 ],
			then: handle[ 1 ],
			exclusive: handle[ 2 ],
			map: handle[ 3 ]
		};
	} else if ( _.isFunction( handle ) ) {
		hash = {
			when: true,
			then: handle,
			exclusive: true,
			map: true
		};
	} else if ( _.isObject( handle ) ) {
		hash = {
			when: _.has( handle, "when" ) ? handle.when : true,
			then: handle.then,
			exclusive: _.has( handle, "exclusive" ) ? handle.exclusive : true,
			map: _.has( handle, "map" ) ? handle.map : true
		};
	}

	var map = hash.map;
	if ( _.isFunction( hash.when ) ) {
		hash.when = util.mapCall( hash.when, map );
	}
	hash.then = util.mapCall( hash.then, map );

	return hash;
}

function processHandles( instance ) {
	instance.commands = _.reduce( instance.commands, function( acc, handlers, name ) {
		if ( _.isArray( handlers ) ) {
			acc[ name ] = _.map( handlers, processHandle );
		} else {
			acc[ name ] = _.map( [ handlers ], processHandle );
		}
		return acc;
	}, {} );
	instance.events = _.reduce( instance.events, function( acc, handlers, name ) {
		if ( _.isArray( handlers ) ) {
			acc[ name ] = _.map( handlers, processHandle );
		} else {
			acc[ name ] = _.map( [ handlers ], processHandle );
		}
		return acc;
	}, {} );
}

module.exports = loadActors;
