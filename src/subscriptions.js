var _ = require( "lodash" );

function createReverseLookup( map ) {
	return _.reduce( map, function( acc, topics, type ) {
		_.each( topics.events, function( topic ) {
			acc[ topic ] = acc[ topic ] ? ( _.uniq( acc[ topic ].push( type ) ).sort()) : [ type ];
		} );
		_.each( topics.commands, function( topic ) {
			acc[ topic ] = acc[ topic ] ? ( _.uniq( acc[ topic ].push( type ) ).sort()) : [ type ];
		} );
		return acc;
	}, {} );
}

function getSubscriptionMap( actors ) {
	return _.reduce( actors, function( acc, actor ) {
		var metadata = actor.metadata;
		function prefix( topic ) {
			return [ metadata.actor.type, topic ].join( "." );
		}
		var events = _.map( _.keys( metadata.events || {} ), prefix );
		var commands = _.map( _.keys( metadata.commands || {} ), prefix );
		acc[ metadata.actor.type ] = {
			events: events,
			commands: commands
		};
		return acc;
	}, {} );
}

function getTopicList( map ) {
	var lists = _.reduce( map, function( acc, lists ) {
		acc = acc.concat( lists.events || [] );
		acc = acc.concat( lists.commands || [] );
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
