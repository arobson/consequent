var _ = require( 'lodash' );
var when = require( 'when' );

function createReverseLookup( map ) {
	return _.reduce( map, function( acc, topics, type ) {
		_.each( topics, function( topic ) {
			acc[ topic ] = acc[ topic ] ? ( _.uniq( acc[ topic ].push( type ) ).sort()) : [ type ];
		} );
		return acc;
	}, {} );
}

function getSubscriptionMap( actors ) {
	return _.reduce( actors, function( acc, metadata ) {
		var instance = metadata.instance;
		var events = _.reduce( instance.events, function( acc, handlers, state ) {
			acc = acc.concat( _.keys( handlers ) );
			return acc;
		}, [] );
		var commands = _.reduce( instance.commands, function( acc, handlers, state ) {
			acc = acc.concat( _.keys( handlers ) );
			return acc;
		}, [] );
		acc[ instance.actor.type ] = _.uniq( events.concat( commands ) ).sort();
		return acc;
	}, {} );
}

function getTopicList( map ) {
	var lists = _.reduce( map, function( acc, list ) {
		acc = acc.concat( list );
		return acc;
	}, [] );
	return _.uniq( lists ).sort();
}

module.exports = {
	getActorLookup: function( actors ) {
		return createReverseLookup( getSubscriptionMap( actors ) );
	},
	getSubscriptions: getSubscriptionMap,
	getTopics: function( actors ) {
		return getTopicList( getSubscriptionMap( actors ) );
	}
};
